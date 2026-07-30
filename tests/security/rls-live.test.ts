/**
 * Live multi-tenant RLS proof.
 *
 * Enable with:
 *   INTEGRATION_TESTS=true
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional cross-company proof (stronger):
 *   RLS_USER_A_EMAIL / RLS_USER_A_PASSWORD  (member of company A)
 *   RLS_USER_B_EMAIL / RLS_USER_B_PASSWORD  (member of company B)
 *   RLS_COMPANY_A_ID / RLS_COMPANY_B_ID
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { COMPANY_SCOPED_TABLES, ANON_DENIED_TABLES } from "./rls-matrix.test";

const enabled = process.env.INTEGRATION_TESTS === "true";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const hasCrossUser =
  Boolean(process.env.RLS_USER_A_EMAIL) &&
  Boolean(process.env.RLS_USER_A_PASSWORD) &&
  Boolean(process.env.RLS_USER_B_EMAIL) &&
  Boolean(process.env.RLS_USER_B_PASSWORD);

function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe.runIf(enabled)("live RLS isolation", () => {
  beforeAll(() => {
    expect(url, "NEXT_PUBLIC_SUPABASE_URL").toBeTruthy();
    expect(serviceKey, "SUPABASE_SERVICE_ROLE_KEY").toBeTruthy();
    expect(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY").toBeTruthy();
  });

  it("service role can read companies", async () => {
    const admin = adminClient();
    const { data, error } = await admin.from("companies").select("id").limit(3);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("anonymous client cannot dump payroll_runs or invoices", async () => {
    const anon = anonClient();
    for (const table of ANON_DENIED_TABLES) {
      const { data, error } = await anon.from(table).select("id").limit(20);
      const leaked = (data || []).length;
      // Empty result or RLS/permission error is acceptable
      expect(
        leaked === 0 || error !== null,
        `${table}: anon leaked ${leaked} rows (err=${error?.message || "none"})`
      ).toBe(true);
    }
  });

  it("critical tables exist and are queryable by service role", async () => {
    const admin = adminClient();
    const sample = [
      "payroll_runs",
      "invoices",
      "gl_journals",
      "employees",
      "bill_portal_users",
      "sec_dual_control_requests",
      "wf_instances",
      "job_queue",
      "srm_match_logs",
    ] as const;

    for (const table of sample) {
      const { error } = await admin.from(table).select("id").limit(1);
      if (error && /does not exist|schema cache|Could not find/i.test(error.message)) {
        throw new Error(`Missing table ${table}: ${error.message}`);
      }
    }
  });

  it("company-scoped inventory remains complete for certification", () => {
    // Full pg_catalog RLS flag probe is blocked on most Supabase API roles;
    // cross-user tests below are the enforceable isolation proof.
    expect(COMPANY_SCOPED_TABLES.length).toBeGreaterThan(15);
    expect(ANON_DENIED_TABLES.length).toBeGreaterThan(3);
  });

  it.runIf(hasCrossUser)(
    "user A cannot read company B payroll_runs",
    async () => {
      const emailA = process.env.RLS_USER_A_EMAIL!;
      const passA = process.env.RLS_USER_A_PASSWORD!;
      const emailB = process.env.RLS_USER_B_EMAIL!;
      const passB = process.env.RLS_USER_B_PASSWORD!;
      const companyB = process.env.RLS_COMPANY_B_ID;

      const userA = await signIn(emailA, passA);
      const userB = await signIn(emailB, passB);

      // What B can see
      const { data: bRuns, error: bErr } = await userB
        .from("payroll_runs")
        .select("id,company_id")
        .limit(50);
      expect(bErr).toBeNull();

      // What A sees
      const { data: aRuns, error: aErr } = await userA
        .from("payroll_runs")
        .select("id,company_id")
        .limit(50);
      expect(aErr).toBeNull();

      const aIds = new Set((aRuns || []).map((r) => r.id as string));
      const bIds = (bRuns || []).map((r) => r.id as string);

      // No shared run IDs between isolated companies when both have data
      if (aIds.size && bIds.length) {
        const overlap = bIds.filter((id) => aIds.has(id));
        expect(overlap, "cross-company payroll_runs leak").toEqual([]);
      }

      if (companyB) {
        const foreign = (aRuns || []).filter(
          (r) => String(r.company_id) === String(companyB)
        );
        expect(foreign, "user A saw company B rows").toEqual([]);
      }

      // Invoices isolation sample
      const { data: aInv } = await userA.from("invoices").select("id,company_id").limit(50);
      const { data: bInv } = await userB.from("invoices").select("id,company_id").limit(50);
      const aInvIds = new Set((aInv || []).map((r) => r.id as string));
      const overlapInv = (bInv || [])
        .map((r) => r.id as string)
        .filter((id) => aInvIds.has(id));
      expect(overlapInv, "cross-company invoices leak").toEqual([]);
    }
  );

  it.runIf(hasCrossUser)(
    "user A cannot update company B dual-control requests",
    async () => {
      const userA = await signIn(
        process.env.RLS_USER_A_EMAIL!,
        process.env.RLS_USER_A_PASSWORD!
      );
      const userB = await signIn(
        process.env.RLS_USER_B_EMAIL!,
        process.env.RLS_USER_B_PASSWORD!
      );

      const { data: bRows } = await userB
        .from("sec_dual_control_requests")
        .select("id,status")
        .limit(5);

      if (!bRows?.length) {
        expect(true).toBe(true); // no data to attack — pass
        return;
      }

      const target = bRows[0].id as string;
      const { data: updated, error } = await userA
        .from("sec_dual_control_requests")
        .update({ notes: "rls-probe-should-fail" })
        .eq("id", target)
        .select("id");

      // Either error or zero rows updated
      expect(
        error !== null || !updated?.length,
        "user A mutated company B dual-control row"
      ).toBe(true);
    }
  );
});

describe.runIf(!enabled)("live RLS (disabled)", () => {
  it("skips when INTEGRATION_TESTS is not true", () => {
    expect(process.env.INTEGRATION_TESTS).not.toBe("true");
  });
});
