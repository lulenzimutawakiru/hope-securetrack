import { describe, expect, it } from "vitest";
import { canAccessRoute, resolveRoutePermissions } from "@/lib/auth/rbac";

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
});
