/**
 * Route-level RBAC map for SecureTrack ERP.
 *
 * Source of truth for *data* remains requireApiAuth + CRUD engine + RLS.
 * This module gates UI navigation and deep links so modules are only
 * reachable with the matching role permission (same slugs as NAV_ITEMS).
 *
 * Policy:
 * - Platform staff (`isPlatformAdmin`) may open any route.
 * - Tenant super_administrator must still hold the required permission
 *   (granted via role_permissions / SUPER_ADMIN_EXTRAS enrichment) — no blanket bypass.
 * - Unknown /dashboard/* modules fail closed (empty requirement = deny).
 */

import { NAV_ITEMS } from "@/lib/constants";

export type RbacRule = {
  /** Path prefix under /dashboard or /platform */
  prefix: string;
  /** Any one of these permissions grants access */
  anyOf: string[];
};

/** Explicit overrides (checked first; longest prefix wins among all rules). */
const OVERRIDES: RbacRule[] = [
  // Self-service areas — available to any signed-in user with baseline access
  {
    prefix: "/dashboard/settings/profile",
    anyOf: ["settings.view", "settings.manage", "dashboard.view", "profile.self", "profile.view"],
  },
  {
    prefix: "/dashboard/settings/setup",
    anyOf: ["settings.view", "settings.manage", "dashboard.view"],
  },
  {
    prefix: "/dashboard/settings/security",
    anyOf: ["settings.manage", "settings.admin", "iam.security", "security.admin"],
  },
  {
    prefix: "/dashboard/settings/integrations",
    anyOf: ["settings.integrations", "settings.manage", "intg.manage"],
  },
  {
    prefix: "/dashboard/settings/numbering",
    anyOf: ["settings.sequences", "settings.manage"],
  },
  {
    prefix: "/dashboard/settings/workflows",
    anyOf: ["settings.workflows", "settings.manage"],
  },
  {
    prefix: "/dashboard/settings/branding",
    anyOf: ["settings.branding", "settings.manage", "brand.view", "brand.manage"],
  },
  {
    prefix: "/dashboard/settings/email",
    anyOf: ["settings.manage", "comm.manage", "comm.admin"],
  },
  {
    prefix: "/dashboard/settings/modules",
    anyOf: ["settings.manage", "settings.admin", "platform.flags"],
  },
  {
    prefix: "/dashboard/settings/backup",
    anyOf: ["settings.manage", "settings.admin", "security.admin"],
  },
  {
    prefix: "/dashboard/settings/audit",
    anyOf: ["settings.manage", "audit.view", "eal.view"],
  },
  {
    prefix: "/dashboard/settings",
    anyOf: ["settings.view", "settings.manage"],
  },
  {
    prefix: "/dashboard/identity/self-service",
    anyOf: ["iam.view", "iam.sessions", "dashboard.view", "profile.self", "iam.mfa"],
  },
  {
    prefix: "/dashboard/identity/security",
    anyOf: ["iam.security", "iam.mfa", "iam.manage", "security.admin"],
  },
  {
    prefix: "/dashboard/identity/sessions",
    anyOf: ["iam.sessions", "iam.view", "iam.security", "dashboard.view"],
  },
  {
    prefix: "/dashboard/identity/permissions",
    anyOf: ["iam.roles", "iam.manage", "iam.view"],
  },
  {
    prefix: "/dashboard/security/dual-control",
    anyOf: ["security.dual_control", "security.admin", "iam.security", "finance.approve", "payroll.approve"],
  },
  // Platform cPanel — staff only (layout also gates is_platform_admin)
  {
    prefix: "/platform/tenants",
    anyOf: ["platform.view", "platform.admin", "platform.tenants"],
  },
  {
    prefix: "/platform",
    anyOf: ["platform.view", "platform.admin"],
  },
  {
    prefix: "/dashboard/chat/notifications",
    anyOf: ["hc.view", "notifications.view", "dashboard.view"],
  },
  {
    prefix: "/dashboard/notifications",
    anyOf: ["notifications.view", "notifications.manage", "dashboard.view"],
  },

  // ── SecureChat (hc.*) — base is hc.view; privileged sub-dashboards ──────
  {
    prefix: "/dashboard/chat/executive",
    anyOf: ["hc.admin", "hc.manage"],
  },
  {
    prefix: "/dashboard/chat/analytics",
    anyOf: ["hc.admin", "hc.manage", "reports.dashboards"],
  },
  {
    prefix: "/dashboard/chat/settings",
    anyOf: ["hc.admin", "hc.manage", "settings.manage"],
  },
  {
    prefix: "/dashboard/chat/ai-agent",
    anyOf: ["hc.ai", "hc.admin", "hc.manage"],
  },
  {
    prefix: "/dashboard/chat/ai",
    anyOf: ["hc.ai", "hc.admin", "hc.manage"],
  },
  {
    prefix: "/dashboard/chat/announcements",
    anyOf: ["hc.announce", "hc.admin", "hc.manage"],
  },
  {
    prefix: "/dashboard/chat/meetings",
    anyOf: ["hc.meetings", "hc.admin", "hc.manage"],
  },
  {
    prefix: "/dashboard/chat/calls",
    anyOf: ["hc.meetings", "hc.admin", "hc.manage"],
  },

  // ── Communications (comm.*) — base is comm.view; privileged areas ───────
  {
    prefix: "/dashboard/communications/analytics",
    anyOf: ["comm.manage", "comm.admin", "reports.dashboards"],
  },
  {
    prefix: "/dashboard/communications/audit",
    anyOf: ["comm.admin", "comm.manage", "audit.view"],
  },
  {
    prefix: "/dashboard/communications/providers",
    anyOf: ["comm.admin", "comm.manage", "settings.integrations"],
  },
  {
    prefix: "/dashboard/communications/rules",
    anyOf: ["comm.manage", "comm.admin"],
  },
  {
    prefix: "/dashboard/communications/templates",
    anyOf: ["comm.templates", "comm.manage", "comm.admin"],
  },
  {
    prefix: "/dashboard/communications/broadcasts",
    anyOf: ["comm.broadcast", "comm.manage", "comm.admin"],
  },
  {
    prefix: "/dashboard/communications/ai",
    anyOf: ["comm.ai", "comm.manage", "comm.admin"],
  },
  {
    prefix: "/dashboard/communications/approvals",
    anyOf: ["comm.manage", "comm.admin"],
  },

  // ── Reports (reports.*) — base is reports.view; advanced areas ──────────
  {
    prefix: "/dashboard/reports/executive",
    anyOf: ["reports.dashboards", "reports.manage", "reports.kpis"],
  },
  {
    prefix: "/dashboard/reports/analytics",
    anyOf: ["reports.dashboards", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/dashboards",
    anyOf: ["reports.dashboards", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/kpis",
    anyOf: ["reports.kpis", "reports.manage", "reports.dashboards"],
  },
  {
    prefix: "/dashboard/reports/ai",
    anyOf: ["reports.ai", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/assistant",
    anyOf: ["reports.assistant", "reports.ai", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/intelligence",
    anyOf: ["reports.intelligence", "reports.manage", "reports.ai"],
  },
  {
    prefix: "/dashboard/reports/export",
    anyOf: ["reports.export", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/documents",
    anyOf: ["reports.documents", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/schedules",
    anyOf: ["reports.schedule", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/regulatory",
    anyOf: ["reports.regulatory", "reports.manage"],
  },
  {
    prefix: "/dashboard/reports/warehouse",
    anyOf: ["reports.dwh", "reports.manage"],
  },

  // ── Service Desk — admin console only for desk admins / managers ────────
  {
    prefix: "/dashboard/service-desk/admin",
    anyOf: ["sd.admin", "sd.manage"],
  },
];

function rulesFromNav(): RbacRule[] {
  // Root shells (/dashboard, /platform) are handled exactly in
  // resolveRoutePermissions — never as a prefix for child modules.
  // Otherwise every unmapped /dashboard/* path would only need dashboard.view.
  return NAV_ITEMS.filter((item) => {
    const href = item.href.replace(/\/$/, "") || item.href;
    return href !== "/dashboard" && href !== "/platform";
  }).map((item) => ({
    prefix: item.href.replace(/\/$/, "") || item.href,
    anyOf: [item.permission],
  }));
}

/** All rules sorted longest-prefix first for matching. */
export function getRbacRules(): RbacRule[] {
  const merged = [...OVERRIDES, ...rulesFromNav()];
  // Dedupe by prefix keeping override first
  const byPrefix = new Map<string, RbacRule>();
  for (const r of merged) {
    const key = r.prefix.replace(/\/$/, "") || r.prefix;
    if (!byPrefix.has(key)) byPrefix.set(key, { ...r, prefix: key });
  }
  return [...byPrefix.values()].sort(
    (a, b) => b.prefix.length - a.prefix.length
  );
}

let _cached: RbacRule[] | null = null;
function rules(): RbacRule[] {
  if (!_cached) _cached = getRbacRules();
  return _cached;
}

/**
 * Resolve required permissions for a dashboard/platform pathname.
 *
 * Returns:
 * - `null` — path is outside protected trees (no RBAC gate; auth-only).
 * - `[]` — protected tree but no matching module rule → **deny** (fail closed).
 * - `string[]` — any one of these permissions grants access.
 */
export function resolveRoutePermissions(
  pathname: string
): string[] | null {
  const path = (pathname.split("?")[0] || "/").replace(/\/$/, "") || "/";

  // Root dashboard always requires dashboard.view (enriched for all roles)
  if (path === "/dashboard") return ["dashboard.view"];

  // Only enforce under these trees
  if (!path.startsWith("/dashboard") && !path.startsWith("/platform")) {
    return null;
  }

  for (const rule of rules()) {
    if (path === rule.prefix || path.startsWith(rule.prefix + "/")) {
      return rule.anyOf;
    }
  }

  // Unknown module under protected trees — fail closed
  if (path.startsWith("/platform")) return ["platform.view"];
  if (path.startsWith("/dashboard")) return [];
  return null;
}

/**
 * True if the permission set satisfies the route.
 *
 * - Platform staff bypass all route gates.
 * - Super administrators do **not** get a blanket bypass; they must hold the
 *   permission (normally via SUPER_ADMIN_EXTRAS on the client / role seed on server).
 * - Empty `required` means the path is unmapped and access is denied.
 */
export function canAccessRoute(
  userPermissions: string[] | null | undefined,
  pathname: string,
  opts?: { isPlatformAdmin?: boolean; isSuperAdmin?: boolean }
): boolean {
  if (opts?.isPlatformAdmin) return true;

  const required = resolveRoutePermissions(pathname);
  // Outside RBAC trees
  if (required === null) return true;
  // Unmapped protected path — deny
  if (required.length === 0) return false;

  const perms = userPermissions || [];
  // Super-admin extras are already in `perms` via enrichPermissions; no extra bypass.
  void opts?.isSuperAdmin;
  return required.some((p) => perms.includes(p));
}

/**
 * Filter a list of hrefs (or objects with href) to those the user may open.
 */
export function filterAccessibleRoutes<T extends { href: string }>(
  items: readonly T[],
  userPermissions: string[] | null | undefined,
  opts?: { isPlatformAdmin?: boolean }
): T[] {
  return items.filter((item) =>
    canAccessRoute(userPermissions, item.href, opts)
  );
}

/** Human-readable denial reason. */
export function routeAccessDenial(
  pathname: string
): { title: string; description: string; required: string[] } {
  const required = resolveRoutePermissions(pathname);
  const list =
    required && required.length > 0
      ? required
      : ["(module not registered for your role)"];
  return {
    title: "Access restricted by role",
    description:
      required && required.length > 0
        ? `Your role does not include permission for this module. Required: ${required.join(" or ")}. Contact an administrator to request access.`
        : "This area is not available for your role. Contact an administrator if you need access.",
    required: list,
  };
}
