"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileSignature, Receipt, Handshake, ShoppingBag,
  Landmark, AlertTriangle, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DRILL = [
  { title: "Hub", href: "/dashboard/contracts", icon: LayoutDashboard, exact: true },
  { title: "Sales", href: "/dashboard/contracts/sales", icon: FileSignature },
  { title: "Billing", href: "/dashboard/contracts/billing", icon: Receipt },
  { title: "CRM", href: "/dashboard/contracts/crm", icon: Handshake },
  { title: "Procurement", href: "/dashboard/contracts/procurement", icon: ShoppingBag },
  { title: "Government", href: "/dashboard/contracts/government", icon: Landmark },
  { title: "Expiring", href: "/dashboard/contracts/expiring", icon: AlertTriangle },
  { title: "Analytics", href: "/dashboard/contracts/analytics", icon: BarChart3 },
] as const;

export function ContractsSubnav() {
  const pathname = usePathname() || "";

  return (
    <div className="mb-5 -mx-1">
      <div className="flex items-center gap-2 px-1 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Contracts
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
        {DRILL.map((item) => {
          const exact = "exact" in item && item.exact;
          const active = exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
