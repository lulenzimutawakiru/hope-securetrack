"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/constants";
import { useUser } from "@/hooks/use-user";
import { getRecentNav, pushRecentNav } from "@/lib/recent-nav";
import {
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Bell,
  FileText,
  Factory,
  ShieldCheck,
  Landmark,
  Users,
  Package,
  Sparkles,
  Truck,
  FolderKanban,
  Clock,
  History,
  Car,
  MapPin,
  Wallet,
  Mail,
} from "lucide-react";

const QUICK_ACTIONS = [
  { title: "Secure clock in/out", href: "/dashboard/attendance/clock", icon: Clock },
  { title: "Live attendance", href: "/dashboard/attendance/live", icon: Users },
  { title: "Fleet dashboard", href: "/dashboard/fleet", icon: Car },
  { title: "Live vehicle map", href: "/dashboard/fleet/map", icon: MapPin },
  { title: "Projects (PPM)", href: "/dashboard/projects", icon: FolderKanban },
  { title: "Finance cockpit (CFO)", href: "/dashboard/finance/cfo", icon: Landmark },
  { title: "Accounting engine", href: "/dashboard/finance/engine", icon: Wallet },
  { title: "New production batch", href: "/dashboard/production", icon: Factory },
  { title: "Create invoice", href: "/dashboard/billing", icon: FileText },
  { title: "Dispatch ops", href: "/dashboard/dispatch", icon: Truck },
  { title: "Communications hub", href: "/dashboard/communications", icon: Mail },
  { title: "Verify product", href: "/verify", icon: ShieldCheck },
  { title: "HR employees", href: "/dashboard/hr/employees", icon: Users },
  { title: "Inventory stock", href: "/dashboard/inventory", icon: Package },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
  { title: "AI assistant", href: "/dashboard/reports/assistant", icon: Sparkles },
  { title: "Reports BI", href: "/dashboard/reports", icon: LayoutDashboard },
  { title: "Recycle bin", href: "/dashboard/recycle-bin", icon: FileText },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<ReturnType<typeof getRecentNav>>([]);
  const router = useRouter();
  const { hasPermission, loading } = useUser();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setRecent(getRecentNav());
  }, [open]);

  const go = useCallback(
    (href: string, title?: string) => {
      if (title) pushRecentNav(href, title);
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const nav = NAV_ITEMS.filter(
    (item) => loading || hasPermission(item.permission)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 rounded-lg border bg-background/80 px-3 text-sm text-muted-foreground hover:bg-muted/60 transition-colors min-w-[200px] lg:min-w-[280px] shadow-sm"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Search modules, actions…</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search modules, records, actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {recent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recent.map((r) => (
                  <CommandItem key={`recent-${r.href}`} onSelect={() => go(r.href, r.title)}>
                    <History className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{r.title}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                      {r.href.replace("/dashboard", "") || "/"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Quick actions">
            {QUICK_ACTIONS.map((a) => (
              <CommandItem key={a.href + a.title} onSelect={() => go(a.href, a.title)}>
                <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{a.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            {nav.map((item) => (
              <CommandItem key={item.href} onSelect={() => go(item.href, item.title)}>
                <Plus className="mr-2 h-4 w-4 opacity-0" />
                <span>{item.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                  {item.href.replace("/dashboard", "") || "/"}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/** Hook for external open control (mobile FAB) */
export function useCommandPaletteHotkey() {
  // reserved for future
}
