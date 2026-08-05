import { describe, expect, it } from "vitest";
import {
  ACCESS_MATRIX,
  CONTROL_PLANE_CAPABILITIES,
  ERP_MODULE_CATALOG,
  PROVISIONING_WORKFLOW,
  SUBSCRIPTION_PLANS,
  getPlanEntitlements,
} from "@/lib/platform/control-plane-registry";
import {
  generateTenantEncryptionKey,
  tenantDomainFromSlug,
} from "@/lib/platform/tenant-crypto";

describe("control plane registry", () => {
  it("covers all three layers", () => {
    const layers = new Set(CONTROL_PLANE_CAPABILITIES.map((c) => c.layer));
    expect(layers.has("platform")).toBe(true);
    expect(layers.has("tenant")).toBe(true);
    expect(layers.has("company")).toBe(true);
  });

  it("denies tenant roles in access matrix for CPanel", () => {
    const tenantOwner = ACCESS_MATRIX.find((r) => r.role === "Tenant Owner");
    const normal = ACCESS_MATRIX.find((r) => r.role === "Normal User");
    expect(tenantOwner?.access).toMatch(/Own tenant only|not CPanel/i);
    expect(normal?.access).toMatch(/No CPanel/i);
  });

  it("defines four commercial plans with limits", () => {
    expect(SUBSCRIPTION_PLANS.map((p) => p.plan_code)).toEqual([
      "starter",
      "professional",
      "enterprise",
      "government",
    ]);
    const ent = getPlanEntitlements("enterprise");
    expect(ent.max_users).toBeGreaterThan(100);
    expect(ent.modules).toBe("all");
    expect(getPlanEntitlements("unknown").plan_code).toBe("starter");
  });

  it("lists core ERP modules including AI assistant", () => {
    expect(ERP_MODULE_CATALOG).toContain("finance");
    expect(ERP_MODULE_CATALOG).toContain("payroll");
    expect(ERP_MODULE_CATALOG).toContain("manufacturing");
    expect(ERP_MODULE_CATALOG).toContain("ai_assistant");
  });

  it("documents provisioning workflow order", () => {
    expect(PROVISIONING_WORKFLOW[0]).toBe("Create Tenant");
    expect(PROVISIONING_WORKFLOW[PROVISIONING_WORKFLOW.length - 1]).toBe(
      "Tenant Ready"
    );
    expect(PROVISIONING_WORKFLOW).toContain("Create Admin Account");
    expect(PROVISIONING_WORKFLOW).toContain("Send Welcome Email");
  });
});

describe("tenant crypto", () => {
  it("generates unique key material with fingerprint", () => {
    const a = generateTenantEncryptionKey();
    const b = generateTenantEncryptionKey();
    expect(a.key_id).not.toBe(b.key_id);
    expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(a.secret_b64.length).toBeGreaterThan(20);
    expect(a.algorithm).toBe("AES-256-GCM");
  });

  it("builds tenant domain from slug", () => {
    expect(tenantDomainFromSlug("hope-design")).toBe(
      "hope-design.securetrack.com"
    );
    expect(tenantDomainFromSlug("Company B!!")).toMatch(
      /^company-b\.securetrack\.com$/
    );
  });
});
