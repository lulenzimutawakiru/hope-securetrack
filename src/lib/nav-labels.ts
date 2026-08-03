/**
 * Navigation label resolution for breadcrumbs and wayfinding.
 *
 * Sources:
 * - NAV_ITEMS provides the module roots (Dashboard, Finance, Inventory, ...).
 * - The per-module *MENU catalogs (finance, payroll, fleet, attendance, sales,
 *   ppm, mes, ta, lbl) provide human titles for deep feature routes that were
 *   previously unreachable metadata. Breadcrumbs are the first consumer that
 *   wires these catalogs into the UI.
 * - Unmatched tail segments fall back to humanized slugs with a small
 *   abbreviation override map for common ERP acronyms.
 */

import { NAV_ITEMS } from "@/lib/constants";
import { FINANCE_MENU } from "@/lib/finance/menu";
import { PAY_MENU } from "@/lib/payroll/menu";
import { FLEET_MENU } from "@/lib/fleet/menu";
import { ATT_MENU } from "@/lib/attendance/menu";
import { SALES_MENU } from "@/lib/sales/menu";
import { PPM_MENU } from "@/lib/ppm/menu";
import { MES_MENU } from "@/lib/mes/menu";
import { TA_MENU } from "@/lib/ta/menu";
import { LBL_MENU } from "@/lib/lbl/menu";

interface MenuLink {
  title: string;
  href: string;
}

export interface Crumb {
  label: string;
  href?: string;
}

const MENU_CATALOGS: readonly (readonly MenuLink[])[] = [
  FINANCE_MENU,
  PAY_MENU,
  FLEET_MENU,
  ATT_MENU,
  SALES_MENU,
  PPM_MENU,
  MES_MENU,
  TA_MENU,
  LBL_MENU,
];

/** href -> human title, longest known labels win (catalogs override slugs). */
export const LABEL_BY_HREF: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const nav of NAV_ITEMS) map.set(nav.href, nav.title);
  for (const menu of MENU_CATALOGS) {
    for (const link of menu) map.set(link.href, link.title);
  }
  return map;
})();

/** Common ERP abbreviation expansions for unmatched path segments. */
const SEGMENT_OVERRIDES: Record<string, string> = {
  coa: "Chart of Accounts",
  ap: "Accounts Payable",
  ar: "Accounts Receivable",
  gl: "General Ledger",
  cfo: "CFO Cockpit",
  ai: "AI Assistant",
  bi: "Business Intelligence",
  wht: "Withholding Tax",
  sod: "Segregation of Duties",
  wip: "Work in Progress",
  grn: "Goods Receipt",
  po: "Purchase Orders",
  pr: "Purchase Requisitions",
  ppm: "Projects",
  mes: "Manufacturing",
  ta: "Talent Acquisition",
  lbl: "Labels",
  sd: "Service Desk",
  wid: "ID Credentials",
  hc: "SecureChat",
  hr: "HR",
  wfm: "Workforce",
  scm: "Supply Chain",
  oee: "OEE",
  qc: "Quality Control",
  kpi: "KPIs",
};

function humanizeSegment(segment: string): string {
  const key = segment.toLowerCase();
  if (SEGMENT_OVERRIDES[key]) return SEGMENT_OVERRIDES[key];
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isRecordSegment(segment: string): boolean {
  if (/^\d+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  return segment === "edit" || segment === "new" || segment === "view";
}

function recordLabel(segment: string): string {
  if (segment === "edit") return "Edit";
  if (segment === "new") return "New";
  return "Details";
}

/**
 * Resolve a dashboard pathname into a breadcrumb trail.
 * Example: /dashboard/finance/coa -> Dashboard / Finance / Chart of Accounts
 */
export function breadcrumbForPath(pathname: string): Crumb[] {
  if (!pathname.startsWith("/dashboard")) {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }
  if (pathname === "/dashboard") return [{ label: "Dashboard" }];

  const crumbs: Crumb[] = [{ label: "Dashboard", href: "/dashboard" }];

  // Longest matching module root (excludes /dashboard itself).
  const moduleRoot = [...NAV_ITEMS]
    .filter(
      (item) =>
        item.href !== "/dashboard" &&
        (pathname === item.href || pathname.startsWith(item.href + "/"))
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  const base = moduleRoot ? moduleRoot.href : "/dashboard";
  if (moduleRoot) crumbs.push({ label: moduleRoot.title, href: moduleRoot.href });

  const rest = pathname.slice(base.length).replace(/^\//, "");
  if (!rest) return crumbs;

  const segments = rest.split("/");

  // Greedy longest-prefix match against known labels (deep feature titles).
  for (let i = segments.length; i >= 1; i--) {
    const candidate = `${base}/${segments.slice(0, i).join("/")}`;
    const known = LABEL_BY_HREF.get(candidate);
    if (known) {
      crumbs.push({ label: known });
      for (const tail of segments.slice(i)) {
        crumbs.push({
          label: isRecordSegment(tail) ? recordLabel(tail) : humanizeSegment(tail),
        });
      }
      return crumbs;
    }
  }

  // No known feature label: humanize each remaining segment.
  for (const segment of segments) {
    crumbs.push({
      label: isRecordSegment(segment) ? recordLabel(segment) : humanizeSegment(segment),
    });
  }
  return crumbs;
}
