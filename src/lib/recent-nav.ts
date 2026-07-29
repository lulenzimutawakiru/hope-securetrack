/**
 * Persist recently visited dashboard modules for command palette & home.
 */

const KEY = "hope-securetrack-recent-nav";
const MAX = 12;

export type RecentNavItem = {
  href: string;
  title: string;
  visitedAt: number;
};

export function getRecentNav(): RecentNavItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentNavItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.href === "string" && typeof r.title === "string")
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentNav(href: string, title: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecentNav().filter((r) => r.href !== href);
    const next: RecentNavItem[] = [
      { href, title, visitedAt: Date.now() },
      ...prev,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}
