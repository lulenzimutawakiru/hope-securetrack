/**
 * Multi-factor authentication helpers (Supabase Auth TOTP).
 *
 * - Enrollment + challenge/verify use the session-scoped Supabase client.
 * - Profile flags (mfa_enabled / require_mfa) stay in sync for RBAC banners
 *   and legacy checks; authoritative step-up is AAL2 on the session JWT.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Keep in sync with PRIVILEGED_ROLE_SLUGS in api-auth (avoid circular import). */
const PRIVILEGED_ROLE_SLUGS = new Set([
  "super_administrator",
  "managing_director",
  "finance_manager",
  "hr_manager",
  "payroll_officer",
  "auditor",
  "security_officer",
  "it_administrator",
]);

export type MfaAssurance = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
};

export type MfaFactorSummary = {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: string;
  created_at?: string;
};

export type MfaStatus = {
  aal: MfaAssurance;
  /** Verified TOTP (or other) factors — login will require a second step */
  factors: MfaFactorSummary[];
  hasVerifiedFactor: boolean;
  /** Session already stepped up */
  aal2: boolean;
  /** Profile row flags */
  profile: {
    mfa_enabled: boolean;
    require_mfa: boolean;
    mfa_enforced: boolean;
  };
  /** Privileged role should enroll / use MFA */
  privilegedRole: boolean;
  /** Production (or MFA_ENFORCE_PRIVILEGED) hard gate */
  enforcementEnabled: boolean;
  /**
   * True when this session is allowed for privileged API actions:
   * AAL2 if factors exist / MFA flagged; otherwise fail when enforcement requires MFA.
   */
  mfaSatisfiedForPrivileged: boolean;
};

export function mfaEnforcementEnabled(): boolean {
  const raw = process.env.MFA_ENFORCE_PRIVILEGED;
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return process.env.NODE_ENV === "production";
}

export async function getAssuranceLevel(
  sb: SupabaseClient
): Promise<MfaAssurance> {
  try {
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      return { currentLevel: null, nextLevel: null };
    }
    return {
      currentLevel: (data.currentLevel as MfaAssurance["currentLevel"]) ?? null,
      nextLevel: (data.nextLevel as MfaAssurance["nextLevel"]) ?? null,
    };
  } catch {
    return { currentLevel: null, nextLevel: null };
  }
}

export async function listVerifiedFactors(
  sb: SupabaseClient
): Promise<MfaFactorSummary[]> {
  try {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error || !data) return [];
    const totp = (data.totp || []).map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      factor_type: f.factor_type || "totp",
      status: f.status,
      created_at: f.created_at,
    }));
    // Only verified factors count for login step-up
    return totp.filter((f) => f.status === "verified");
  } catch {
    return [];
  }
}

export async function syncProfileMfaFlags(
  sb: SupabaseClient,
  userId: string,
  opts: { mfa_enabled?: boolean; require_mfa?: boolean; mfa_enforced?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (opts.mfa_enabled !== undefined) patch.mfa_enabled = opts.mfa_enabled;
  if (opts.require_mfa !== undefined) patch.require_mfa = opts.require_mfa;
  if (opts.mfa_enforced !== undefined) patch.mfa_enforced = opts.mfa_enforced;
  await sb.from("user_profiles").update(patch).eq("id", userId);
}

/**
 * After factors change, set mfa_enabled from verified factor count.
 */
export async function refreshProfileMfaFromFactors(
  sb: SupabaseClient,
  userId: string
): Promise<boolean> {
  const factors = await listVerifiedFactors(sb);
  const enabled = factors.length > 0;
  await syncProfileMfaFlags(sb, userId, { mfa_enabled: enabled });
  return enabled;
}

export async function resolveMfaStatus(
  sb: SupabaseClient,
  user: User,
  profile: {
    mfa_enabled?: boolean | null;
    require_mfa?: boolean | null;
    mfa_enforced?: boolean | null;
    is_platform_admin?: boolean | null;
    tenant_id?: string | null;
    roleSlug?: string | null;
  }
): Promise<MfaStatus> {
  const [aal, factors] = await Promise.all([
    getAssuranceLevel(sb),
    listVerifiedFactors(sb),
  ]);

  const hasVerifiedFactor = factors.length > 0;
  const aal2 = aal.currentLevel === "aal2";
  const roleSlug = profile.roleSlug || null;
  const isStaffPlatformAdmin =
    Boolean(profile.is_platform_admin) && !profile.tenant_id;
  const privilegedRole =
    isStaffPlatformAdmin ||
    (roleSlug ? PRIVILEGED_ROLE_SLUGS.has(roleSlug) : false) ||
    Boolean(profile.require_mfa) ||
    Boolean(profile.mfa_enforced);

  const enforcementEnabled = mfaEnforcementEnabled();
  const profileMfa = Boolean(profile.mfa_enabled) || hasVerifiedFactor;

  // Privileged gate: if user has (or must have) MFA, session must be AAL2.
  let mfaSatisfiedForPrivileged = true;
  if (enforcementEnabled && privilegedRole) {
    if (hasVerifiedFactor || profileMfa || profile.require_mfa || profile.mfa_enforced) {
      mfaSatisfiedForPrivileged = aal2;
    } else {
      // No factor enrolled yet — block until they enroll when enforcement is on
      mfaSatisfiedForPrivileged = false;
    }
  } else if (hasVerifiedFactor) {
    // Non-enforced but factors exist: still prefer AAL2 for requireMfa routes
    mfaSatisfiedForPrivileged = aal2;
  }

  return {
    aal,
    factors,
    hasVerifiedFactor,
    aal2,
    profile: {
      mfa_enabled: profileMfa,
      require_mfa: Boolean(profile.require_mfa),
      mfa_enforced: Boolean(profile.mfa_enforced),
    },
    privilegedRole,
    enforcementEnabled,
    mfaSatisfiedForPrivileged,
  };
}

/** Login must challenge MFA when password session is AAL1 and a factor exists. */
export function needsLoginMfaChallenge(status: Pick<MfaStatus, "aal" | "hasVerifiedFactor">): boolean {
  return (
    status.hasVerifiedFactor &&
    status.aal.currentLevel === "aal1" &&
    status.aal.nextLevel === "aal2"
  );
}
