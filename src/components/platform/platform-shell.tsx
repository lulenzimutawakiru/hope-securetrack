"use client";

/**
 * cPanel-style chrome for /platform/* — SecureTrack staff control plane.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Workflow,
  Activity,
  Flag,
  Layers,
  HeartPulse,
  CreditCard,
  Server,
  Shield,
  Sparkles,
  ArrowLeft,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  {
    title: "Control panel",
    href: "/platform",
    icon: LayoutDashboard,
    exact: true,
  },
  { title: "Tenants", href: "/platform/tenants", icon: Building2 },
  { title: "Provisioning", href: "/platform/provisioning", icon: Workflow },
  { title: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard },
  { title: "Modules", href: "/platform/modules", icon: Layers },
  { title: "Feature flags", href: "/platform/flags", icon: Flag },
  { title: "Events", href: "/platform/events", icon: Activity },
  { title: "Jobs", href: "/platform/jobs", icon: Server },
  { title: "Health", href: "/platform/health", icon: HeartPulse },
  { title: "Ops", href: "/platform/ops", icon: Sparkles },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/platform";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b bg-card/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Server className="h-5 w-5 text-hope-gold shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                SecureTrack cPanel
              </p>
              <p className="text-sm font-semibold truncate">{APP_NAME} Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> ERP dashboard
            </Link>
            <Link
              href="/dashboard/identity"
              className="hidden sm:inline-flex text-xs items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted"
            >
              <Users className="h-3.5 w-3.5" /> IAM
            </Link>
            <Link
              href="/dashboard/security/dual-control"
              className="hidden sm:inline-flex text-xs items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted"
            >
              <Shield className="h-3.5 w-3.5" /> Dual control
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0">
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-muted/20 p-2">
          <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Control plane
          </p>
          <nav className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto p-2 text-[10px] text-muted-foreground">
            Staff-only · tenant isolation enforced for ERP users
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Mobile nav */}
          <div className="md:hidden mb-4 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (!item.exact && pathname.startsWith(item.href + "/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
