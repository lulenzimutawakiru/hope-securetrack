import { describe, it, expect } from "vitest";
import {
  assertSameCompany,
  assertTenantAndCompany,
  tenantStoragePrefix,
  tenantCacheKey,
  type TenantScope,
} from "@/lib/tenant/context";
import {
  assertStoragePathInScope,
  buildIsolatedStoragePath,
  parseStoragePath,
} from "@/lib/storage/isolation";
import { canPurge } from "@/lib/tenant/offboarding";

const scope: TenantScope = {
  tenantId: "t-11111111-1111-1111-1111-111111111111",
  companyId: "c-22222222-2222-2222-2222-222222222222",
  userId: "u-1",
  isPlatformAdmin: false,
};

describe("assertSameCompany", () => {
  it("allows matching company", () => {
    expect(() => assertSameCompany(scope, scope.companyId)).not.toThrow();
  });

  it("rejects foreign company", () => {
    expect(() => assertSameCompany(scope, "other-company")).toThrow(
      /outside active company/
    );
  });

  it("elevated bypasses", () => {
    expect(() =>
      assertSameCompany({ ...scope, isElevated: true }, "other")
    ).not.toThrow();
  });
});

describe("assertTenantAndCompany", () => {
  it("rejects cross-tenant when both set", () => {
    expect(() =>
      assertTenantAndCompany(
        scope,
        { tenant_id: "other-tenant", company_id: scope.companyId },
        "invoice"
      )
    ).toThrow(/tenant boundary/);
  });

  it("allows same tenant + company", () => {
    expect(() =>
      assertTenantAndCompany(
        scope,
        { tenant_id: scope.tenantId, company_id: scope.companyId },
        "invoice"
      )
    ).not.toThrow();
  });

  it("rejects missing tenant when REQUIRE_TENANT_ON_ROWS=true", () => {
    const prev = process.env.REQUIRE_TENANT_ON_ROWS;
    process.env.REQUIRE_TENANT_ON_ROWS = "true";
    try {
      expect(() =>
        assertTenantAndCompany(
          scope,
          { tenant_id: null, company_id: scope.companyId },
          "legacy"
        )
      ).toThrow(/missing tenant_id/);
    } finally {
      if (prev === undefined) delete process.env.REQUIRE_TENANT_ON_ROWS;
      else process.env.REQUIRE_TENANT_ON_ROWS = prev;
    }
  });
});

describe("storage isolation", () => {
  it("builds tenant/company prefix paths", () => {
    const p = buildIsolatedStoragePath(scope, "docs", "a.pdf");
    expect(p).toBe(
      `${scope.tenantId}/${scope.companyId}/docs/a.pdf`
    );
    expect(tenantStoragePrefix(scope, "docs")).toContain(scope.companyId);
  });

  it("rejects path traversal segments", () => {
    expect(() => buildIsolatedStoragePath(scope, "../etc/passwd")).toThrow(
      /Unsafe/
    );
  });

  it("assertStoragePathInScope rejects foreign paths", () => {
    expect(() =>
      assertStoragePathInScope(scope, "other-tenant/other-co/file.pdf")
    ).toThrow(/outside tenant/);
  });

  it("parseStoragePath extracts parts", () => {
    const parsed = parseStoragePath("t1/c1/folder/file.txt");
    expect(parsed).toEqual({
      tenantId: "t1",
      companyId: "c1",
      rest: "folder/file.txt",
    });
  });

  it("tenantCacheKey namespaces keys", () => {
    expect(tenantCacheKey(scope, "kpi", "dashboard")).toContain(
      scope.companyId
    );
  });
});

describe("tenant offboarding canPurge", () => {
  it("blocks legal hold", () => {
    expect(canPurge({ legal_hold: true }).ok).toBe(false);
  });

  it("blocks future purge_after", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(canPurge({ legal_hold: false, purge_after: future }).ok).toBe(
      false
    );
  });

  it("allows when hold clear and retention elapsed", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(canPurge({ legal_hold: false, purge_after: past }).ok).toBe(true);
  });
});
