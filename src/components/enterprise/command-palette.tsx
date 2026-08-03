"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { apiGet } from "@/lib/api-client";
import {
  entityListQueryString,
  type EntityListResult,
} from "@/hooks/use-entity-query";
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
  Database,
  Loader2,
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

type RecordRow = Record<string, unknown>;

interface RecordSource {
  entity: string;
  label: string;
  /** View permission that gates server access to this entity. */
  permission: string;
  /** Module hub the palette navigates to (records have no detail routes yet). */
  hub: string;
  select: string;
  display: (row: RecordRow) => string;
  detail: (row: RecordRow) => string;
}

const RECORD_SOURCES: RecordSource[] = [
  {
    entity: "warehouses",
    label: "Warehouses",
    permission: "inventory.view",
    hub: "/dashboard/inventory",
    select: "id,name,code",
    display: (r) => String(r.name ?? ""),
    detail: (r) => String(r.code ?? ""),
  },
  {
    entity: "products",
    label: "Products",
    permission: "products.view",
    hub: "/dashboard/products",
    select: "id,name,product_code",
    display: (r) => String(r.name ?? ""),
    detail: (r) => String(r.product_code ?? ""),
  },
  {
    entity: "customers",
    label: "Customers",
    permission: "crm.view",
    hub: "/dashboard/crm",
    select: "id,name,code,email",
    display: (r) => String(r.name ?? ""),
    detail: (r) => String(r.code ?? r.email ?? ""),
  },
  {
    entity: "invoices",
    label: "Invoices",
    permission: "invoices.view",
    hub: "/dashboard/invoices",
    select: "id,invoice_number",
    display: (r) => String(r.invoice_number ?? ""),
    detail: () => "Invoice",
  },
  {
    entity: "employees",
    label: "Employees",
    permission: "hr.view",
    hub: "/dashboard/hr",
    select: "id,first_name,last_name,email,employee_number",
    display: (r) =>
      [r.first_name, r.last_name].filter(Boolean).join(" ") ||
      String(r.email ?? ""),
    detail: (r) => String(r.employee_number ?? r.email ?? ""),
  },
  {
    entity: "suppliers",
    label: "Suppliers",
    permission: "srm.view",
    hub: "/dashboard/procurement",
    select: "id,name,code,email",
    display: (r) => String(r.name ?? ""),
    detail: (r) => String(r.code ?? r.email ?? ""),
  },
  {
    entity: "purchase_orders",
    label: "Purchase Orders",
    permission: "procurement.view",
    hub: "/dashboard/procurement",
    select: "id,po_number",
    display: (r) => String(r.po_number ?? ""),
    detail: () => "Purchase order",
  },
];

interface RecordHit {
  key: string;
  /** Recent-nav title, e.g. "Products: Widget A". */
  title: string;
  display: string;
  detail: string;
  href: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<ReturnType<typeof getRecentNav>>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<RecordHit[]>([]);
  const [searching, setSearching] = useState(false);
  const openRef = useRef(open);
  const router = useRouter();
  const { hasPermission, loading } = useUser();

  // Mirror dialog state for the window keydown handler without re-binding.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) {
          setOpen(false);
          setQuery("");
          setHits([]);
          setSearching(false);
        } else {
          setRecent(getRecentNav());
          setQuery("");
          setHits([]);
          setSearching(false);
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (href: string, title?: string) => {
      if (title) pushRecentNav(href, title);
      setOpen(false);
      setQuery("");
      setHits([]);
      setSearching(false);
      router.push(href);
    },
    [router]
  );

  const nav = NAV_ITEMS.filter(
    (item) => loading || hasPermission(item.permission)
  );

  // Only query entities the user can view (keeps server calls permission-safe
  // and avoids noisy 403s for gated modules).
  const sources = useMemo(
    () => RECORD_SOURCES.filter((s) => loading || hasPermission(s.permission)),
    [hasPermission, loading]
  );

  // Debounced server-side record search through the hardened CRUD API.
  // Per-entity failures (e.g. permission drift) are swallowed so a single
  // gated module never blocks results from the other sources. State writes
  // only happen in event handlers and async callbacks.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const found: RecordHit[] = [];
      await Promise.all(
        sources.map(async (source) => {
          const path = `/api/v2/crud/${encodeURIComponent(source.entity)}${entityListQueryString(
            {
              search: q,
              pageSize: 5,
              select: source.select,
            }
          )}`;
          try {
            const res = await apiGet<EntityListResult<RecordRow>>(path);
            if (!res.ok) return;
            for (const row of res.data.data) {
              const display = source.display(row) || source.entity;
              found.push({
                key: `${source.entity}-${String(row.id ?? display)}`,
                title: `${source.label}: ${display}`,
                display,
                detail: source.detail(row) || source.entity,
                href: source.hub,
              });
            }
          } catch {
            /* permission / network failure - skip this entity */
          }
        })
      );
      if (cancelled) return;
      setHits(found.slice(0, 12));
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, sources]);

  const showRecords = query.trim().length >= 2;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRecent(getRecentNav());
          setQuery("");
          setHits([]);
          setSearching(false);
          setOpen(true);
        }}
        className="flex items-center gap-2 h-9 rounded-lg border bg-background/80 px-2.5 md:px-3 text-sm text-muted-foreground hover:bg-muted/60 transition-colors md:min-w-[200px] lg:min-w-[280px] shadow-sm"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden md:block flex-1 text-left truncate">
          Search modules, records, actions\u2026
        </span>
        <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {"\u2318K"}
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(v) => {
          if (v) {
            setRecent(getRecentNav());
            setQuery("");
            setHits([]);
            setSearching(false);
            setOpen(true);
          } else {
            setQuery("");
            setHits([]);
            setSearching(false);
            setOpen(false);
          }
        }}
      >
        <CommandInput
          placeholder="Search modules, records, actions\u2026"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            if (v.trim().length >= 2) setSearching(true);
          }}
        />
        <CommandList>
          <CommandEmpty>{searching ? "Searching\u2026" : "No results found."}</CommandEmpty>
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
          {showRecords && (
            <>
              <CommandGroup heading="Records">
                {searching && hits.length === 0 && (
                  <CommandItem disabled className="text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                    Searching records\u2026
                  </CommandItem>
                )}
                {!searching && hits.length === 0 && (
                  <CommandItem disabled className="text-muted-foreground">
                    <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                    No records found
                  </CommandItem>
                )}
                {hits.map((hit) => (
                  <CommandItem
                    key={hit.key}
                    onSelect={() => go(hit.href, hit.title)}
                    className="min-w-0"
                  >
                    <Database className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{hit.display}</span>
                    <span className="ml-auto truncate pl-2 text-[10px] text-muted-foreground font-mono">
                      {hit.detail}
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
