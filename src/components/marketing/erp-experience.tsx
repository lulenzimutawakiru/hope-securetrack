"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Banknote, BarChart3, Box, Briefcase, Factory, FolderKanban,
  Landmark, LayoutDashboard, Package, ShoppingCart, Ticket, TrendingUp,
  Truck, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScreenshotFrame } from "./screenshot-frame";

type ModulePreview = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  screenshot: string;
  caption: string;
};

const PREVIEWS: ModulePreview[] = [
  { id: "executive", label: "Executive", icon: LayoutDashboard, screenshot: "/screenshots/executive.jpg", caption: "Real-time group KPIs, cash position, and AI risk flags on one screen." },
  { id: "finance", label: "Finance", icon: Landmark, screenshot: "/screenshots/finance.jpg", caption: "AR, AP, DSO, cash forecast, and month-end close live." },
  { id: "manufacturing", label: "Manufacturing", icon: Factory, screenshot: "/screenshots/production.jpg", caption: "MES platform with OEE, batch quality, and machine health." },
  { id: "crm", label: "CRM", icon: Users, screenshot: "/screenshots/crm.jpg", caption: "Pipeline, win rates, follow-ups, and churn risk scored by AI." },
  { id: "inventory", label: "Inventory", icon: Package, screenshot: "/screenshots/inventory.jpg", caption: "Stock value, turnover, re-order suggestions, and cycle counts." },
  { id: "hr", label: "HR", icon: Briefcase, screenshot: "/screenshots/hr.jpg", caption: "Headcount, attrition, onboarding, and skills planning." },
  { id: "payroll", label: "Payroll", icon: Banknote, screenshot: "/screenshots/payroll.jpg", caption: "Payroll runs, statutory files, and AI exception checks." },
  { id: "procurement", label: "Procurement", icon: ShoppingCart, screenshot: "/screenshots/procurement.jpg", caption: "Spend, POs, three-way match, and supplier risk." },
  { id: "projects", label: "Projects", icon: FolderKanban, screenshot: "/screenshots/projects.jpg", caption: "Portfolio health, on-time delivery, and resource load." },
  { id: "assets", label: "Assets", icon: Box, screenshot: "/screenshots/assets.jpg", caption: "Asset tagging, health scores, maintenance, and lifecycle cost." },
  { id: "fleet", label: "Fleet", icon: Truck, screenshot: "/screenshots/fleet.jpg", caption: "Vehicles, fuel, maintenance, and dispatch intelligence." },
  { id: "sales", label: "Sales", icon: TrendingUp, screenshot: "/screenshots/sales.jpg", caption: "Orders, revenue, and advanced sales analytics." },
  { id: "service-desk", label: "Service Desk", icon: Ticket, screenshot: "/screenshots/service-desk.jpg", caption: "Tickets, SLAs, escalations, and resolution insights." },
  { id: "reports", label: "Reports", icon: Activity, screenshot: "/screenshots/reports.jpg", caption: "KPI engine, scheduled reports, and drill-down analytics." },
  { id: "analytics", label: "Analytics", icon: BarChart3, screenshot: "/screenshots/analytics.jpg", caption: "Analytics Studio with AI forecasts and interactive models." },
];

export function ErpExperience() {
  const [activeId, setActiveId] = useState("executive");
  const active = useMemo(() => PREVIEWS.find((p) => p.id === activeId) ?? PREVIEWS[0], [activeId]);
  const Icon = active.icon;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2" role="tablist" aria-label="Modules">
        {PREVIEWS.map((p) => {
          const PIcon = p.icon;
          const selected = p.id === activeId;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(p.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition",
                selected
                  ? "border-hope-blue/40 bg-hope-blue/10 text-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-hope-blue/30 hover:text-foreground",
              )}
            >
              <PIcon className={cn("h-4 w-4", selected ? "text-hope-blue" : "text-muted-foreground")} aria-hidden="true" />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-hope-blue/10 text-hope-blue">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold leading-tight">{active.label}</h3>
                  <p className="text-xs text-muted-foreground">Real SecureTrack ERP screenshot</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Live product
              </span>
            </div>

            <div className="mt-5">
              <ScreenshotFrame
                src={active.screenshot}
                alt={`SecureTrack ERP ${active.label} dashboard screenshot`}
                title={`${active.label} · SecureTrack ERP`}
                badge="Live"
              />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{active.caption}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
