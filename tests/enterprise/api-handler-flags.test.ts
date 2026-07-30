import { describe, it, expect } from "vitest";
import {
  DEFAULT_FLAGS,
  isFlagEnabled,
  type FlagMap,
} from "@/lib/platform/flags";
import {
  governAiAction,
  isAiRestrictedAction,
  AI_RESTRICTED_ACTIONS,
} from "@/lib/ai/governance";
import {
  checkLoginGuardMemory,
  recordLoginFailureMemory,
  recordLoginSuccessMemory,
} from "@/lib/security/login-guard";
import {
  tenantCacheKey,
  tenantStoragePrefix,
  assertSameCompany,
  type TenantScope,
} from "@/lib/tenant/context";
import { newCorrelationId } from "@/lib/observability/logger";
import { readIdempotencyKey } from "@/lib/api/idempotency";

describe("feature flags", () => {
  it("defaults include security and payroll server flags", () => {
    expect(DEFAULT_FLAGS["security.dual_control"]).toBe(true);
    expect(DEFAULT_FLAGS["payroll.server_mutations"]).toBe(true);
    expect(isFlagEnabled(DEFAULT_FLAGS, "ai.copilot")).toBe(true);
  });

  it("respects explicit false", () => {
    const flags: FlagMap = { "ai.copilot": false };
    expect(isFlagEnabled(flags, "ai.copilot")).toBe(false);
  });
});

describe("AI governance", () => {
  it("blocks payroll release without human approval", () => {
    const d = governAiAction({ action: "payroll.release" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.requiresHumanApproval).toBe(true);
  });

  it("allows advise actions", () => {
    const d = governAiAction({ action: "report.summarize" });
    expect(d.allowed).toBe(true);
  });

  it("lists restricted money/identity actions", () => {
    expect(isAiRestrictedAction("identity.provision")).toBe(true);
    expect(AI_RESTRICTED_ACTIONS.size).toBeGreaterThan(5);
  });
});

describe("login guard", () => {
  it("locks after repeated failures", () => {
    const email = `locktest-${Date.now()}@example.com`;
    const ip = "203.0.113.9";
    for (let i = 0; i < 4; i++) {
      const r = recordLoginFailureMemory(email, ip);
      expect(r.allowed).toBe(true);
    }
    const locked = recordLoginFailureMemory(email, ip);
    expect(locked.allowed).toBe(false);
    const check = checkLoginGuardMemory(email, ip);
    expect(check.allowed).toBe(false);
    recordLoginSuccessMemory(email, ip);
    expect(checkLoginGuardMemory(email, ip).allowed).toBe(true);
  });
});

describe("tenant context", () => {
  const scope: TenantScope = {
    tenantId: "t1",
    companyId: "c1",
    userId: "u1",
    isPlatformAdmin: false,
  };

  it("namespaces cache and storage", () => {
    expect(tenantCacheKey(scope, "kpi", "ar")).toContain("t:t1:c:c1");
    expect(tenantStoragePrefix(scope, "invoices", "a.pdf")).toBe(
      "t1/c1/invoices/a.pdf"
    );
  });

  it("assertSameCompany throws on mismatch", () => {
    expect(() => assertSameCompany(scope, "c2")).toThrow(/outside active company/);
    expect(() => assertSameCompany(scope, "c1")).not.toThrow();
  });
});

describe("correlation + idempotency helpers", () => {
  it("generates correlation ids", () => {
    expect(newCorrelationId().length).toBeGreaterThan(8);
  });

  it("reads idempotency key from headers", () => {
    const req = new Request("http://localhost/api/x", {
      headers: { "Idempotency-Key": "abc12345-test-key" },
    });
    expect(readIdempotencyKey(req)).toBe("abc12345-test-key");
  });
});
