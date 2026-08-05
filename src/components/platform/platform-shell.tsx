"use client";

/**
 * Enterprise Control Plane shell — OS administration, fully isolated from ERP.
 *
 * Layers:
 *  1. Platform Administration
 *  2. Tenant Administration
 *  3. Company Administration
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
  Brain,
  Plug,
  GitBranch,
  Scale,
  Database,
  LineChart,
  Briefcase,
  HardDrive,
  KeyRound,
  Archive,
  Rocket,
  Bell,
  LifeBuoy,
  Settings2,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const PLATFORM_NAV: NavItem[] = [
  { title: "Command Center", href: "/platform", icon: LayoutDashboard, exact: true },
  { title: "Health & Infra", href: "/platform/health", icon: HeartPulse },
  { title: "Monitoring", href: "/platform/monitoring", icon: LineChart },
  { title: "Security Center", href: "/platform/security", icon: Shield },
  { title: "Audit & Compliance", href: "/platform/compliance", icon: Scale },
  { title: "Data Governance", href: "/platform/governance", icon: Database },
  { title: "AI Administration", href: "/platform/ai", icon: Brain },
  { title: "Integration Center", href: "/platform/integrations", icon: Plug },
  { title: "API Management", href: "/platform/api", icon: KeyRound },
  { title: "Storage", href: "/platform/storage", icon: HardDrive },
  { title: "Database Admin", href: "/platform/database", icon: Database },
  { title: "Backup & DR", href: "/platform/backup", icon: Archive },
  { title: "Deployment", href: "/platform/deploy", icon: Rocket },
  { title: "Notifications", href: "/platform/notifications", icon: Bell },
  { title: "Support Center", href: "/platform/support", icon: LifeBuoy },
  { title: "System Config", href: "/platform/config", icon: Settings2 },
  { title: "Customization Studio", href: "/platform/studio", icon: Palette },
  { title: "Workflows", href: "/platform/workflows", icon: GitBranch },
  { title: "Background Jobs", href: "/platform/jobs", icon: Server },
  { title: "Events", href: "/platform/events", icon: Activity },
  { title: "Ops / Elevation", href: "/platform/ops", icon: Sparkles },
];

const TENANT_NAV: NavItem[] = [
  { title: "Tenant Management", href: "/platform/tenants", icon: Building2 },
  { title: "Provisioning Engine", href: "/platform/provisioning", icon: Workflow },
  { title: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard },
  { title: "Module Management", href: "/platform/modules", icon: Layers },
  { title: "Feature Flags", href: "/platform/flags", icon: Flag },
  { title: "User Administration", href: "/platform/users", icon: Users },
];

const COMPANY_NAV: NavItem[] = [
  { title: "Company Administration", href: "/platform/companies", icon: Briefcase },
];

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-3">
      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/platform";
  const allMobile = [...PLATFORM_NAV.slice(0, 8), ...TENANT_NAV, ...COMPANY_NAV];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b bg-[#0b1e36] text-white sticky top-0 z-40">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Server className="h-5 w-5 text-hope-gold shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none">
                Enterprise Control Plane · SaaS OS
              </p>
              <p className="text-sm font-semibold truncate">
                {APP_NAME} Administration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden lg:inline text-[10px] rounded-full border border-white/20 px-2 py-0.5 text-white/70">
              Zero-trust · staff only
            </span>
            <Link
              href="/dashboard"
              className="text-xs text-white/70 hover:text-white inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> ERP app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0">
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-muted/15 p-2 overflow-y-auto">
          <NavSection
            label="1 · Platform Administration"
            items={PLATFORM_NAV}
            pathname={pathname}
          />
          <NavSection
            label="2 · Tenant Administration"
            items={TENANT_NAV}
            pathname={pathname}
          />
          <NavSection
            label="3 · Company Administration"
            items={COMPANY_NAV}
            pathname={pathname}
          />
          <div className="mt-auto p-2 text-[10px] text-muted-foreground leading-snug">
            Platform Owner · CTO · Security · DevOps · Compliance.
            Tenant Owner / Company Admin / Users have no access.
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="md:hidden mb-4 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {allMobile.map((item) => {
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
