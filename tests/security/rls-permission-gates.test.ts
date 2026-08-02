/**
 * RLS business permission enforcement (Phase 2) — static contract.
 *
 * Verifies the migration supabase/migrations/20260801000002_rls_business_permission_enforcement.sql
 * actually hardens the data-layer RBAC gap:
 *
 *   - Every high-risk business table gets RESTRICTIVE write policies
 *     (INSERT / UPDATE / DELETE) gated on module permissions or super admin.
 *   - SELECT stays open to company members (the client UI reads directly).
 *   - The roles restrictive policy keeps global role templates readable
 *     (company_id IS NULL AND tenant_id IS NULL) while writes stay locked.
 *
 * Pure static guarantees: no database, no credentials, runs in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260801000002_rls_business_permission_enforcement.sql"
);

const sql = readFileSync(MIGRATION, "utf8");

/** Every table that receives RESTRICTIVE write policies in this phase. */
const HARDENED_TABLES = [
  // Finance / accounting
  "invoices",
  "invoice_payments",
  "gl_journals",
  "gl_journal_lines",
  "ar_receipts",
  "ar_credit_notes",
  "ap_invoices",
  "ap_payments",
  "fin_auto_journals",
  // Payroll
  "payroll_runs",
  "payroll_lines",
  "pay_payslips",
  "pay_payment_batches",
  // Sales / CRM
  "sales_orders",
  "customers",
  // HR
  "employees",
  // Procurement
  "purchase_orders",
  "purchase_order_lines",
  "suppliers",
  // Parent-scoped line items (no own tenant_id; gated via parent)
  "invoice_lines",
  "sales_order_lines",
] as const;

const WRITE_ACTIONS = ["insert", "update", "delete"] as const;

describe("RLS permission enforcement migration", () => {
  it("exists and is non-trivial", () => {
    expect(sql.length).toBeGreaterThan(10_000);
  });

  it("hardens every high-risk business table with write policies", () => {
    for (const table of HARDENED_TABLES) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sql,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sql,
          `${policy} must be RESTRICTIVE`
        ).toContain(`CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`);
      }
    }
  });

  it("defines exactly 63 write policies (21 tables x 3 actions)", () => {
    const created = sql.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    // SELECT policies remain permissive company-scoped; this phase only adds
    // RESTRICTIVE policies for write actions.
    const restrictiveSelect = sql.match(
      /AS RESTRICTIVE FOR SELECT/i
    );
    expect(restrictiveSelect).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    // Every write policy must reference the permission helper or super admin.
    const policyBodies = sql.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("restores read visibility of global role templates on roles", () => {
    const rolesPolicy = sql.match(
      /CREATE POLICY tenant_isolation_restrict ON roles[\s\S]*?;/i
    )?.[0];
    expect(rolesPolicy).toBeTruthy();
    expect(rolesPolicy).toContain("company_id IS NULL");
    expect(rolesPolicy).toContain("tenant_id IS NULL");
    expect(rolesPolicy).toContain("tenant_company_access(");
  });

  it("recreates the roles restrictive policy (drop before create)", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS tenant_isolation_restrict ON roles;");
    expect(sql).toContain("CREATE POLICY tenant_isolation_restrict ON roles");
  });

  it("uses only permission slugs verified against the live catalog", () => {
    // Finance
    expect(sql).toContain("'finance.manage'");
    expect(sql).toContain("'finance.post'");
    expect(sql).toContain("'finance.approve'");
    expect(sql).toContain("'finance.admin'");
    expect(sql).toContain("'finance.cfo'");
    expect(sql).toContain("'invoices.manage'");
    // Payroll
    expect(sql).toContain("'payroll.manage'");
    expect(sql).toContain("'payroll.process'");
    expect(sql).toContain("'payroll.approve'");
    expect(sql).toContain("'payroll.pay'");
    expect(sql).toContain("'payroll.admin'");
    // Sales / CRM / HR / Procurement
    expect(sql).toContain("'sales.manage'");
    expect(sql).toContain("'sales.admin'");
    expect(sql).toContain("'crm.manage'");
    expect(sql).toContain("'crm.admin'");
    expect(sql).toContain("'hr.manage'");
    expect(sql).toContain("'users.manage'");
    expect(sql).toContain("'procurement.manage'");
    expect(sql).toContain("'procurement.approve'");
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    // These were candidate slugs that do NOT exist live — must not appear.
    for (const banned of ["sales.approve", "hr.admin", "hr.delete"]) {
      expect(sql, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});
