/**
 * Server-side authorization helpers for API routes.
 * Always fail closed. Never trust client-supplied actor_id / company_id.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
  /** Resolved tenant — never from client body */
  tenantId: string | null;
  isPlatformAdmin: boolean;
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

/** Opt-in: set MFA_ENFORCE_PRIVILEGED=true after admins have enrolled MFA */
function mfaEnforcementEnabled(): boolean {
  return process.env.MFA_ENFORCE_PRIVILEGED === "true";
}

/**
 * Require authenticated session + profile. Optionally require permissions and MFA.
 */
export async function requireApiAuth(opts?: {
  permissions?: string[];
  /** If true, platform admin / super_administrator bypasses permission list */
  allowPlatformAdmin?: boolean;
  /** Require MFA for privileged roles (or always if requireMfa: true) */
  requireMfa?: boolean | "privileged";
}): Promise<{ ctx: AuthedContext } | { response: NextResponse }> {
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

  if (!profile?.company_id) {
    return { response: authError("No user profile or company", 403) };
  }

  const roleObj = profile.roles as { slug?: string } | null;
  const roleSlug = roleObj?.slug || null;
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

  // Control-plane (platform./tenant.) permissions are honored only for
  // SecureTrack staff. Strip them from tenant users even if a role row grants
  // them, so tenant super admins can never hold platform entitlements.
  if (!isStaffPlatformAdmin) {
    permissions = permissions.filter(
      (p) => !p.startsWith("platform.") && !p.startsWith("tenant.")
    );
  }

  const companyId = String(
    (profile as { active_company_id?: string }).active_company_id || profile.company_id
  );

  // Resolve tenant from company (source of truth) — never from request body
  let tenantId: string | null =
    (profile as { tenant_id?: string | null }).tenant_id || null;
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

  // Membership check — fail closed for cross-company
  try {
    const { data: hasAccess } = await supabase.rpc("user_has_company_access", {
      p_company_id: companyId,
    });
    if (hasAccess === false) {
      return {
        response: authError(
          "No membership for active company",
          403,
          "NO_MEMBERSHIP"
        ),
      };
    }
  } catch {
    // RPC missing: fall back to profile match only
    const home = String(profile.company_id);
    const active = String(
      (profile as { active_company_id?: string }).active_company_id || home
    );
    if (companyId !== home && companyId !== active) {
      return {
        response: authError("Company access denied", 403, "NO_MEMBERSHIP"),
      };
    }
  }

  let isElevated = false;
  try {
    const { data: elev } = await supabase.rpc("is_platform_elevated");
    isElevated = Boolean(elev);
  } catch {
    isElevated = false;
  }

  // AAL2 / MFA: prefer Supabase assurance level when present
  const aal = (user as { aal?: string; app_metadata?: { aal?: string } }).aal
    || (user as { app_metadata?: { aal?: string } }).app_metadata?.aal;
  const mfaEnabled = Boolean(profile.mfa_enabled) || aal === "aal2";
  const mfaOk = mfaEnabled;

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

  const needMfa =
    opts?.requireMfa === true ||
    (opts?.requireMfa === "privileged" && isPrivilegedRole && mfaEnforcementEnabled()) ||
    (mfaEnforcementEnabled() &&
      isPrivilegedRole &&
      (Boolean(profile.require_mfa) || Boolean(profile.mfa_enforced)));

  if (needMfa && !mfaOk) {
    return {
      response: authError(
        "Multi-factor authentication required for this action. Enable MFA in Identity self-service.",
        403,
        "MFA_REQUIRED"
      ),
    };
  }

  return {
    ctx: {
      user,
      profile: {
        id: profile.id as string,
        company_id: String(profile.company_id),
        tenant_id: tenantId,
        active_company_id: (profile as { active_company_id?: string }).active_company_id,
        role_id: profile.role_id as string | null,
        is_platform_admin: Boolean(profile.is_platform_admin),
        email: (profile as { email?: string }).email,
        mfa_enabled: Boolean(profile.mfa_enabled),
        require_mfa: Boolean(profile.require_mfa),
        mfa_enforced: Boolean(profile.mfa_enforced),
      },
      roleSlug,
      permissions,
      companyId,
      tenantId,
      isPlatformAdmin,
      isSuperAdmin,
      isElevated,
      mfaOk,
      isPrivilegedRole,
    },
  };
}

