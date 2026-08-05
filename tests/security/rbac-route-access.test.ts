import { describe, it, expect } from "vitest";
import {
  canAccessRoute,
  resolveRoutePermissions,
  getRbacRules,
} from "@/lib/auth/rbac";

describe("RBAC route access", () => {
  it("builds rules from NAV_ITEMS with longest-prefix preference", () => {
    const rules = getRbacRules();
    expect(rules.length).toBeGreaterThan(20);
    // Finance is more specific than dashboard
    expect(resolveRoutePermissions("/dashboard/finance")).toContain(
      "finance.view"
    );
    expect(resolveRoutePermissions("/dashboard/finance/journals")).toContain(
      "finance.view"
    );
  });

  it("allows self-service profile without settings.manage", () => {
    const perms = ["dashboard.view"];
    expect(
      canAccessRoute(perms, "/dashboard/settings/profile")
    ).toBe(true);
    expect(canAccessRoute(perms, "/dashboard/settings")).toBe(false);
    expect(canAccessRoute(["settings.view"], "/dashboard/settings")).toBe(true);
  });

  it("denies finance without finance.view", () => {
    expect(canAccessRoute(["dashboard.view", "hr.view"], "/dashboard/finance")).toBe(
      false
    );
    expect(
      canAccessRoute(["dashboard.view", "finance.view"], "/dashboard/finance")
    ).toBe(true);
  });

  it("requires platform.view under /platform", () => {
    expect(resolveRoutePermissions("/platform/jobs")).toEqual(
      expect.arrayContaining(["platform.view"])
    );
    expect(canAccessRoute(["dashboard.view"], "/platform")).toBe(false);
    expect(canAccessRoute(["platform.view"], "/platform")).toBe(true);
  });

  it("platform admin bypasses route gates", () => {
    expect(
      canAccessRoute([], "/dashboard/finance", { isPlatformAdmin: true })
    ).toBe(true);
  });

  it("super admin does not get blanket bypass without permission", () => {
    expect(
      canAccessRoute(["dashboard.view"], "/dashboard/finance", {
        isSuperAdmin: true,
      })
    ).toBe(false);
    expect(
      canAccessRoute(["dashboard.view", "finance.view"], "/dashboard/finance", {
        isSuperAdmin: true,
      })
    ).toBe(true);
  });

  it("requires hc.view for SecureChat", () => {
    expect(resolveRoutePermissions("/dashboard/chat")).toContain("hc.view");
    expect(canAccessRoute(["dashboard.view"], "/dashboard/chat")).toBe(false);
    expect(canAccessRoute(["hc.view"], "/dashboard/chat/files")).toBe(true);
  });

  it("home dashboard needs dashboard.view", () => {
    expect(resolveRoutePermissions("/dashboard")).toEqual(["dashboard.view"]);
    expect(canAccessRoute([], "/dashboard")).toBe(false);
    expect(canAccessRoute(["dashboard.view"], "/dashboard")).toBe(true);
  });

  it("fails closed for unmapped dashboard paths", () => {
    expect(resolveRoutePermissions("/dashboard/__no_such_module__")).toEqual(
      []
    );
    expect(
      canAccessRoute(["dashboard.view"], "/dashboard/__no_such_module__")
    ).toBe(false);
  });

  it("gates dual-control by security.dual_control not platform.view", () => {
    expect(
      canAccessRoute(["platform.view"], "/dashboard/security/dual-control")
    ).toBe(false);
    expect(
      canAccessRoute(
        ["security.dual_control"],
        "/dashboard/security/dual-control"
      )
    ).toBe(true);
  });
});
