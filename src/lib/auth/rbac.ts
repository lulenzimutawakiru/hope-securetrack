/**
 * Route-level RBAC map for SecureTrack ERP.
 *
 * Source of truth for *data* remains requireApiAuth + CRUD engine + RLS.
 * This module gates UI navigation and deep links so modules are only
 * reachable with the matching role permission (same slugs as NAV_ITEMS).
 */

import { NAV_ITEMS } from "@/lib/constants";

export type RbacRule = {
  /** Path prefix under /dashboard or /platform */
  prefix: string;
  /** Any one of these permissions grants access */
  anyOf: string[];
};

/** Explicit overrides (longest match wins after NAV_ITEMS). */
const OVERRIDES: RbacRule[] = [
  // Self-service areas — available to any signed-in user with baseline access
  {
    prefix: "/dashboard/settings/profile",
    anyOf: ["settings.view", "settings.manage", "dashboard.view"],
  },
  {
    prefix: "/dashboard/identity/self-service",
    anyOf: ["iam.view", "iam.sessions", "dashboard.view"],
  },
  {
    prefix: "/dashboard/identity/sessions",
    anyOf: ["iam.sessions", "iam.view", "iam.security", "dashboard.view"],
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
  return NAV_ITEMS.map((item) => ({
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
 * Returns null when path is outside protected modules (allow with auth only)
 * or the root dashboard home.
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

  // Unknown module under /dashboard — require dashboard.view (fail closed-ish)
  if (path.startsWith("/dashboard")) return ["dashboard.view"];
  if (path.startsWith("/platform")) return ["platform.view"];
  return null;
}

/** True if the permission set satisfies the route. */
export function canAccessRoute(
  userPermissions: string[] | null | undefined,
  pathname: string,
  opts?: { isPlatformAdmin?: boolean; isSuperAdmin?: boolean }
): boolean {
  if (opts?.isPlatformAdmin) return true;

  const required = resolveRoutePermissions(pathname);
  if (!required || required.length === 0) return true;

  const perms = userPermissions || [];
  if (opts?.isSuperAdmin) {
    // Super admin extras already merged into perms via enrichPermissions;
    // still check in case list is incomplete.
    return required.some((p) => perms.includes(p)) || perms.length > 0;
  }
  return required.some((p) => perms.includes(p));
}

/** Human-readable denial reason. */
export function routeAccessDenial(
  pathname: string
): { title: string; description: string; required: string[] } {
  const required = resolveRoutePermissions(pathname) || ["dashboard.view"];
  return {
    title: "Access restricted by role",
    description: `Your role does not include permission for this module. Required: ${required.join(" or ")}. Contact an administrator to request access.`,
    required,
  };
}
