"use client";

/**
 * Enterprise Control Plane shell - OS administration, fully isolated from ERP.
 *
 * Layers:
 *  1. Platform Administration
 *  2. Tenant Administration
 *  3. Company Administration
 *
 * Role-aware: navigation, command palette, and route access are filtered by
 * the staff role (Access Matrix). Data endpoints enforce the same matrix
 * server-side; this shell adds defense in depth plus the enterprise UI.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
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
  Wallet,
  Gauge,
  ScrollText,
  Fingerprint,
  PieChart,
  Bot,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Lock,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { CONTROL_PLANE_CAPABILITIES } from "@/lib/platform/control-plane-registry";
import {
  capabilitiesForRole,
  resolveCapabilityForPath,
  roleCanAccessCapability,
  type PlatformStaffRole,
} from "@/lib/platform/staff";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Control-plane capability id used for role filtering. */
  cap: string;
  exact?: boolean;
};

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Dashboard",
    items: [
      { title: "Command Center", href: "/platform", icon: LayoutDashboard, cap: "command-center", exact: true },
    ],
  },
  {
    label: "Tenant Management",
    items: [
      { title: "Tenant Management", href: "/platform/tenants", icon: Building2, cap: "tenants" },
      { title: "Provisioning Engine", href: "/platform/provisioning", icon: Workflow, cap: "provisioning" },
      { title: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard, cap: "subscriptions" },
      { title: "Module Management", href: "/platform/modules", icon: Layers, cap: "modules" },
      { title: "Feature Flags", href: "/platform/flags", icon: Flag, cap: "flags" },
      { title: "User Administration", href: "/platform/users", icon: Users, cap: "users" },
      { title: "Company Administration", href: "/platform/companies", icon: Briefcase, cap: "companies" },
    ],
  },
  {
    label: "Subscription & Billing",
    items: [
      { title: "Billing Overview", href: "/platform/billing", icon: Wallet, cap: "billing" },
      { title: "Usage Metering", href: "/platform/usage", icon: Gauge, cap: "usage" },
    ],
  },
  {
    label: "Security Center",
    items: [
      { title: "Security Center", href: "/platform/security", icon: Shield, cap: "security" },
      { title: "Audit Log Explorer", href: "/platform/audit", icon: ScrollText, cap: "audit" },
      { title: "Login Monitoring", href: "/platform/sessions", icon: Fingerprint, cap: "sessions" },
      { title: "Audit & Compliance", href: "/platform/compliance", icon: Scale, cap: "compliance" },
      { title: "Data Governance", href: "/platform/governance", icon: Database, cap: "governance" },
      { title: "Ops / Elevation", href: "/platform/ops", icon: Sparkles, cap: "ops" },
    ],
  },
  {
    label: "Identity & Access",
    items: [
      { title: "Roles & Permissions", href: "/platform/roles", icon: KeyRound, cap: "roles" },
      { title: "Access Reviews", href: "/platform/access-reviews", icon: ShieldCheck, cap: "access-reviews" },
    ],
  },
  {
    label: "Platform Operations",
    items: [
      { title: "Health & Infra", href: "/platform/health", icon: HeartPulse, cap: "health" },
      { title: "Monitoring", href: "/platform/monitoring", icon: LineChart, cap: "monitoring" },
      { title: "Background Jobs", href: "/platform/jobs", icon: Server, cap: "jobs" },
      { title: "Events", href: "/platform/events", icon: Activity, cap: "events" },
      { title: "Notifications", href: "/platform/notifications", icon: Bell, cap: "notifications" },
      { title: "Integration Center", href: "/platform/integrations", icon: Plug, cap: "integrations" },
      { title: "API Management", href: "/platform/api", icon: KeyRound, cap: "api" },
      { title: "Support Center", href: "/platform/support", icon: LifeBuoy, cap: "support" },
      { title: "Workflows", href: "/platform/workflows", icon: GitBranch, cap: "workflows" },
      { title: "AI Administration", href: "/platform/ai", icon: Brain, cap: "ai" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { title: "Storage", href: "/platform/storage", icon: HardDrive, cap: "storage" },
      { title: "Database Admin", href: "/platform/database", icon: Database, cap: "database" },
      { title: "Backup & DR", href: "/platform/backup", icon: Archive, cap: "backup" },
      { title: "Deployment", href: "/platform/deploy", icon: Rocket, cap: "deploy" },
    ],
  },
  {
    label: "Reports & Analytics",
    items: [
      { title: "Reports & Analytics", href: "/platform/analytics", icon: PieChart, cap: "analytics" },
      { title: "AI Assistant", href: "/platform/assistant", icon: Bot, cap: "assistant" },
    ],
  },
  {
    label: "System Settings",
    items: [
      { title: "System Config", href: "/platform/config", icon: Settings2, cap: "config" },
      { title: "Customization Studio", href: "/platform/studio", icon: Palette, cap: "studio" },
    ],
  },
];

const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items);

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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/** Command palette - global search across role-scoped control-plane surfaces. */
function ControlPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: PlatformStaffRole;
}) {
  const allowed = useMemo(() => capabilitiesForRole(role), [role]);

  const quickActions = useMemo(() => {
    const ids = new Set([
      "provisioning",
      "tenants",
      "security",
      "monitoring",
      "ai",
      "users",
      "billing",
      "usage",
      "analytics",
      "assistant",
      "audit",
      "sessions",
      "roles",
      "access-reviews",
    ]);
    return allowed.filter((c) => ids.has(c.id));
  }, [allowed]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search control plane surfaces, quick actions..." />
      <CommandList>
        <CommandEmpty>No control-plane surface matches.</CommandEmpty>
        {quickActions.length > 0 && (
          <CommandGroup heading="Quick actions">
            {quickActions.map((cap) => {
              const item = ALL_NAV.find((n) => n.cap === cap.id);
              const Icon = item?.icon || LayoutDashboard;
              return (
                <CommandItem
                  key={cap.id}
                  value={`action ${cap.title}`}
                  onSelect={() => {
                    onOpenChange(false);
                    if (item) window.location.assign(item.href);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {cap.title}
                  <CommandShortcut>Enter</CommandShortcut>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {(["platform", "tenant", "company"] as const).map((layer) => {
          const items = allowed.filter((c) => c.layer === layer);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={layer} heading={`${layer} administration`}>
              {items.map((cap) => (
                <CommandItem
                  key={cap.id}
                  value={`${layer} ${cap.title}`}
                  onSelect={() => {
                    onOpenChange(false);
                    window.location.assign(cap.href);
                  }}
                >
                  <CornerDownLeft className="h-4 w-4" />
                  {cap.title}
                  <CommandShortcut>{cap.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

function ForbiddenScreen({ pathname }: { pathname: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-destructive" />
      <h2 className="mt-3 text-lg font-semibold">Access denied</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your staff role does not grant access to{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {pathname}
        </code>{" "}
        on the Enterprise Control Plane. This attempt is governed by the Access
        Matrix.
      </p>
      <Link
        href="/platform"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
      >
        <LayoutDashboard className="h-4 w-4" /> Back to Command Center
      </Link>
    </div>
  );
}

export function PlatformShell({
  children,
  staffRole,
  staffRoleLabel,
  isLegacyRole,
}: {
  children: React.ReactNode;
  staffRole: PlatformStaffRole;
  staffRoleLabel: string;
  isLegacyRole: boolean;
}) {
  const pathname = usePathname() || "/platform";
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Cmd/Ctrl+K command palette
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Path-level Access Matrix gate (defense in depth; APIs enforce too)
  const capability = resolveCapabilityForPath(pathname);
  const pathDenied =
    capability != null && !roleCanAccessCapability(staffRole, capability.id);

  const visibleSections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        label: section.label,
        items: section.items.filter((i) =>
          roleCanAccessCapability(staffRole, i.cap)
        ),
      })).filter((s) => s.items.length > 0),
    [staffRole]
  );

  const allMobile = visibleSections.flatMap((s) => s.items).slice(0, 12);

  const capabilityTitle = capability
    ? CONTROL_PLANE_CAPABILITIES.find((c) => c.id === capability.id)?.title
    : null;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b bg-[#0b1e36] text-white sticky top-0 z-40">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Server className="h-5 w-5 text-hope-gold shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none">
                Enterprise Control Plane - SaaS OS
              </p>
              <p className="text-sm font-semibold truncate">
                {APP_NAME} Administration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search control plane</span>
              <kbd className="ml-1 rounded border border-white/20 px-1 font-mono text-[10px]">
                Ctrl K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Search control plane"
            >
              <Search className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <Link
              href="/platform/notifications"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Notification center"
              title="Notification center"
            >
              <Bell className="h-4 w-4" />
            </Link>
            <span
              className="hidden md:inline rounded-full border border-hope-gold/40 bg-hope-gold/10 px-2 py-0.5 text-[10px] font-medium text-hope-gold"
              title={`Staff role: ${staffRoleLabel}`}
            >
              {staffRoleLabel}
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
          {visibleSections.map((section) => (
            <NavSection
              key={section.label}
              label={section.label}
              items={section.items}
              pathname={pathname}
            />
          ))}
          <div className="mt-auto p-2 text-[10px] text-muted-foreground leading-snug">
            {capabilityTitle ? (
              <>
                Viewing <span className="font-medium">{capabilityTitle}</span> as{" "}
                <span className="font-medium">{staffRoleLabel}</span>.
              </>
            ) : (
              <>
                {staffRoleLabel} - Enterprise Control Plane. Tenant Owner /
                Company Admin / Users have no access.
              </>
            )}
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

          {isLegacyRole && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-hope-gold/40 bg-hope-gold/10 px-3 py-2 text-xs text-foreground">
              <Shield className="h-4 w-4 text-hope-gold" />
              <span>
                This staff profile predates granular roles and currently holds
                full <strong>Platform Owner</strong> access. Assign an explicit
                role (owner / cto / security / devops / compliance) to enforce
                the Access Matrix.
              </span>
            </div>
          )}

          {pathDenied ? <ForbiddenScreen pathname={pathname} /> : children}
        </main>
      </div>

      <ControlPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={staffRole}
      />
    </div>
  );
}
