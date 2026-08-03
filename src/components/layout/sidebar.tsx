"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  QrCode,
  Printer,
  Package,
  Boxes,
  Warehouse,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Box,
  Truck,
  Users,
  ScrollText,
  Settings,
  Shield,
  Tag,
  Bluetooth,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Contact,
  UserPlus,
  Network,
  Briefcase,
  Handshake,
  Landmark,
  Activity,
  IdCard,
  Receipt,
  Plug,
  UserCircle,
  Headphones,
  Palette,
  Wallet,
  Tags,
  MessageSquare,
  Building2,
  Mail,
  Image,
  Car,
  FolderKanban,
  Clock,
  Server,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/constants";
import { useUser } from "@/hooks/use-user";
import { useBrand } from "@/components/providers/brand-provider";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { pushRecentNav } from "@/lib/recent-nav";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Factory,
  QrCode,
  Printer,
  Package,
  Warehouse,
  ShieldCheck,
  Shield,
  AlertTriangle,
  BarChart3,
  Box,
  Truck,
  Users,
  ScrollText,
  Settings,
  Tag,
  Bluetooth,
  ShoppingCart,
  ShoppingBag,
  FileText,
  Contact,
  UserPlus,
  Network,
  Briefcase,
  Handshake,
  Landmark,
  Activity,
  IdCard,
  Receipt,
  Plug,
  UserCircle,
  Headphones,
  Palette,
  Wallet,
  Boxes,
  Tags,
  MessageSquare,
  Building2,
  Mail,
  Image,
  Car,
  FolderKanban,
  Clock,
  Server,
};

type SidebarProps = {
  /** Always expanded (mobile drawer) */
  forceExpanded?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ forceExpanded, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission, loading } = useUser();
  const { brand } = useBrand();
  const [collapsed, setCollapsed] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const isCollapsed = forceExpanded ? false : collapsed;

  const items = useMemo(() => {
    const permitted = NAV_ITEMS.filter(
      (item) => loading || hasPermission(item.permission)
    );
    const q = navQuery.trim().toLowerCase();
    if (!q) return permitted;
    return permitted.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q)
    );
  }, [hasPermission, loading, navQuery]);

  // Grouped navigation (collapsed-state persisted per browser session).
  const GROUP_KEY = "hope:sidebar-groups";
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const raw = window.localStorage.getItem(GROUP_KEY);
        return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      } catch {
        return {};
      }
    }
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(GROUP_KEY, JSON.stringify(collapsedGroups));
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsedGroups]);

  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const groups = useMemo(() => {
    const byGroup = new Map<string, (typeof NAV_ITEMS)[number][]>();
    for (const item of items) {
      const list = byGroup.get(item.group) ?? [];
      list.push(item);
      byGroup.set(item.group, list);
    }
    return NAV_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      items: byGroup.get(group.id) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const renderNavItem = (item: (typeof NAV_ITEMS)[number]) => {
    const Icon = iconMap[item.icon] ?? LayoutDashboard;
    const active =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));

    const link = (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => {
          pushRecentNav(item.href, item.title);
          onNavigate?.();
        }}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="truncate">{item.title}</span>}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.title}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full min-h-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          isCollapsed ? "w-16" : "w-64",
          forceExpanded && "w-full border-0"
        )}
      >
        <div className="flex h-[var(--header-height)] items-center gap-3 border-b border-sidebar-border px-4">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-8 w-8 shrink-0 rounded-md bg-sidebar object-contain"
            />
          ) : (
            <Shield className="h-8 w-8 shrink-0 text-sidebar-primary" />
          )}
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">
                {brand.name || "SecureTrack ERP"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {brand.tradingName || "Multi-tenant platform"}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="border-b border-sidebar-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sidebar-foreground/50" />
              <Input
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder="Filter modules…"
                className="h-8 pl-8 text-xs bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
                aria-label="Filter navigation modules"
              />
            </div>
            {navQuery.trim() && (
              <p className="mt-1 px-1 text-[10px] text-sidebar-foreground/50">
                {items.length} match{items.length === 1 ? "" : "es"}
              </p>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
          {items.length === 0 && !isCollapsed && (
            <p className="px-2 py-3 text-xs text-sidebar-foreground/50">
              No modules match “{navQuery.trim()}”.
            </p>
          )}
          {navQuery.trim() || isCollapsed
            ? items.map((item) => renderNavItem(item))
            : groups.map((group) => (
                <div key={group.id} className="group">
                  <div className="flex items-center justify-between px-2 pb-1 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {group.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="rounded p-0.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-expanded={!collapsedGroups[group.id]}
                      aria-label={`${collapsedGroups[group.id] ? "Expand" : "Collapse"} ${group.label}`}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          collapsedGroups[group.id] && "-rotate-90"
                        )}
                      />
                    </button>
                  </div>
                  {!collapsedGroups[group.id] && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => renderNavItem(item))}
                    </div>
                  )}
                </div>
              ))}
        </nav>

        {!forceExpanded && (
          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
