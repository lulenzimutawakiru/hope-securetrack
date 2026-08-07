/**
 * Server-side authorization helpers for API routes.
 * Always fail closed. Never trust client-supplied actor_id / company_id.
 *
 * Performance: requireApiAuth resolves the full authorization context in the
 * fewest possible round trips:
 *
 *   1. supabase.auth.getUser()                    -> 1 Supabase Auth call
 *   2. get_api_context() RPC (migration           -> 1 DB call returning the
 *      20260823000001)                              profile, role slug,
 *                                                   permissions, company,
 *                                                   tenant, membership, and
 *                                                   elevation state
 *   3. MFA assurance + verified factors           -> 2 parallel calls, only
 *                                                   when this route actually
 *                                                   requires MFA for the role
 *
 * Environments without the RPC (e.g. a not-yet-migrated local database) fall
 * back to the original sequential query chain.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  resolvePlatformRole,
  type PlatformStaffRole,
} from "@/lib/platform/staff";
import {
  mfaEnforcementEnabled as mfaEnvEnforced,
  resolveMfaStatus,
  type MfaStatus,
} from "@/lib/security/mfa";

/** Roles that must complete MFA when MFA_ENFORCE_PRIVILEGED=true (default in production) */
export const PRIVILEGED_ROLE_SLUGS = new Set([
  "super_administrator",
  "managing_director",
  "finance_manager",
  "hr_manager",
  "payroll_officer",
  "auditor",
  "security_officer",
  "it_administrator",
]);

export type AuthedContext = {
  user: User;
  profile: {
    id: string;
    company_id: string;
    tenant_id?: string | null;
    active_company_id?: string | null;
    role_id?: string | null;
    is_platform_admin?: boolean | null;
    email?: string | null;
    mfa_enabled?: boolean | null;
    require_mfa?: boolean | null;
    mfa_enforced?: boolean | null;
  };
  roleSlug: string | null;
  permissions: string[];
  companyId: string;
  /** Resolved tenant - never from client body */
  tenantId: string | null;
  isPlatformAdmin: boolean;
  /** Granular control-plane staff role (owner|cto|security|devops|compliance). */
  platformRole: PlatformStaffRole | null;
  isSuperAdmin: boolean;
  /** JIT break-glass elevation active */
  isElevated: boolean;
  mfaOk: boolean;
  isPrivilegedRole: boolean;
};

export function authError(
  message: string,
  status = 401,
  code?: string
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: code || (status === 403 ? "FORBIDDEN" : "UNAUTHORIZED"),
        message,
      },
    },
    { status }
  );
}

/**
 * MFA for privileged roles.
 * - Production: ON by default (set MFA_ENFORCE_PRIVILEGED=false to disable)
 * - Non-production: OFF unless MFA_ENFORCE_PRIVILEGED=true
 */
export function mfaEnforcementEnabled(): boolean {
  return mfaEnvEnforced();
}

/** Raw profile row resolved by either the fast RPC or the legacy chain. */
type ProfileRow = {
  id: string;
  company_id: string;
  tenant_id?: string | null;
  active_company_id?: string | null;
  role_id?: string | null;
  is_platform_admin?: boolean | null;
  platform_role?: string | null;
  email?: string | null;
  mfa_enabled?: boolean | null;
  require_mfa?: boolean | null;
  mfa_enforced?: boolean | null;
  roles?: { slug?: string } | null;
  role_slug?: string | null;
};

/** Normalized authorization data shared by the fast and fallback paths. */
type AuthRaw = {
  profile: ProfileRow;
  roleSlug: string | null;
  permissions: string[];
  companyId: string;
  tenantId: string | null;
  /** false = denied; null = could not be determined (fallback to profile match) */
  hasAccess: boolean | null;
  isElevated: boolean;
};

type AuthOptions = {
  permissions?: string[];
  allowPlatformAdmin?: boolean;
  requireMfa?: boolean | "privileged";
  skipMfaCheck?: boolean;
};

/**
 * Resolve profile + role + permissions + company + tenant + membership +
 * elevation in the fewest round trips. Falls back to the legacy sequential
 * chain when the get_api_context RPC is unavailable.
 */
async function loadAuthContext(
  supabase: SupabaseClient,
  userId: string
): Promise<AuthRaw | null> {
  // Fast path: single-RPC context (migration 20260823000001).
  try {
    const { data, error } = await supabase.rpc("get_api_context");
    if (!error && data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as {
        profile?: ProfileRow | null;
        permissions?: unknown;
        company_id?: string | null;
        tenant_id?: string | null;
        has_access?: unknown;
        is_elevated?: unknown;
      };
      const profile =
        d.profile && typeof d.profile === "object" ? d.profile : null;
      if (!profile) return null;
      const roleSlug = profile.role_slug || profile.roles?.slug || null;
      const companyId = String(
        d.company_id || profile.active_company_id || profile.company_id || ""
      );
      const tenantId = String(d.tenant_id || profile.tenant_id || "") || null;
      return {
        profile: { ...profile, role_slug: roleSlug || undefined },
        roleSlug,
        permissions: Array.isArray(d.permissions)
          ? d.permissions.filter((p): p is string => typeof p === "string")
          : [],
        companyId,
        tenantId,
        hasAccess: typeof d.has_access === "boolean" ? d.has_access : null,
        isElevated: Boolean(d.is_elevated),
      };
    }
  } catch {
    /* RPC unavailable - fall through to the legacy chain */
  }

  // Legacy fallback chain (kept for environments without the RPC migration).
  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "id,company_id,tenant_id,active_company_id,role_id,is_platform_admin,platform_role,email,mfa_enabled,require_mfa,mfa_enforced,roles!user_profiles_role_id_fkey(slug)"
    )
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const roleObj = (profile as ProfileRow).roles as { slug?: string } | null;
  const roleSlug = roleObj?.slug || null;

  let permissions: string[] = [];
  if ((profile as ProfileRow).role_id) {
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permissions(slug)")
      .eq("role_id", (profile as ProfileRow).role_id);
    permissions =
      rolePerms
        ?.map((rp: unknown) => {
          const p = (rp as { permissions?: { slug?: string } | null })
            .permissions;
          return p?.slug;
        })
        .filter((s: unknown): s is string => Boolean(s)) ?? [];
  }

  const companyId = String(
    (profile as ProfileRow).active_company_id ||
      (profile as ProfileRow).company_id
  );

  // Resolve tenant from company (source of truth) - never from request body
  let tenantId: string | null = (profile as ProfileRow).tenant_id || null;
  try {
    const { data: co } = await supabase
      .from("companies")
      .select("tenant_id")
      .eq("id", companyId)
      .maybeSingle();
    if (co?.tenant_id) tenantId = String(co.tenant_id);
  } catch {
    /* keep profile tenant */
  }

  // Membership check - fail closed for cross-company
  let hasAccess: boolean | null = null;
  try {
    const { data: access } = await supabase.rpc("user_has_company_access", {
      p_company_id: companyId,
    });
    if (typeof access === "boolean") hasAccess = access;
  } catch {
    hasAccess = null;
  }

  let isElevated = false;
  try {
    const { data: elev } = await supabase.rpc("is_platform_elevated");
    isElevated = Boolean(elev);
  } catch {
    isElevated = false;
  }

  return {
    profile: { ...(profile as ProfileRow), role_slug: roleSlug || undefined },
    roleSlug,
    permissions,
    companyId,
    tenantId,
    hasAccess,
    isElevated,
  };
}

async function finalizeAuth(
  supabase: SupabaseClient,
  user: User,
  raw: AuthRaw,
  opts?: AuthOptions
): Promise<{ ctx: AuthedContext } | { response: NextResponse }> {
  const { profile } = raw;
  const roleSlug = raw.roleSlug;
  const isSuperAdmin = roleSlug === "super_administrator";
  // Platform admin is SecureTrack-staff only: the profile must be explicitly
  // flagged AND carry no tenant. Tenant super admins are NOT platform admins.
  const isStaffPlatformAdmin =
    Boolean(profile.is_platform_admin) && !profile.tenant_id;
  const isPlatformAdmin = isStaffPlatformAdmin;
  const isPrivilegedRole =
    isPlatformAdmin ||
    (roleSlug ? PRIVILEGED_ROLE_SLUGS.has(roleSlug) : false) ||
    Boolean(profile.require_mfa) ||
    Boolean(profile.mfa_enforced);

  let permissions = raw.permissions;

  // Control-plane (platform./tenant.) permissions are honored only for
  // SecureTrack staff. Strip them from tenant users even if a role row grants
  // them, so tenant super admins can never hold platform entitlements.
  if (!isStaffPlatformAdmin) {
    permissions = permissions.filter(
      (p) => !p.startsWith("platform.") && !p.startsWith("tenant.")
    );
  }

  // Membership check - fail closed for cross-company
  if (raw.hasAccess === false) {
    return {
      response: authError(
        "No membership for active company",
        403,
        "NO_MEMBERSHIP"
      ),
    };
  }
  if (raw.hasAccess === null) {
    const home = String(profile.company_id);
    const active = String(profile.active_company_id || home);
    if (raw.companyId !== home && raw.companyId !== active) {
      return {
        response: authError("Company access denied", 403, "NO_MEMBERSHIP"),
      };
    }
  }

  // MFA - only contact Supabase Auth when this route actually needs it.
  // (getAssuranceLevel + listFactors are 2 extra network calls per request.)
  const needMfaCheck =
    !opts?.skipMfaCheck &&
    (opts?.requireMfa === true ||
      (mfaEnforcementEnabled() && isPrivilegedRole));

  let mfaStatus: MfaStatus | null = null;
  if (needMfaCheck) {
    mfaStatus = await resolveMfaStatus(supabase, user, {
      mfa_enabled: Boolean(profile.mfa_enabled),
      require_mfa: Boolean(profile.require_mfa),
      mfa_enforced: Boolean(profile.mfa_enforced),
      is_platform_admin: Boolean(profile.is_platform_admin),
      tenant_id: raw.tenantId,
      roleSlug,
    });
    if (!mfaStatus.mfaSatisfiedForPrivileged) {
      const message = mfaStatus.hasVerifiedFactor
        ? "Multi-factor verification required. Open /mfa to enter your authenticator code."
        : "Multi-factor authentication is required for your role. Enroll an authenticator under Identity -> Security / MFA.";
      return {
        response: authError(message, 403, "MFA_REQUIRED"),
      };
    }
  }
  const mfaOk = mfaStatus ? mfaStatus.aal2 || !mfaStatus.hasVerifiedFactor : true;

  if (opts?.permissions?.length) {
    const allowAdmin = opts.allowPlatformAdmin !== false && isPlatformAdmin;
    const has = opts.permissions.some((p) => permissions.includes(p));
    if (!allowAdmin && !has) {
      return {
        response: authError(
          `Missing permission: ${opts.permissions.join(" or ")}`,
          403,
          "MISSING_PERMISSION"
        ),
      };
    }
  }

  return {
    ctx: {
      user,
      profile: {
        id: profile.id as string,
        company_id: String(profile.company_id),
        tenant_id: raw.tenantId,
        active_company_id: profile.active_company_id,
        role_id: profile.role_id as string | null,
        is_platform_admin: Boolean(profile.is_platform_admin),
        email: profile.email,
        mfa_enabled: mfaStatus
          ? mfaStatus.profile.mfa_enabled
          : Boolean(profile.mfa_enabled),
        require_mfa: Boolean(profile.require_mfa),
        mfa_enforced: Boolean(profile.mfa_enforced),
      },
      roleSlug,
      permissions,
      companyId: raw.companyId,
      tenantId: raw.tenantId,
      isPlatformAdmin,
      platformRole: resolvePlatformRole(profile)?.role ?? null,
      isSuperAdmin,
      isElevated: raw.isElevated,
      mfaOk,
      isPrivilegedRole,
    },
  };
}

/**
 * Require authenticated session + profile. Optionally require permissions and MFA.
 */
export async function requireApiAuth(
  opts?: AuthOptions
): Promise<{ ctx: AuthedContext } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: authError("Sign in required", 401) };
  }

  const raw = await loadAuthContext(supabase, user.id);
  if (!raw?.profile?.company_id) {
    return { response: authError("No user profile or company", 403) };
  }

  return finalizeAuth(supabase, user, raw, opts);
}
