/**
 * Enterprise Control Plane staff roles and enforcement.
 *
 * Implements the CPanel Security Rules "Access Matrix":
 *   Platform Owner  -> full control plane
 *   CTO             -> infrastructure + security + AI
 *   Security Admin  -> audit + security + MFA/SSO
 *   DevOps          -> deployment + monitoring + jobs
 *   Compliance      -> audit + reports + governance
 *   Tenant Owner / Company Admin / Normal User -> no CPanel access
 *
 * Enforcement is centralized here so the layout, API routes, and the shell
 * share a single source of truth (CONTROL_PLANE_CAPABILITIES.roles).
 * Always fails closed: an unknown role or unknown capability is denied.
 */

import {
  CONTROL_PLANE_CAPABILITIES,
  type ControlPlaneCapability,
} from "@/lib/platform/control-plane-registry";

export type PlatformStaffRole =
  | "owner"
  | "cto"
  | "security"
  | "devops"
  | "compliance";

export type PlatformStaffRoleDef = {
  code: PlatformStaffRole;
  label: string;
  description: string;
};

export const PLATFORM_STAFF_ROLES: PlatformStaffRoleDef[] = [
  {
    code: "owner",
    label: "Platform Owner",
    description: "Full control plane: platform, tenant, company administration.",
  },
  {
    code: "cto",
    label: "CTO",
    description: "Infrastructure + security + AI administration.",
  },
  {
    code: "security",
    label: "Security Admin",
    description: "Audit + security center + MFA/SSO + identity oversight.",
  },
  {
    code: "devops",
    label: "DevOps Administrator",
    description: "Deployment + monitoring + background jobs + integrations.",
  },
  {
    code: "compliance",
    label: "Compliance Officer",
    description: "Audit + reports + data governance.",
  },
];

const ROLE_BY_LABEL: Record<string, PlatformStaffRole> = {
  "Platform Owner": "owner",
  CTO: "cto",
  Security: "security",
  "Security Admin": "security",
  DevOps: "devops",
  "DevOps Administrator": "devops",
  Compliance: "compliance",
  "Compliance Officer": "compliance",
};

export type PlatformStaffProfile = {
  is_platform_admin?: boolean | null;
  tenant_id?: string | null;
  platform_role?: string | null;
};

/** A profile is SecureTrack staff only when flagged AND unbound from a tenant. */
export function isPlatformStaff(profile: PlatformStaffProfile | null | undefined): boolean {
  return Boolean(profile?.is_platform_admin) && !profile?.tenant_id;
}

export type ResolvedPlatformRole = {
  role: PlatformStaffRole;
  /** True when the profile predates granular roles (platform_role is NULL). */
  isLegacy: boolean;
  label: string;
};

/**
 * Resolve the effective staff role. Legacy staff (is_platform_admin with no
 * platform_role) keep full 'owner' access for backward compatibility, flagged
 * isLegacy so the UI can prompt for an explicit assignment.
 */
export function resolvePlatformRole(
  profile: PlatformStaffProfile | null | undefined
): ResolvedPlatformRole | null {
  if (!isPlatformStaff(profile)) return null;
  const raw = profile?.platform_role;
  // Unknown platform_role values are not resolvable (fail closed): the
  // profile keeps is_platform_admin but is denied until the assignment is
  // corrected. Legacy staff (no platform_role) keep full owner access.
  if (raw) {
    const match = PLATFORM_STAFF_ROLES.find((r) => r.code === raw);
    if (!match) return null;
    return { role: match.code, isLegacy: false, label: match.label };
  }
  return {
    role: "owner",
    isLegacy: true,
    label: "Platform Owner",
  };
}

/** Map a registry role label (e.g. "DevOps") to a staff role code. */
export function roleLabelToCode(label: string): PlatformStaffRole | null {
  return ROLE_BY_LABEL[label] ?? null;
}

/**
 * Can this staff role access the given control-plane capability?
 * - owner: full access (Access Matrix: "Platform Owner -> Full").
 * - other roles: the capability must explicitly list their label.
 * - unknown role / unknown capability: denied (fail closed).
 */
export function roleCanAccessCapability(
  role: PlatformStaffRole | string | null | undefined,
  capabilityId: string
): boolean {
  const capability = CONTROL_PLANE_CAPABILITIES.find(
    (c) => c.id === capabilityId
  );
  if (!capability) return false;
  if (role === "owner") return true;
  const code =
    roleLabelToCode(String(role)) ??
    (PLATFORM_STAFF_ROLES.some((r) => r.code === role)
      ? (role as PlatformStaffRole)
      : null);
  if (!code) return false;
  return capability.roles.some((label) => roleLabelToCode(label) === code);
}

export function capabilitiesForRole(
  role: PlatformStaffRole | string | null | undefined
): ControlPlaneCapability[] {
  if (role === "owner") return CONTROL_PLANE_CAPABILITIES;
  return CONTROL_PLANE_CAPABILITIES.filter((c) =>
    roleCanAccessCapability(role, c.id)
  );
}

export function capabilityIdsForRole(
  role: PlatformStaffRole | string | null | undefined
): Set<string> {
  return new Set(capabilitiesForRole(role).map((c) => c.id));
}

/** Resolve the control-plane capability that owns a route path, if any. */
export function resolveCapabilityForPath(
  pathname: string
): ControlPlaneCapability | null {
  const norm = pathname.replace(/\/+$/, "") || "/";
  const exact = CONTROL_PLANE_CAPABILITIES.find((c) => c.href === norm);
  if (exact) return exact;
  const byPrefix = CONTROL_PLANE_CAPABILITIES.filter(
    (c) => c.href !== "/" && norm.startsWith(c.href + "/")
  ).sort((a, b) => b.href.length - a.href.length);
  return byPrefix[0] ?? null;
}

/** Derived role -> capability matrix for docs, UI, and tests. */
export const PLATFORM_ROLE_CAPABILITY_MATRIX = PLATFORM_STAFF_ROLES.map(
  (roleDef) => ({
    role: roleDef.code,
    label: roleDef.label,
    capabilities: capabilitiesForRole(roleDef.code).map((c) => ({
      id: c.id,
      title: c.title,
      layer: c.layer,
    })),
  })
);

export type StaffAccessContext = {
  isPlatformAdmin?: boolean;
  isElevated?: boolean;
  platformRole?: PlatformStaffRole | null;
};

/**
 * Single gate used by platform API routes. Requires a staff session
 * (platform admin or short-lived elevated break-glass) AND the staff role
 * to hold the capability. Fails closed for tenant users.
 */
export function staffCanAccess(
  ctx: StaffAccessContext | null | undefined,
  capabilityId: string
): boolean {
  if (!ctx) return false;
  const isStaff = Boolean(ctx.isPlatformAdmin || ctx.isElevated);
  if (!isStaff) return false;
  // Staff with an invalid/unknown platform_role are denied (fail closed).
  // Elevated break-glass sessions without a role keep legacy full access.
  if (ctx.platformRole === null && !ctx.isElevated) return false;
  return roleCanAccessCapability(ctx.platformRole ?? "owner", capabilityId);
}
