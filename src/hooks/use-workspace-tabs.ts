"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useUser } from "@/hooks/use-user";
import { canAccessRoute } from "@/lib/auth/rbac";

const STORAGE_KEY = "hope:workspace-tabs:v1";
const MAX_TABS = 12;

export type WorkspaceTab = {
  href: string;
  title: string;
  pinned?: boolean;
};

function titleForPath(pathname: string): string {
  const exact = NAV_ITEMS.find((n) => n.href === pathname);
  if (exact) return exact.title;

  // longest prefix match
  const match = [...NAV_ITEMS]
    .filter((n) => n.href !== "/dashboard" && pathname.startsWith(n.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (match) {
    const rest = pathname.slice(match.href.length).replace(/^\//, "");
    if (!rest) return match.title;
    const segment = rest.split("/")[0];
    return `${match.title} · ${segment.replace(/-/g, " ")}`;
  }

  if (pathname.startsWith("/dashboard/workspaces")) return "Workspaces";
  if (pathname.startsWith("/dashboard/recycle-bin")) return "Recycle Bin";
  if (pathname.startsWith("/dashboard/notifications")) return "Notifications";
  if (pathname.startsWith("/dashboard/boards")) return "Boards";
  if (pathname.startsWith("/dashboard/recycle-bin")) return "Recycle Bin";
  return "Workspace";
}

function loadTabs(): WorkspaceTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [{ href: "/dashboard", title: "Dashboard", pinned: true }];
    const parsed = JSON.parse(raw) as WorkspaceTab[];
    if (!Array.isArray(parsed) || !parsed.length) {
      return [{ href: "/dashboard", title: "Dashboard", pinned: true }];
    }
    return parsed;
  } catch {
    return [{ href: "/dashboard", title: "Dashboard", pinned: true }];
  }
}

export function useWorkspaceTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, loading: authLoading, isPlatformAdmin } = useUser();
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => loadTabs());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTabs(loadTabs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs, ready]);

  // Drop tabs the user is no longer allowed to open (role change / re-login)
  useEffect(() => {
    if (!ready || authLoading) return;
    setTabs((prev) => {
      const filtered = prev.filter(
        (t) =>
          t.href === "/dashboard" ||
          canAccessRoute(auth?.permissions, t.href, { isPlatformAdmin })
      );
      if (filtered.length === prev.length) return prev;
      if (!filtered.length) {
        return [{ href: "/dashboard", title: "Dashboard", pinned: true }];
      }
      return filtered;
    });
  }, [ready, authLoading, auth?.permissions, isPlatformAdmin]);

  // Open / focus tab on navigation
  useEffect(() => {
    if (!ready || !pathname?.startsWith("/dashboard")) return;
    // Never add a tab for a route the user cannot access
    if (
      !authLoading &&
      !canAccessRoute(auth?.permissions, pathname, { isPlatformAdmin })
    ) {
      return;
    }
    const title = titleForPath(pathname);
    setTabs((prev) => {
      const exists = prev.find((t) => t.href === pathname);
      if (exists) {
        return prev.map((t) =>
          t.href === pathname ? { ...t, title } : t
        );
      }
      const next = [...prev, { href: pathname, title }];
      if (next.length > MAX_TABS) {
        // drop oldest unpinned non-active
        const dropIdx = next.findIndex(
          (t) => !t.pinned && t.href !== pathname && t.href !== "/dashboard"
        );
        if (dropIdx >= 0) next.splice(dropIdx, 1);
        else if (next.length > MAX_TABS) next.splice(1, 1);
      }
      return next;
    });
  }, [pathname, ready, authLoading, auth?.permissions, isPlatformAdmin]);

  const activeHref = pathname || "/dashboard";

  const openTab = useCallback(
    (href: string) => {
      if (
        !canAccessRoute(auth?.permissions, href, { isPlatformAdmin })
      ) {
        return;
      }
      router.push(href);
    },
    [router, auth?.permissions, isPlatformAdmin]
  );

  const closeTab = useCallback(
    (href: string) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.href === href);
        if (tab?.pinned) return prev;
        const next = prev.filter((t) => t.href !== href);
        if (!next.length) {
          return [{ href: "/dashboard", title: "Dashboard", pinned: true }];
        }
        if (href === pathname) {
          const idx = prev.findIndex((t) => t.href === href);
          const fallback = next[Math.max(0, idx - 1)] || next[0];
          queueMicrotask(() => router.push(fallback.href));
        }
        return next;
      });
    },
    [pathname, router]
  );

  const togglePin = useCallback((href: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.href === href ? { ...t, pinned: !t.pinned } : t
      )
    );
  }, []);

  const closeOthers = useCallback(
    (href: string) => {
      setTabs((prev) => {
        const keep = prev.filter((t) => t.pinned || t.href === href);
        if (!keep.find((t) => t.href === href)) {
          const cur = prev.find((t) => t.href === href);
          if (cur) keep.push(cur);
        }
        if (!keep.find((t) => t.href === "/dashboard")) {
          keep.unshift({ href: "/dashboard", title: "Dashboard", pinned: true });
        }
        return keep;
      });
      if (pathname !== href) router.push(href);
    },
    [pathname, router]
  );

  const ordered = useMemo(() => {
    const pinned = tabs.filter((t) => t.pinned);
    const rest = tabs.filter((t) => !t.pinned);
    return [...pinned, ...rest];
  }, [tabs]);

  return {
    tabs: ordered,
    activeHref,
    openTab,
    closeTab,
    togglePin,
    closeOthers,
    ready,
  };
}
