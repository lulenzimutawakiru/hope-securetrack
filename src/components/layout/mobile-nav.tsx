"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  Package,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { PERMISSIONS } from "@/lib/constants";
import { canAccessRoute } from "@/lib/auth/rbac";

const TABS = [
  {
    title: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    title: "Produce",
    href: "/dashboard/production",
    icon: Factory,
    permission: PERMISSIONS.PRODUCTION_VIEW,
  },
  {
    title: "Stock",
    href: "/dashboard/inventory",
    icon: Package,
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    permission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    title: "More",
    href: "/dashboard/settings",
    icon: MoreHorizontal,
    // Settings hub is strict; fall back to profile if no manage
    permission: PERMISSIONS.SETTINGS_MANAGE,
    fallbackHref: "/dashboard/settings/profile",
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { auth, loading, hasPermission, isPlatformAdmin } = useUser();

  const tabs = TABS.map((tab) => {
    const allowed =
      loading ||
      isPlatformAdmin ||
      hasPermission(tab.permission) ||
      canAccessRoute(auth?.permissions, tab.href, { isPlatformAdmin });
    return {
      ...tab,
      href:
        !allowed && "fallbackHref" in tab && tab.fallbackHref
          ? tab.fallbackHref
          : tab.href,
      hidden: !allowed && !("fallbackHref" in tab && tab.fallbackHref),
    };
  }).filter((t) => !t.hidden);

  // Always show at least Home
  const visible =
    tabs.length > 0
      ? tabs
      : [TABS[0]];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Primary"
    >
      <ul
        className="grid h-14"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <li key={tab.href + tab.title}>
              <Link
                href={tab.href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-accent")} />
                {tab.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
