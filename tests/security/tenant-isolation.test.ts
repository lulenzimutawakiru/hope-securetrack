/**
 * P0: Cross-tenant isolation unit tests (pure + policy contracts).
 * Live multi-user tests: tests/security/rls-live.test.ts with INTEGRATION_TESTS=true
 */
import { describe, it, expect } from "vitest";
import {
  assertTenantAndCompany,
  assertSameCompany,
  type TenantScope,
} from "@/lib/tenant/context";
import {
  applyTenantOwnership,
  assertTenantRow,
  rejectClientTenantSpoof,
  tenantFilePath,
  tenantScopedKey,
  TenantIsolationError,
  type TenantContext,
} from "@/lib/tenant/get-tenant-context";
import { assertJobTenantScope } from "@/lib/jobs/queue";
import { buildTenantSafeAiContext } from "@/lib/ai/governance";

const scopeA: TenantScope = {
  tenantId: "tenant-aaa",
  companyId: "company-aaa",
  userId: "user-a",
  isPlatformAdmin: false,
  isElevated: false,
};

const scopeB: TenantScope = {
  tenantId: "tenant-bbb",
  companyId: "company-bbb",
  userId: "user-b",
  isPlatformAdmin: false,
  isElevated: false,
};

const ctxA = {
  userId: "user-a",
  tenantId: "tenant-aaa",
  companyId: "company-aaa",
  isElevated: false,
} as TenantContext;

describe("tenant dual-key isolation", () => {
  it("allows same tenant+company rows", () => {
    expect(() =>
      assertTenantAndCompany(scopeA, {
        tenant_id: "tenant-aaa",
        company_id: "company-aaa",
      })
    ).not.toThrow();
  });

  it("blocks cross-tenant rows", () => {
    expect(() =>
      assertTenantAndCompany(scopeA, {
        tenant_id: "tenant-bbb",
        company_id: "company-aaa",
      })
    ).toThrow(/tenant boundary/);
  });

  it("blocks cross-company rows without elevation", () => {
    expect(() =>
      assertSameCompany(scopeA, "company-bbb")
    ).toThrow(/active company/);
  });

  it("elevation bypasses company check", () => {
    const elev = { ...scopeA, isElevated: true };
    expect(() => assertSameCompany(elev, "company-bbb")).not.toThrow();
  });
});

describe("assertTenantRow", () => {
  it("throws CROSS_TENANT for foreign tenant", () => {
    try {
      assertTenantRow(ctxA, {
        tenant_id: "tenant-bbb",
        company_id: "company-aaa",
      });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TenantIsolationError);
      expect((e as TenantIsolationError).code).toBe("CROSS_TENANT");
    }
  });

  it("throws CROSS_COMPANY for other company", () => {
    try {
      assertTenantRow(ctxA, {
        tenant_id: "tenant-aaa",
        company_id: "company-bbb",
      });
      expect.fail("should throw");
    } catch (e) {
      expect((e as TenantIsolationError).code).toBe("CROSS_COMPANY");
    }
  });
});

describe("client tenant spoof rejection", () => {
  it("strips tenant_id from body", () => {
    const body = { tenant_id: "evil-tenant", name: "x" };
    rejectClientTenantSpoof(body);
    expect(body.tenant_id).toBeUndefined();
    expect(body.name).toBe("x");
  });
});

describe("applyTenantOwnership", () => {
  it("forces session tenant and company", () => {
    const row = applyTenantOwnership(
      { name: "Invoice", tenant_id: "evil", company_id: "evil-co" },
      ctxA
    );
    expect(row.tenant_id).toBe("tenant-aaa");
    expect(row.company_id).toBe("company-aaa");
    expect(row.updated_by).toBe("user-a");
  });
});

describe("cache and storage scoping", () => {
  it("prefixes cache keys with tenant", () => {
    const k = tenantScopedKey(ctxA, "users", "list");
    expect(k.startsWith("tenant:tenant-aaa:company:company-aaa:")).toBe(true);
    expect(k).not.toContain("tenant-bbb");
  });

  it("builds tenant/company file paths", () => {
    const p = tenantFilePath(ctxA, "documents", "a.pdf");
    expect(p).toBe("tenant-aaa/company-aaa/documents/a.pdf");
  });
});

describe("job tenant scope", () => {
  it("rejects jobs without tenant+company", () => {
    expect(() =>
      assertJobTenantScope({ jobType: "notification.dispatch", payload: {} })
    ).toThrow(/tenant_id and company_id/);
  });

  it("accepts scoped jobs", () => {
    expect(() =>
      assertJobTenantScope({
        jobType: "notification.dispatch",
        tenantId: "t1",
        companyId: "c1",
      })
    ).not.toThrow();
  });
});

describe("AI tenant context", () => {
  it("redacts foreign company rows", () => {
    const safe = buildTenantSafeAiContext(scopeA, [
      { id: "1", company_id: "company-aaa", name: "ok" },
      { id: "2", company_id: "company-bbb", name: "leak" },
    ]);
    expect(safe[0]).toMatchObject({ name: "ok" });
    expect(safe[1]).toEqual({ error: "redacted_cross_tenant" });
  });

  it("never mixes tenant B data into tenant A prompts", () => {
    const rows = buildTenantSafeAiContext(scopeB, [
      { company_id: "company-aaa", secret: "nope" },
    ]);
    expect(rows[0]).toEqual({ error: "redacted_cross_tenant" });
  });
});

describe("isolation matrix contract", () => {
  const cases = [
    { from: scopeA, toTenant: "tenant-bbb", expectDeny: true },
    { from: scopeA, toTenant: "tenant-aaa", expectDeny: false },
    { from: scopeB, toTenant: "tenant-aaa", expectDeny: true },
  ];

  for (const c of cases) {
    it(`user ${c.from.tenantId} → data ${c.toTenant}`, () => {
      const row = {
        tenant_id: c.toTenant,
        company_id: c.from.companyId,
      };
      if (c.expectDeny) {
        expect(() => assertTenantAndCompany(c.from, row)).toThrow();
      } else {
        expect(() => assertTenantAndCompany(c.from, row)).not.toThrow();
      }
    });
  }
});
