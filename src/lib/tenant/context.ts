/**
 * Tenant-aware request context helpers for server routes and jobs.
 * Isolation remains company_id + RLS; tenant_id is for SaaS control plane.
 */

import type { AuthedContext } from "@/lib/security/api-auth";

export type TenantScope = {
  tenantId: string | null;
  companyId: string;
  userId: string;
  isPlatformAdmin: boolean;
  isElevated?: boolean;
};

export function scopeFromAuth(ctx: AuthedContext): TenantScope {
  return {
    tenantId: ctx.tenantId || ctx.profile.tenant_id || null,
    companyId: ctx.companyId,
    userId: ctx.user.id,
    isPlatformAdmin: ctx.isPlatformAdmin,
    isElevated: ctx.isElevated,
  };
}

/**
 * Ensure a row's company_id matches the active scope (defense in depth beyond RLS).
 */
export function assertSameCompany(
  scope: TenantScope,
  rowCompanyId: string | null | undefined,
  label = "record"
): void {
  if (scope.isElevated) return;
  if (!rowCompanyId || String(rowCompanyId) !== String(scope.companyId)) {
    throw new Error(`Forbidden: ${label} is outside active company scope`);
  }
}

/**
 * Dual-key isolation check: tenant AND company.
 */
export function assertTenantAndCompany(
  scope: TenantScope,
  row: { tenant_id?: string | null; company_id?: string | null },
  label = "record"
): void {
  if (scope.isElevated) return;
  if (row.tenant_id && scope.tenantId && String(row.tenant_id) !== String(scope.tenantId)) {
    throw new Error(`Forbidden: ${label} is outside tenant boundary`);
  }
  assertSameCompany(scope, row.company_id, label);
}

/**
 * Namespace cache keys / storage paths by tenant + company.
 */
export function tenantCacheKey(
  scope: TenantScope,
  namespace: string,
  key: string
): string {
  const t = scope.tenantId || "no-tenant";
  return `t:${t}:c:${scope.companyId}:${namespace}:${key}`;
}

/**
 * Object storage path prefix — always tenant/company first.
 */
export function tenantStoragePrefix(scope: TenantScope, ...parts: string[]): string {
  const t = scope.tenantId || "shared";
  return [t, scope.companyId, ...parts.map((p) => p.replace(/^\/+/, ""))].join("/");
}

/**
 * Strip fields that must never leave tenant boundary in AI prompts / exports.
 */
export function redactCrossTenantFields<T extends Record<string, unknown>>(
  row: T,
  scope: TenantScope
): T {
  const out = { ...row };
  if (out.company_id && String(out.company_id) !== scope.companyId) {
    throw new Error("Cross-tenant field redaction blocked");
  }
  // Never put service keys / tokens into AI context
  delete out.access_token;
  delete out.access_token_hash;
  delete out.push_token;
  delete out.push_token_hash;
  delete out.service_role_key;
  delete out.password_hash;
  return out;
}
