import { describe, expect, it } from "vitest";
import {
  CONTROL_PLANE_CAPABILITIES,
  ACCESS_MATRIX,
} from "@/lib/platform/control-plane-registry";
import {
  PLATFORM_STAFF_ROLES,
  PLATFORM_ROLE_CAPABILITY_MATRIX,
  isPlatformStaff,
  resolvePlatformRole,
  roleCanAccessCapability,
  capabilitiesForRole,
  capabilityIdsForRole,
  resolveCapabilityForPath,
  roleLabelToCode,
  staffCanAccess,
  type PlatformStaffRole,
} from "@/lib/platform/staff";

const allCapabilityIds = CONTROL_PLANE_CAPABILITIES.map((c) => c.id);
const ownerCtx = {
  isPlatformAdmin: true,
  isElevated: false,
  platformRole: "owner" as PlatformStaffRole,
};

describe("platform staff resolution", () => {
  it("flags only staff profiles unbound from tenants", () => {
    expect(
      isPlatformStaff({ is_platform_admin: true, tenant_id: null })
    ).toBe(true);
    expect(
      isPlatformStaff({ is_platform_admin: true, tenant_id: "t1" })
    ).toBe(false);
    expect(isPlatformStaff({ is_platform_admin: false })).toBe(false);
    expect(isPlatformStaff(null)).toBe(false);
    expect(isPlatformStaff(undefined)).toBe(false);
  });

  it("resolves legacy staff to owner with isLegacy flag", () => {
    const resolved = resolvePlatformRole({
      is_platform_admin: true,
      tenant_id: null,
      platform_role: null,
    });
    expect(resolved?.role).toBe("owner");
    expect(resolved?.isLegacy).toBe(true);
  });

  it("resolves every explicit staff role", () => {
    for (const def of PLATFORM_STAFF_ROLES) {
      const resolved = resolvePlatformRole({
        is_platform_admin: true,
        platform_role: def.code,
      });
      expect(resolved?.role).toBe(def.code);
      expect(resolved?.isLegacy).toBe(false);
      expect(resolved?.label).toBe(def.label);
    }
  });

  it("fails closed on unknown platform_role and tenant-bound profiles", () => {
    expect(
      resolvePlatformRole({
        is_platform_admin: true,
        platform_role: "boss",
      })
    ).toBeNull();
    expect(
      resolvePlatformRole({
        is_platform_admin: true,
        tenant_id: "t1",
        platform_role: "owner",
      })
    ).toBeNull();
    expect(resolvePlatformRole(null)).toBeNull();
  });
});

describe("staff access matrix", () => {
  it("keeps every capability role label resolvable to a staff code", () => {
    for (const cap of CONTROL_PLANE_CAPABILITIES) {
      expect(cap.roles.length).toBeGreaterThan(0);
      for (const label of cap.roles) {
        expect(roleLabelToCode(label), `${cap.id}: ${label}`).not.toBeNull();
      }
    }
  });

  it("grants Platform Owner full control-plane access", () => {
    const owner = capabilityIdsForRole("owner");
    expect(owner.size).toBe(CONTROL_PLANE_CAPABILITIES.length);
    for (const id of allCapabilityIds) {
      expect(roleCanAccessCapability("owner", id)).toBe(true);
    }
  });

  it("scopes CTO to infrastructure + security + AI (spec matrix)", () => {
    expect(roleCanAccessCapability("cto", "health")).toBe(true);
    expect(roleCanAccessCapability("cto", "monitoring")).toBe(true);
    expect(roleCanAccessCapability("cto", "security")).toBe(true);
    expect(roleCanAccessCapability("cto", "ai")).toBe(true);
    expect(roleCanAccessCapability("cto", "database")).toBe(true);
    expect(roleCanAccessCapability("cto", "workflows")).toBe(true);
    expect(roleCanAccessCapability("cto", "tenants")).toBe(false);
    expect(roleCanAccessCapability("cto", "provisioning")).toBe(false);
    expect(roleCanAccessCapability("cto", "subscriptions")).toBe(false);
    expect(roleCanAccessCapability("cto", "modules")).toBe(false);
    expect(roleCanAccessCapability("cto", "companies")).toBe(false);
    expect(roleCanAccessCapability("cto", "config")).toBe(false);
    expect(roleCanAccessCapability("cto", "studio")).toBe(false);
    expect(roleCanAccessCapability("cto", "ops")).toBe(false);
    expect(roleCanAccessCapability("cto", "users")).toBe(false);
  });

  it("scopes Security Admin to audit + security + identity (spec matrix)", () => {
    expect(roleCanAccessCapability("security", "security")).toBe(true);
    expect(roleCanAccessCapability("security", "compliance")).toBe(true);
    expect(roleCanAccessCapability("security", "governance")).toBe(true);
    expect(roleCanAccessCapability("security", "ai")).toBe(true);
    expect(roleCanAccessCapability("security", "ops")).toBe(true);
    expect(roleCanAccessCapability("security", "users")).toBe(true);
    expect(roleCanAccessCapability("security", "tenants")).toBe(false);
    expect(roleCanAccessCapability("security", "provisioning")).toBe(false);
    expect(roleCanAccessCapability("security", "modules")).toBe(false);
    expect(roleCanAccessCapability("security", "companies")).toBe(false);
    expect(roleCanAccessCapability("security", "deploy")).toBe(false);
    expect(roleCanAccessCapability("security", "jobs")).toBe(false);
  });

  it("scopes DevOps to deployment + monitoring + jobs (spec matrix)", () => {
    expect(roleCanAccessCapability("devops", "health")).toBe(true);
    expect(roleCanAccessCapability("devops", "monitoring")).toBe(true);
    expect(roleCanAccessCapability("devops", "deploy")).toBe(true);
    expect(roleCanAccessCapability("devops", "jobs")).toBe(true);
    expect(roleCanAccessCapability("devops", "database")).toBe(true);
    expect(roleCanAccessCapability("devops", "flags")).toBe(true);
    expect(roleCanAccessCapability("devops", "tenants")).toBe(false);
    expect(roleCanAccessCapability("devops", "security")).toBe(false);
    expect(roleCanAccessCapability("devops", "compliance")).toBe(false);
    expect(roleCanAccessCapability("devops", "ai")).toBe(false);
    expect(roleCanAccessCapability("devops", "ops")).toBe(false);
    expect(roleCanAccessCapability("devops", "users")).toBe(false);
  });

  it("scopes Compliance Officer to audit + reports + governance", () => {
    expect(roleCanAccessCapability("compliance", "compliance")).toBe(true);
    expect(roleCanAccessCapability("compliance", "governance")).toBe(true);
    expect(roleCanAccessCapability("compliance", "storage")).toBe(true);
    expect(roleCanAccessCapability("compliance", "tenants")).toBe(false);
    expect(roleCanAccessCapability("compliance", "ops")).toBe(false);
    expect(roleCanAccessCapability("compliance", "security")).toBe(false);
    expect(roleCanAccessCapability("compliance", "deploy")).toBe(false);
    expect(roleCanAccessCapability("compliance", "users")).toBe(false);
  });

  it("denies unknown roles and unknown capabilities (fail closed)", () => {
    expect(roleCanAccessCapability("superuser", "tenants")).toBe(false);
    expect(roleCanAccessCapability(undefined, "tenants")).toBe(false);
    for (const def of PLATFORM_STAFF_ROLES) {
      expect(roleCanAccessCapability(def.code, "does-not-exist")).toBe(false);
    }
  });

  it("documents all eight access-matrix personas", () => {
    const personaRoles = ACCESS_MATRIX.map((r) => r.role);
    expect(personaRoles).toEqual([
      "Platform Owner",
      "CTO",
      "Security Admin",
      "DevOps",
      "Compliance Officer",
      "Tenant Owner",
      "Company Admin",
      "Normal User",
    ]);
  });

  it("excludes tenant personas from the control plane entirely", () => {
    for (const profile of [
      { is_platform_admin: false, tenant_id: "t1" },
      { is_platform_admin: false, tenant_id: null },
      { is_platform_admin: true, tenant_id: "t1" },
    ]) {
      expect(isPlatformStaff(profile)).toBe(false);
      expect(resolvePlatformRole(profile)).toBeNull();
    }
  });
});

describe("staffCanAccess gate", () => {
  it("fails closed for null, tenant, and non-staff contexts", () => {
    expect(staffCanAccess(null, "tenants")).toBe(false);
    expect(
      staffCanAccess({ isPlatformAdmin: false, isElevated: false }, "tenants")
    ).toBe(false);
    expect(
      staffCanAccess(
        { isPlatformAdmin: false, isElevated: true, platformRole: null },
        "tenants"
      )
    ).toBe(true);
  });

  it("grants owner full access and denies unknown capabilities", () => {
    expect(staffCanAccess(ownerCtx, "tenants")).toBe(true);
    expect(staffCanAccess(ownerCtx, "companies")).toBe(true);
    expect(staffCanAccess(ownerCtx, "ops")).toBe(true);
    expect(staffCanAccess(ownerCtx, "nope")).toBe(false);
  });

  it("enforces the role capability for staff sessions", () => {
    const cto = { ...ownerCtx, platformRole: "cto" as PlatformStaffRole };
    expect(staffCanAccess(cto, "monitoring")).toBe(true);
    expect(staffCanAccess(cto, "ai")).toBe(true);
    expect(staffCanAccess(cto, "tenants")).toBe(false);
    expect(staffCanAccess(cto, "ops")).toBe(false);
  });

  it("denies staff with an invalid platform_role (fail closed)", () => {
    expect(
      staffCanAccess(
        { isPlatformAdmin: true, isElevated: false, platformRole: null },
        "tenants"
      )
    ).toBe(false);
  });

  it("preserves legacy break-glass elevation for elevated sessions", () => {
    expect(
      staffCanAccess(
        { isPlatformAdmin: false, isElevated: true, platformRole: null },
        "ops"
      )
    ).toBe(true);
  });
});

describe("capability helpers", () => {
  it("returns all capabilities for owner and subsets for others", () => {
    expect(capabilitiesForRole("owner").length).toBe(
      CONTROL_PLANE_CAPABILITIES.length
    );
    const ctoIds = capabilityIdsForRole("cto");
    expect(ctoIds.has("monitoring")).toBe(true);
    expect(ctoIds.has("tenants")).toBe(false);
    const devops = capabilityIdsForRole("devops");
    expect(devops.has("jobs")).toBe(true);
    expect(devops.has("deploy")).toBe(true);
    expect(devops.has("security")).toBe(false);
  });

  it("produces a derived matrix with every role and capability covered", () => {
    expect(PLATFORM_ROLE_CAPABILITY_MATRIX.length).toBe(
      PLATFORM_STAFF_ROLES.length
    );
    for (const row of PLATFORM_ROLE_CAPABILITY_MATRIX) {
      expect(row.capabilities.length).toBeGreaterThan(0);
      expect(
        CONTROL_PLANE_CAPABILITIES.some((c) => c.id === row.capabilities[0].id)
      ).toBe(true);
    }
  });

  it("resolves paths to capabilities including nested prefixes", () => {
    expect(resolveCapabilityForPath("/platform")?.id).toBe("command-center");
    expect(resolveCapabilityForPath("/platform/tenants")?.id).toBe("tenants");
    expect(resolveCapabilityForPath("/platform/tenants/abc")?.id).toBe(
      "tenants"
    );
    expect(resolveCapabilityForPath("/platform/security/")?.id).toBe(
      "security"
    );
    expect(resolveCapabilityForPath("/not-a-platform-path")).toBeNull();
  });
});
