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

const TABS = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produce", href: "/dashboard/production", icon: Factory },
  { title: "Stock", href: "/dashboard/inventory", icon: Package },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { title: "More", href: "/dashboard/settings", icon: MoreHorizontal },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 h-14">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
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
