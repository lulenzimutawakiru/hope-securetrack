import { describe, expect, it } from "vitest";
import {
  assertRequestIsolation,
  IsolationError,
  stampIsolationFields,
  assertAiContextIsolation,
  isolationNamespaces,
} from "@/lib/tenant/request-isolation";
import type { AuthedContext } from "@/lib/security/api-auth";

function fakeCtx(over: Partial<AuthedContext> = {}): AuthedContext {
  return {
    user: { id: "u1" } as AuthedContext["user"],
    profile: {
      id: "u1",
      company_id: "c1",
      tenant_id: "t1",
    },
    roleSlug: "user",
    permissions: ["dashboard.view"],
    companyId: "c1",
    tenantId: "t1",
    isPlatformAdmin: false,
    isSuperAdmin: false,
    isElevated: false,
    mfaOk: true,
    isPrivilegedRole: false,
    ...over,
  };
}

describe("request isolation", () => {
  it("accepts matching session scope", () => {
    const scope = assertRequestIsolation(fakeCtx(), {
      tenant_id: "t1",
      company_id: "c1",
    });
    expect(scope.companyId).toBe("c1");
    expect(scope.tenantId).toBe("t1");
  });

  it("rejects cross-company spoof", () => {
    expect(() =>
      assertRequestIsolation(fakeCtx(), {
        company_id: "other-company",
      })
    ).toThrow(IsolationError);
  });

  it("rejects cross-tenant spoof", () => {
    expect(() =>
      assertRequestIsolation(fakeCtx(), {
        tenant_id: "tenant-b",
        company_id: "c1",
      })
    ).toThrow(IsolationError);
  });

  it("stamps company and tenant on writes", () => {
    const scope = assertRequestIsolation(fakeCtx());
    const row = stampIsolationFields(scope, {
      name: "x",
      company_id: "spoof",
      tenant_id: "spoof",
    });
    expect(row.company_id).toBe("c1");
    expect(row.tenant_id).toBe("t1");
    expect(row.name).toBe("x");
  });

  it("blocks AI cross-tenant context", () => {
    const scope = assertRequestIsolation(fakeCtx());
    expect(() => assertAiContextIsolation(scope, "tenant-b")).toThrow(
      IsolationError
    );
    expect(() => assertAiContextIsolation(scope, "t1")).not.toThrow();
  });

  it("builds isolation namespaces", () => {
    const ns = isolationNamespaces(assertRequestIsolation(fakeCtx()));
    expect(ns.storage).toBe("t1/c1");
    expect(ns.ai).toContain("t1");
    expect(ns.reporting).toContain("c1");
  });
});
