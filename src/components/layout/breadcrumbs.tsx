"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { breadcrumbForPath } from "@/lib/nav-labels";

/**
 * Dashboard breadcrumb trail rendered above page content. Labels resolve from
 * NAV_ITEMS module roots and the per-module *MENU catalogs (finance, payroll,
 * fleet, ...) with a humanized-slug fallback for unmatched segments.
 */
export function Breadcrumbs({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const crumbs = breadcrumbForPath(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex min-w-0 items-center text-xs text-muted-foreground ${className}`}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={`${crumb.label}-${index}`}
              className="flex min-w-0 items-center gap-1"
            >
              {index > 0 && (
                <ChevronRight
                  className="h-3 w-3 shrink-0 opacity-50"
                  aria-hidden="true"
                />
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="max-w-[14rem] truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="max-w-[16rem] truncate font-medium text-foreground"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
