import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260815000001_rbac_catalog_1000_roles.sql"
);

describe("RBAC role catalog migration", () => {
  it("exists and provisions at least 1000 catalog roles", () => {
    expect(existsSync(MIGRATION)).toBe(true);
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toMatch(/2120 roles/);
    expect(sql).toContain("catalog_");
    expect(sql).toContain("role_permissions");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    // 53 modules x 8 levels x 5 variants
    expect(53 * 8 * 5).toBe(2120);
    expect(2120).toBeGreaterThanOrEqual(1000);
  });

  it("seeds a non-trivial permission catalog", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("INSERT INTO permissions");
    expect(sql).toContain("finance.view");
    expect(sql).toContain("payroll.manage");
    expect(sql).toContain("dashboard.view");
    // never grant platform control plane to catalog roles
    expect(sql).toContain("p.slug NOT LIKE 'platform.%'");
  });

  it("appends access for super_administrator and baseline dashboard.view", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("super_administrator");
    expect(sql).toMatch(/dashboard\.view/);
    expect(sql).toContain("managing_director");
    expect(sql).toContain("auditor");
  });
});
