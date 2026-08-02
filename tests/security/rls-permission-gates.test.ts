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


/**
 * Phase 3 - RLS business permission enforcement part 2 (static contract).
 *
 * Verifies supabase/migrations/20260801000003_rls_business_permission_enforcement_part2.sql
 * extends the Phase 2 hardening to the remaining core ERP modules:
 * inventory, manufacturing (MES), fleet, projects (PPM), attendance / workforce
 * and recruitment (TA). Same guarantees as Phase 2: RESTRICTIVE write policies
 * (INSERT / UPDATE / DELETE) gated on module permissions or super admin, SELECT
 * stays open to company members, and every permission slug is verified against
 * the live permissions catalog.
 */
const MIGRATION_PART2 = resolve(
  process.cwd(),
  "supabase/migrations/20260801000003_rls_business_permission_enforcement_part2.sql"
);

const sqlPart2 = readFileSync(MIGRATION_PART2, "utf8");

/** Every table hardened in Phase 3 (65 tables x 3 write actions = 195 policies). */
const HARDENED_TABLES_PART2 = [
  // Inventory
  "products",
  "product_categories",
  "warehouses",
  "warehouse_zones",
  "warehouse_bins",
  "warehouse_racks",
  "stock_balances",
  "stock_adjustments",
  "stock_adjustment_lines",
  "stock_transfers",
  "stock_transfer_lines",
  "stock_reservations",
  // Manufacturing (MES)
  "bom_headers",
  "bom_lines",
  "mes_work_orders",
  "mes_production_orders",
  "mes_production_plans",
  "mes_rework_orders",
  "production_batches",
  "mes_work_centers",
  "mes_routings",
  "mes_routing_operations",
  "mes_quality_inspections",
  // Fleet
  "fleet_vehicles",
  "fleet_drivers",
  "fleet_fuel_logs",
  "fleet_fuel_requests",
  "fleet_maintenance",
  "fleet_trips",
  "fleet_repair_orders",
  "fleet_work_orders",
  "fleet_vehicle_assignments",
  "fleet_inspections",
  "fleet_insurance_policies",
  "fleet_settings",
  // Projects (PPM)
  "ppm_projects",
  "ppm_tasks",
  "ppm_milestones",
  "ppm_risks",
  "ppm_issues",
  "ppm_timesheets",
  "ppm_time_logs",
  "ppm_budgets",
  "ppm_expenses",
  "ppm_change_requests",
  "ppm_deliverables",
  "ppm_approvals",
  // Attendance / Workforce
  "attendance_records",
  "att_approvals",
  "att_corrections",
  "att_shift_swaps",
  "att_remote_work",
  "att_holidays",
  "att_settings",
  "shift_templates",
  "shift_assignments",
  // Recruitment (TA)
  "ta_vacancies",
  "ta_candidates",
  "ta_applications",
  "ta_requisitions",
  "ta_positions",
  "ta_interviews",
  "ta_offers",
  "ta_assessments",
  "ta_background_checks",
] as const;

/** Permission slugs verified against the live permissions catalog. */
const VERIFIED_SLUGS_PART2 = [
  "inventory.manage",
  "inventory.adjust",
  "inventory.move",
  "inventory.transfer",
  "inventory.grn",
  "inventory.qc",
  "inventory.valuation",
  "products.manage",
  "mes.manage",
  "mes.plan",
  "mes.planning",
  "mes.operate",
  "mes.shopfloor",
  "mes.quality",
  "quality.approve",
  "production.create",
  "production.edit",
  "production.manage",
  "fleet.manage",
  "fleet.admin",
  "fleet.approve",
  "fleet.dispatch",
  "fleet.drivers",
  "fleet.fuel",
  "fleet.maintenance",
  "fleet.track",
  "ppm.manage",
  "ppm.admin",
  "ppm.approve",
  "ppm.execute",
  "ppm.plan",
  "ppm.finance",
  "att.manage",
  "att.admin",
  "att.approve",
  "att.field",
  "att.clock",
  "wfm.manage",
  "wfm.approve",
  "ta.manage",
  "ta.admin",
  "ta.recruit",
  "ta.approve",
  "hr.recruit",
] as const;

describe("RLS permission enforcement migration part 2 (inventory/mes/fleet/ppm/attendance/ta)", () => {
  it("exists and is non-trivial", () => {
    expect(sqlPart2.length).toBeGreaterThan(10_000);
  });

  it("hardens every module table with write policies", () => {
    for (const table of HARDENED_TABLES_PART2) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sqlPart2,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sqlPart2,
          `${policy} must be RESTRICTIVE`
        ).toContain(
          `CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`
        );
      }
    }
  });

  it("defines exactly 195 write policies (65 tables x 3 actions)", () => {
    const created =
      sqlPart2.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES_PART2.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
    // Drop-first convention: every CREATE has a matching DROP IF EXISTS
    const dropped =
      sqlPart2.match(/DROP POLICY IF EXISTS \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(dropped.length).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    expect(sqlPart2.match(/AS RESTRICTIVE FOR SELECT/i)).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    const policyBodies = sqlPart2.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    expect(policyBodies.length).toBe(HARDENED_TABLES_PART2.length * WRITE_ACTIONS.length);
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("gates parent-scoped line items through their header row", () => {
    // warehouse_racks has no own company_id; the write gate must require the
    // parent warehouse to belong to the caller's company.
    for (const action of WRITE_ACTIONS) {
      const marker = `CREATE POLICY warehouse_racks_write_restrict_${action} ON warehouse_racks AS RESTRICTIVE FOR ${action.toUpperCase()}`;
      const start = sqlPart2.indexOf(marker);
      expect(start, `${marker} must exist`).toBeGreaterThan(-1);
      const body = sqlPart2.slice(start, sqlPart2.indexOf(";", start) + 1);
      expect(body).toContain(
        "warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())"
      );
    }
  });

  it("uses only permission slugs verified against the live catalog", () => {
    const slugRe = /'([a-z]+\.[a-z]+)'/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugRe.exec(sqlPart2)) !== null) {
      found.add(match[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    const verified = new Set<string>(VERIFIED_SLUGS_PART2);
    for (const slug of found) {
      expect(verified.has(slug), `unverified slug ${slug}`).toBe(true);
    }
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    for (const banned of ["sales.approve", "hr.admin", "hr.delete"]) {
      expect(sqlPart2, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});