/**
 * Phase 11 — Legacy identity & permissive-policy lockdown (static contract).
 *
 * Verifies supabase/migrations/20260804000001_legacy_identity_lockdown.sql
 * closes the two legacy bypass paths from migration 0001:
 *
 *   1. matches_tenant() no longer trusts the JWT app_role='platform_admin'
 *      claim and no longer allows NULL == NULL tenant matching.
 *   2. The seven legacy FOR ALL policies built on matches_tenant() are dropped,
 *      making the dead legacy tables (profiles, audit_log, custom_fields,
 *      workflow_definitions, tenant_settings) deny-by-default.
 *   3. The platform reference tables that never had RLS (industry_templates,
 *      entity_metadata) are now locked to platform/super admins.
 *
 * Pure static guarantees: no database, no credentials, runs in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260804000001_legacy_identity_lockdown.sql"
);

const sql = readFileSync(MIGRATION, "utf8");

/** Legacy FOR ALL policies created in migration 0001 that must be dropped. */
const LEGACY_POLICIES = [
  "tenant_isolation_profiles",
  "tenant_isolation_audit_log",
  "tenant_isolation_tenants",
  "tenant_isolation_tenant_modules",
  "tenant_isolation_custom_fields",
  "tenant_isolation_workflow_definitions",
  "tenant_isolation_tenant_settings",
] as const;

/** Dead legacy tables that become deny-by-default (RLS on, zero policies). */
const DEAD_TABLES = [
  "profiles",
  "audit_log",
  "custom_fields",
  "workflow_definitions",
  "tenant_settings",
] as const;

/** Platform reference tables gaining admin-only RLS. */
const REFERENCE_TABLES = ["industry_templates", "entity_metadata"] as const;

describe("Phase 11 legacy identity lockdown migration", () => {
  it("exists and is non-trivial", () => {
    expect(sql.length).toBeGreaterThan(2_000);
  });

  it("drops every legacy FOR ALL policy from migration 0001", () => {
    for (const policy of LEGACY_POLICIES) {
      expect(sql, policy + " must be dropped").toContain(
        'DROP POLICY IF EXISTS "' + policy + '" ON'
      );
    }
    // Every legacy policy name appears exactly once (as a DROP — no recreate)
    for (const policy of LEGACY_POLICIES) {
      const re = new RegExp("\\b" + policy + "\\b", "g");
      const matches = sql.match(re) ?? [];
      expect(matches.length, policy + " must only appear as a DROP").toBe(1);
    }
  });

  it("never recreates the legacy policies", () => {
    const creates = sql.match(
      /CREATE POLICY\s+"?tenant_isolation_(profiles|audit_log|tenants|tenant_modules|custom_fields|workflow_definitions|tenant_settings)"?/g
    ) ?? [];
    expect(creates).toEqual([]);
  });

  it("hardens matches_tenant: no JWT claim trust", () => {
    const body = sql.match(
      /CREATE OR REPLACE FUNCTION public\.matches_tenant[\s\S]*?END;\n\$\$/i
    )?.[0];
    expect(body, "matches_tenant must be redefined").toBeTruthy();
    expect(body).not.toContain("auth.jwt()");
    expect(body).not.toContain("app_role");
    // Server-authoritative identity only
    expect(body).toMatch(/is_platform_admin\(\)/);
    expect(body).toMatch(/is_platform_elevated\(\)/);
    expect(body).toMatch(/user_tenant_id\(\)/);
  });

  it("hardens matches_tenant: no NULL == NULL bypass", () => {
    const body = sql.match(
      /CREATE OR REPLACE FUNCTION public\.matches_tenant[\s\S]*?END;\n\$\$/i
    )?.[0];
    expect(body).toBeTruthy();
    // Strict equality requires a non-null row tenant
    expect(body).toContain("p_tenant_id IS NOT NULL");
    expect(body).toContain("p_tenant_id = public.user_tenant_id()");
  });

  it("keeps RLS enabled on the dead legacy tables (deny-by-default)", () => {
    for (const table of DEAD_TABLES) {
      expect(sql, table + " must keep RLS enabled").toContain(
        "ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY;"
      );
      // No CREATE POLICY for the dead tables may remain
      const re = new RegExp("CREATE POLICY[\\s\\S]*?ON " + table + "\\b", "g");
      const creates = sql.match(re) ?? [];
      expect(creates, table + " must have zero policies").toEqual([]);
    }
  });

  it("keeps modern tenant/tenant_modules policies intact", () => {
    // Only the legacy bypass policies are dropped — modern control-plane
    // policies are untouched (this migration contains no DROP for them).
    expect(sql).not.toContain("DROP POLICY IF EXISTS tenants_select");
    expect(sql).not.toContain("DROP POLICY IF EXISTS tenants_all_admin");
    expect(sql).not.toContain("DROP POLICY IF EXISTS tenant_modules_all");
  });

  it("locks down platform reference tables with admin-only read", () => {
    for (const table of REFERENCE_TABLES) {
      expect(sql, table + " must get RLS").toContain(
        "ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY;"
      );
      const policy = table + "_admin_read";
      expect(sql, policy + " must be created").toContain(
        "CREATE POLICY " + policy + " ON " + table + " FOR SELECT"
      );
      expect(sql, policy + " must be gated on admin").toContain(
        "public.is_platform_admin() OR public.is_super_admin()"
      );
    }
    // No write policies may be created for reference tables
    const writes = sql.match(
      /CREATE POLICY \w+_admin_read ON (industry_templates|entity_metadata) FOR (INSERT|UPDATE|DELETE)/g
    ) ?? [];
    expect(writes).toEqual([]);
  });
});
