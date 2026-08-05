import { describe, expect, it } from "vitest";
import { canAccessRoute, resolveRoutePermissions } from "@/lib/auth/rbac";
import { readFileSync } from "fs";
import { join } from "path";

describe("platform cPanel RBAC", () => {
  it("requires platform.view for /platform and tenant directory", () => {
    expect(resolveRoutePermissions("/platform")).toEqual(
      expect.arrayContaining(["platform.view"])
    );
    expect(resolveRoutePermissions("/platform/tenants")).toEqual(
      expect.arrayContaining(["platform.view"])
    );
    expect(resolveRoutePermissions("/platform/tenants/abc")).toEqual(
      expect.arrayContaining(["platform.view"])
    );
  });

  it("denies tenant users without platform permissions", () => {
    expect(
      canAccessRoute(["dashboard.view", "tenant.view"], "/platform")
    ).toBe(false);
    expect(
      canAccessRoute(["dashboard.view", "finance.view"], "/platform/tenants")
    ).toBe(false);
  });

  it("allows platform staff permission set", () => {
    expect(canAccessRoute(["platform.view"], "/platform")).toBe(true);
    expect(canAccessRoute(["platform.admin"], "/platform/tenants")).toBe(true);
    expect(
      canAccessRoute([], "/platform/tenants", { isPlatformAdmin: true })
    ).toBe(true);
  });

  it("exposes full tenant CRUD on platform APIs", () => {
    const list = readFileSync(
      join(process.cwd(), "src/app/api/platform/tenants/route.ts"),
      "utf8"
    );
    const one = readFileSync(
      join(process.cwd(), "src/app/api/platform/tenants/[id]/route.ts"),
      "utf8"
    );
    expect(list).toContain("export const GET");
    expect(list).toContain("export const POST");
    expect(list).toContain("cpanelCreateTenant");
    expect(one).toContain("export const GET");
    expect(one).toContain("export const PATCH");
    expect(one).toContain("export const PUT");
    expect(one).toContain("export const DELETE");
    expect(one).toContain("cpanelDeleteTenant");
  });

  it("defines enterprise control plane command center", () => {
    const api = readFileSync(
      join(process.cwd(), "src/app/api/platform/command-center/route.ts"),
      "utf8"
    );
    const cp = readFileSync(
      join(process.cwd(), "src/lib/platform/control-plane.ts"),
      "utf8"
    );
    expect(api).toContain("getCommandCenterSnapshot");
    expect(cp).toContain("Platform Administration");
    expect(cp).toContain("Tenant Administration");
    expect(cp).toContain("Company Administration");
    expect(cp).toContain("CONTROL_PLANE_NAV");
  });

  it("exposes user administration mutations for estate identity", () => {
    const users = readFileSync(
      join(process.cwd(), "src/app/api/platform/users/route.ts"),
      "utf8"
    );
    expect(users).toContain("export const GET");
    expect(users).toContain("export const PATCH");
    expect(users).toContain("deactivate");
    expect(users).toContain("force_logout");
    expect(users).toContain("require_mfa");
  });

  it("create tenant accepts enterprise fields", () => {
    const list = readFileSync(
      join(process.cwd(), "src/app/api/platform/tenants/route.ts"),
      "utf8"
    );
    expect(list).toContain("industry");
    expect(list).toContain("data_region");
    expect(list).toContain("compliance_requirements");
    expect(list).toContain("encryption_secret_once");
    expect(list).toContain("government");
  });
});
