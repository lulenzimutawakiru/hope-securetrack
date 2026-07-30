/**
 * RLS matrix checklist — documents and validates expected isolation rules.
 * Live DB tests require SUPABASE_SERVICE_ROLE_KEY + INTEGRATION_TESTS=true.
 */
import { describe, it, expect } from "vitest";

/** Core tables that MUST be company-scoped via RLS */
export const COMPANY_SCOPED_TABLES = [
  "employees",
  "payroll_runs",
  "pay_employee_profiles",
  "invoices",
  "sales_orders",
  "qr_codes",
  "eal_events",
  "bill_portal_users",
  "att_devices",
  "ta_vacancies",
  "fleet_vehicles",
  "gl_journals",
  "user_company_memberships",
  "domain_events",
  "sec_dual_control_requests",
  "wf_instances",
  "job_queue",
  "srm_match_logs",
  "pay_payment_batches",
  "fin_auto_journals",
] as const;

/** Tables that must never be readable anonymously */
export const ANON_DENIED_TABLES = [
  "payroll_runs",
  "invoices",
  "bill_portal_users",
  "sec_dual_control_requests",
  "job_queue",
] as const;

export type RlsNegativeCase = {
  table: string;
  asUserCompanyA: string;
  asAnon: string;
};

export function buildNegativeCases(
  tables: readonly string[] = COMPANY_SCOPED_TABLES
): RlsNegativeCase[] {
  return tables.map((table) => ({
    table,
    asUserCompanyA: "select denied for company B rows",
    asAnon: "select denied without membership",
  }));
}

describe("RLS matrix inventory", () => {
  it("lists critical company-scoped tables", () => {
    expect(COMPANY_SCOPED_TABLES.length).toBeGreaterThan(15);
    expect(COMPANY_SCOPED_TABLES).toContain("invoices");
    expect(COMPANY_SCOPED_TABLES).toContain("payroll_runs");
    expect(COMPANY_SCOPED_TABLES).toContain("wf_instances");
    expect(COMPANY_SCOPED_TABLES).toContain("job_queue");
  });

  it("defines negative test cases for cross-tenant access", () => {
    const negativeCases = buildNegativeCases();
    expect(negativeCases.every((c) => c.table && c.asUserCompanyA)).toBe(true);
    expect(negativeCases.length).toBe(COMPANY_SCOPED_TABLES.length);
  });

  it("includes money and security tables in anon-denied list", () => {
    expect(ANON_DENIED_TABLES).toContain("payroll_runs");
    expect(ANON_DENIED_TABLES).toContain("bill_portal_users");
    expect(ANON_DENIED_TABLES).toContain("sec_dual_control_requests");
  });
});

describe("live RLS (optional integration)", () => {
  const enabled = process.env.INTEGRATION_TESTS === "true";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  it.skipIf(!enabled)("environment has supabase credentials", () => {
    expect(url).toBeTruthy();
    expect(serviceKey).toBeTruthy();
    expect(anonKey).toBeTruthy();
  });

  it.skipIf(!enabled || !url || !serviceKey)(
    "service role can list companies; anon cannot list payroll_runs",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: adminErr } = await admin
        .from("companies")
        .select("id")
        .limit(1);
      // Admin should not be blocked by RLS
      expect(adminErr).toBeNull();

      if (!anonKey) return;
      const anon = createClient(url!, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: payroll, error: payErr } = await anon
        .from("payroll_runs")
        .select("id")
        .limit(5);
      // Anon without JWT should get empty or error — never a full dump
      const leaked = (payroll || []).length;
      expect(leaked === 0 || payErr !== null).toBe(true);
    }
  );

  it.skipIf(!enabled || !url || !serviceKey)(
    "company-scoped tables exist in information_schema",
    async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url!, serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // Probe a sample of critical tables
      for (const table of ["payroll_runs", "invoices", "gl_journals"] as const) {
        const { error } = await admin.from(table).select("id").limit(1);
        // Missing table is a CI failure; empty is OK
        if (error && /does not exist|schema cache/i.test(error.message)) {
          throw new Error(`Expected table ${table} to exist: ${error.message}`);
        }
      }
    }
  );
});
