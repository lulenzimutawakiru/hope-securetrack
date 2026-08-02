/**
 * P0: Single source of tenant context for all server-side business logic.
 * Never trust client-supplied tenant_id or company_id as authority.
 */

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { resolveFeatureFlags, type FlagMap } from "@/lib/platform/flags";
import { authError } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";

export type TenantContext = {
  user: User;
  userId: string;
  tenantId: string;
  companyId: string;
  branchId: string | null;
  roleId: string | null;
  roleSlug: string | null;
  permissions: string[];
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
  isElevated: boolean;
  mfaOk: boolean;
  subscription: Record<string, unknown> | null;
  featureFlags: FlagMap;
  email: string | null;
};

export class TenantIsolationError extends Error {
  status = 403;
  code = "TENANT_ISOLATION";
  constructor(message: string, code = "TENANT_ISOLATION") {
    super(message);
    this.name = "TenantIsolationError";
    this.code = code;
  }
}

/**
 * Reject client payloads that attempt to set tenant/company identity.
 * Call after parsing body for mutating APIs.
 */
export function rejectClientTenantSpoof(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const b = body as Record<string, unknown>;
  // Soft: strip and never use — hard reject if explicitly spoofing foreign keys as authority
  const forbiddenAsAuthority = ["tenant_id", "tenantId"];
  for (const k of forbiddenAsAuthority) {
    if (k in b && b[k] != null && b[k] !== "") {
      // Allow if matches session later; for now log and strip
      delete b[k];
    }
  }
  // company_id may appear on inserts — server must overwrite with session company
}

/**
 * Overwrite identity fields on insert/update payloads from session context.
 */
type TenantOwnedRow<T extends Record<string, unknown>> = T & {
  tenant_id: string;
  company_id: string;
  created_by?: unknown;
  updated_by?: string;
};

export function applyTenantOwnership<T extends Record<string, unknown>>(
  row: T,
  ctx: TenantContext,
  opts?: { setActor?: boolean }
): TenantOwnedRow<T> {
  return {
    ...row,
    tenant_id: ctx.tenantId,
    company_id: ctx.companyId,
    ...(opts?.setActor !== false
      ? {
          created_by: row.created_by ?? ctx.userId,
          updated_by: ctx.userId,
        }
      : {}),
  } as TenantOwnedRow<T>;
}

/**
 * Assert a loaded row belongs to the active tenant (and optionally company).
 */
export function assertTenantRow(
  ctx: TenantContext,
  row: {
    tenant_id?: string | null;
    company_id?: string | null;
  } | null | undefined,
  label = "record"
): void {
  if (!row) {
    throw new TenantIsolationError(`${label} not found`, "NOT_FOUND");
  }
  if (row.tenant_id && String(row.tenant_id) !== ctx.tenantId && !ctx.isElevated) {
    log.warn("tenant.isolation.denied", {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      rowTenant: row.tenant_id,
      label,
      action: "assertTenantRow",
    });
    throw new TenantIsolationError(
      `Forbidden: ${label} outside tenant boundary`,
      "CROSS_TENANT"
    );
  }
  if (row.company_id && String(row.company_id) !== ctx.companyId && !ctx.isElevated) {
    // Same tenant, other company — only if membership would allow; default deny for active-company model
    throw new TenantIsolationError(
      `Forbidden: ${label} outside active company`,
      "CROSS_COMPANY"
    );
  }
}

/**
 * Load and verify tenant context from authenticated session.
 * Fail closed if tenant/company missing or membership invalid.
 */
export async function getTenantContext(opts?: {
  requirePermissions?: string[];
  allowPlatformAdmin?: boolean;
  /** When true, requires active platform elevation for platform admins doing cross-tenant work */
  requireElevation?: boolean;
}): Promise<
  { ctx: TenantContext } | { response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: authError("Sign in required", 401) };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "id,company_id,tenant_id,active_company_id,role_id,is_platform_admin,email,mfa_enabled,require_mfa,mfa_enforced,roles!user_profiles_role_id_fkey(slug)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { response: authError("No user profile", 403, "NO_PROFILE") };
  }

  const companyId = String(
    profile.active_company_id || profile.company_id || ""
  );
  if (!companyId) {
    return { response: authError("No active company context", 403, "NO_COMPANY") };
  }

  // Verify company membership (defense in depth vs RLS)
  const { data: membershipOk } = await supabase.rpc("user_has_company_access", {
    p_company_id: companyId,
  });

  // Fallback check without RPC if not available
  let hasAccess = Boolean(membershipOk);
  if (membershipOk === null || membershipOk === undefined) {
    const { data: mem } = await supabase
      .from("user_company_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();
    hasAccess =
      Boolean(mem) ||
      String(profile.company_id) === companyId ||
      String(profile.active_company_id) === companyId;
  }

  if (!hasAccess) {
    log.warn("tenant.isolation.membership_denied", {
      userId: user.id,
      companyId,
    });
    return {
      response: authError("No membership for active company", 403, "NO_MEMBERSHIP"),
    };
  }

  // Resolve tenant from company (source of truth), not client
  const { data: company } = await supabase
    .from("companies")
    .select("id,tenant_id,name")
    .eq("id", companyId)
    .maybeSingle();

  const tenantId = String(
    company?.tenant_id || profile.tenant_id || ""
  );

  if (!tenantId) {
    // Last resort: fail closed in production; allow empty only with elevation
    return {
      response: authError(
        "Tenant context missing — company must belong to a tenant",
        403,
        "NO_TENANT"
      ),
    };
  }

  // Elevation status
  let isElevated = false;
  try {
    const { data: elev } = await supabase.rpc("is_platform_elevated");
    isElevated = Boolean(elev);
  } catch {
    isElevated = false;
  }

  const roleObj = profile.roles as { slug?: string } | null;
  const roleSlug = roleObj?.slug || null;
  const isSuperAdmin = roleSlug === "super_administrator";
  const isPlatformAdmin = Boolean(profile.is_platform_admin) || isSuperAdmin;

  if (opts?.requireElevation && isPlatformAdmin && !isElevated) {
    return {
      response: authError(
        "Platform elevation required (JIT break-glass with justification)",
        403,
        "ELEVATION_REQUIRED"
      ),
    };
  }

  let permissions: string[] = [];
  if (profile.role_id) {
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permissions(slug)")
      .eq("role_id", profile.role_id);
    permissions =
      rolePerms
        ?.map((rp) => {
          const p = rp.permissions as unknown as { slug: string } | null;
          return p?.slug;
        })
        .filter((s): s is string => Boolean(s)) ?? [];
  }

  if (opts?.requirePermissions?.length) {
    const allowAdmin = opts.allowPlatformAdmin !== false && isPlatformAdmin;
    const has = opts.requirePermissions.some((p) => permissions.includes(p));
    if (!allowAdmin && !has) {
      return {
        response: authError(
          `Missing permission: ${opts.requirePermissions.join(" or ")}`,
          403,
          "MISSING_PERMISSION"
        ),
      };
    }
  }

  // Sync profile tenant if drift
  if (profile.tenant_id !== tenantId) {
    try {
      await supabase
        .from("user_profiles")
        .update({ tenant_id: tenantId })
        .eq("id", user.id);
    } catch {
      /* non-blocking */
    }
  }

  const featureFlags = await resolveFeatureFlags(supabase, tenantId);

  let subscription: Record<string, unknown> | null = null;
  try {
    const { data: sub } = await supabase
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    subscription = (sub as Record<string, unknown>) || null;
  } catch {
    subscription = null;
  }

  const aal =
    (user as { aal?: string }).aal ||
    (user as { app_metadata?: { aal?: string } }).app_metadata?.aal;
  const mfaOk = Boolean(profile.mfa_enabled) || aal === "aal2";

  const ctx: TenantContext = {
    user,
    userId: user.id,
    tenantId,
    companyId,
    branchId: null,
    roleId: (profile.role_id as string) || null,
    roleSlug,
    permissions,
    isPlatformAdmin,
    isSuperAdmin,
    isElevated,
    mfaOk,
    subscription,
    featureFlags,
    email: (profile.email as string) || user.email || null,
  };

  return { ctx };
}

/** Tenant-scoped cache key */
export function tenantScopedKey(ctx: TenantContext, ...parts: string[]): string {
  return ["tenant", ctx.tenantId, "company", ctx.companyId, ...parts].join(":");
}

/** Storage path: tenant/company/module/... */
export function tenantFilePath(
  ctx: TenantContext,
  module: string,
  ...parts: string[]
): string {
  return [ctx.tenantId, ctx.companyId, module, ...parts]
    .map((p) => String(p).replace(/^\/+|\/+$/g, "").replace(/\.\./g, ""))
    .filter(Boolean)
    .join("/");
}
