/**
 * Mandatory request isolation: every business request must resolve and
 * validate tenant_id + company_id (+ branch_id when applicable).
 *
 * Use at API boundaries alongside RLS and scoped-admin.
 */

import type { AuthedContext } from "@/lib/security/api-auth";
import {
  assertTenantAndCompany,
  type TenantScope,
  scopeFromAuth,
} from "@/lib/tenant/context";

export type IsolationIds = {
  tenant_id?: string | null;
  company_id?: string | null;
  branch_id?: string | null;
};

export class IsolationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MISSING_TENANT"
      | "MISSING_COMPANY"
      | "CROSS_TENANT"
      | "CROSS_COMPANY"
      | "CROSS_BRANCH" = "CROSS_TENANT"
  ) {
    super(message);
    this.name = "IsolationError";
  }
}

/**
 * Reject client-supplied tenant/company when they disagree with session.
 * Platform elevated staff may omit filters for break-glass only.
 */
export function assertRequestIsolation(
  ctx: AuthedContext,
  client?: IsolationIds,
  opts?: { requireBranch?: boolean }
): TenantScope {
  const scope = scopeFromAuth(ctx);

  if (scope.isElevated || ctx.isPlatformAdmin) {
    // Platform staff: never take tenant_id from untrusted body as authority
    // for write paths; elevation is explicit.
    return scope;
  }

  if (!scope.companyId) {
    throw new IsolationError(
      "company_id required on session",
      "MISSING_COMPANY"
    );
  }

  // Prefer session company; reject spoofed company_id
  if (
    client?.company_id &&
    String(client.company_id) !== String(scope.companyId)
  ) {
    throw new IsolationError(
      "company_id does not match active company",
      "CROSS_COMPANY"
    );
  }

  if (
    client?.tenant_id &&
    scope.tenantId &&
    String(client.tenant_id) !== String(scope.tenantId)
  ) {
    throw new IsolationError(
      "tenant_id does not match active tenant",
      "CROSS_TENANT"
    );
  }

  if (opts?.requireBranch && !client?.branch_id) {
    throw new IsolationError(
      "branch_id is required for this operation",
      "CROSS_BRANCH"
    );
  }

  return scope;
}

/** Stamp write payloads with session ownership (never trust client). */
export function stampIsolationFields(
  scope: TenantScope,
  row: Record<string, unknown>,
  opts?: { branchId?: string | null }
): Record<string, unknown> {
  const out = { ...row };
  delete out.tenant_id;
  delete out.company_id;
  out.company_id = scope.companyId;
  if (scope.tenantId) out.tenant_id = scope.tenantId;
  if (opts?.branchId) out.branch_id = opts.branchId;
  return out;
}

/** Validate a loaded row for list/get responses. */
export function assertRowIsolation(
  scope: TenantScope,
  row: IsolationIds,
  label = "record"
): void {
  assertTenantAndCompany(
    scope,
    { tenant_id: row.tenant_id, company_id: row.company_id },
    label
  );
}

/** AI / search / reporting context must never mix tenants. */
export function assertAiContextIsolation(
  scope: TenantScope,
  contextTenantId: string | null | undefined
): void {
  if (scope.isElevated) return;
  if (!scope.tenantId) return;
  if (
    contextTenantId &&
    String(contextTenantId) !== String(scope.tenantId)
  ) {
    throw new IsolationError(
      "AI context cannot cross tenant boundary",
      "CROSS_TENANT"
    );
  }
}

export function isolationNamespaces(scope: TenantScope) {
  const t = scope.tenantId || "shared";
  const c = scope.companyId;
  return {
    storage: `${t}/${c}`,
    search: `tenant:${t}:company:${c}`,
    cache: `t:${t}:c:${c}`,
    ai: `ai:t:${t}:c:${c}`,
    reporting: `rpt:t:${t}:c:${c}`,
  };
}
