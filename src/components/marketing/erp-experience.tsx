"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, Banknote, Box, Briefcase, Factory, FolderKanban,
  Landmark, LayoutDashboard, Package, ShoppingCart, Sparkles, Ticket,
  TrendingUp, Truck, Users, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ModulePreview = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  kpis: Array<{ label: string; value: string; delta: string }>;
  bars: number[];
  rows: Array<{ title: string; value: string; sub: string }>;
};

const PREVIEWS: ModulePreview[] = [
  { id: "executive", label: "Executive", icon: LayoutDashboard,
    kpis: [{ label: "Revenue", value: "$8.4M", delta: "+12%" }, { label: "Net margin", value: "21.4%", delta: "+1.8pts" }, { label: "Cash", value: "$3.1M", delta: "+9%" }],
    bars: [42, 48, 45, 52, 58, 63, 61, 70, 74, 81, 79, 88],
    rows: [{ title: "Top region", value: "East Africa", sub: "$2.9M MTD" }, { title: "AI risk flag", value: "Low", sub: "No anomalies this week" }, { title: "Month close", value: "Day 2", sub: "vs 12-day baseline" }] },
  { id: "finance", label: "Finance", icon: Landmark,
    kpis: [{ label: "AR balance", value: "$4.2M", delta: "-6%" }, { label: "DSO", value: "38 days", delta: "-4 days" }, { label: "AP due", value: "$1.8M", delta: "on time" }],
    bars: [30, 42, 38, 50, 46, 58, 55, 62, 60, 71, 68, 76],
    rows: [{ title: "Unpaid invoices", value: "214", sub: "12 flagged by AI" }, { title: "Cash forecast", value: "$3.1M", sub: "30-day outlook" }, { title: "FX exposure", value: "USD 1.2M", sub: "hedge suggested" }] },
  { id: "manufacturing", label: "Manufacturing", icon: Factory,
    kpis: [{ label: "OEE", value: "87%", delta: "+5pts" }, { label: "Orders open", value: "46", delta: "on time" }, { label: "Scrap rate", value: "2.1%", delta: "-0.6pts" }],
    bars: [55, 60, 58, 66, 70, 68, 75, 78, 82, 80, 88, 91],
    rows: [{ title: "Batch TR-8821", value: "Complete", sub: "Quality passed" }, { title: "Machine MT-04", value: "Health 94", sub: "PM due in 6 days" }, { title: "Line utilisation", value: "91%", sub: "+4% this shift" }] },
  { id: "crm", label: "CRM", icon: Users,
    kpis: [{ label: "Pipeline", value: "$6.8M", delta: "+18%" }, { label: "Win rate", value: "34%", delta: "+3pts" }, { label: "New leads", value: "482", delta: "+11%" }],
    bars: [24, 30, 28, 36, 42, 40, 48, 52, 58, 62, 68, 74],
    rows: [{ title: "Top opportunity", value: "$1.2M", sub: "Phase 2 · 92% score" }, { title: "Follow-ups due", value: "38", sub: "AI rescheduled 9" }, { title: "Churn risk", value: "6 accounts", sub: "expansion playbook ready" }] },
  { id: "inventory", label: "Inventory", icon: Package,
    kpis: [{ label: "Stock value", value: "$7.6M", delta: "-3%" }, { label: "Turnover", value: "8.2x", delta: "+0.9x" }, { label: "Stockouts", value: "14", delta: "-11" }],
    bars: [70, 66, 72, 64, 58, 60, 52, 48, 44, 46, 40, 38],
    rows: [{ title: "Re-order suggested", value: "23 SKUs", sub: "AI demand forecast" }, { title: "Dead stock", value: "$210K", sub: "markdown plan ready" }, { title: "Cycle count", value: "98.6%", sub: "accuracy this month" }] },
  { id: "hr", label: "HR", icon: Briefcase,
    kpis: [{ label: "Headcount", value: "1,284", delta: "+3%" }, { label: "Attrition", value: "9.1%", delta: "-1.4pts" }, { label: "Open roles", value: "27", delta: "median 21d" }],
    bars: [30, 34, 32, 38, 40, 44, 42, 48, 50, 54, 52, 58],
    rows: [{ title: "Onboarding", value: "42 active", sub: "14 complete today" }, { title: "Skills gap", value: "3 teams", sub: "learning plan ready" }, { title: "Contracts expiring", value: "11", sub: "renewals queued" }] },
  { id: "payroll", label: "Payroll", icon: Banknote,
    kpis: [{ label: "Run cost", value: "$1.9M", delta: "+2%" }, { label: "On-time", value: "100%", delta: "12 runs" }, { label: "Exceptions", value: "3", delta: "-7" }],
    bars: [40, 42, 44, 46, 45, 48, 50, 52, 54, 56, 58, 60],
    rows: [{ title: "Next run", value: "Aug 28", sub: "1,284 employees" }, { title: "Statutory", value: "PAYE + NSSF", sub: "files ready" }, { title: "AI check", value: "Passed", sub: "no anomalies found" }] },
  { id: "procurement", label: "Procurement", icon: ShoppingCart,
    kpis: [{ label: "Spend MTD", value: "$2.3M", delta: "-8%" }, { label: "POs awaiting", value: "64", delta: "12 in draft" }, { label: "Savings", value: "$180K", delta: "+$42K" }],
    bars: [35, 40, 38, 44, 48, 52, 50, 56, 60, 58, 64, 68],
    rows: [{ title: "3-way match", value: "97.2%", sub: "auto-approved" }, { title: "Supplier risk", value: "2 elevated", sub: "reviews scheduled" }, { title: "RFQs open", value: "18", sub: "avg 4 bids" }] },
  { id: "projects", label: "Projects", icon: FolderKanban,
    kpis: [{ label: "Portfolio", value: "$24M", delta: "on budget" }, { label: "On-time", value: "91%", delta: "+6pts" }, { label: "At risk", value: "4", delta: "AI flagged" }],
    bars: [28, 34, 32, 40, 44, 48, 46, 52, 56, 60, 64, 70],
    rows: [{ title: "Margin", value: "18.6%", sub: "vs 16% target" }, { title: "Resource load", value: "84%", sub: "balanced next 2 wks" }, { title: "Change requests", value: "9", sub: "3 pending approval" }] },
  { id: "assets", label: "Assets", icon: Box,
    kpis: [{ label: "Assets", value: "6,420", delta: "+58" }, { label: "Availability", value: "97.3%", delta: "+1.1pts" }, { label: "Health", value: "91/100", delta: "AI score" }],
    bars: [50, 52, 55, 58, 60, 63, 65, 68, 70, 72, 75, 78],
    rows: [{ title: "Due maintenance", value: "38", sub: "scheduled this week" }, { title: "Warranty expiring", value: "9", sub: "claims ready" }, { title: "Under-utilised", value: "12 assets", sub: "reallocation suggested" }] },
  { id: "fleet", label: "Fleet", icon: Truck,
    kpis: [{ label: "Vehicles", value: "120", delta: "98% active" }, { label: "Fuel", value: "$86K", delta: "-14%" }, { label: "Utilisation", value: "84%", delta: "+9pts" }],
    bars: [44, 48, 50, 54, 52, 58, 62, 60, 66, 70, 72, 76],
    rows: [{ title: "On route", value: "74", sub: "live GPS feed" }, { title: "Fuel anomaly", value: "2 vehicles", sub: "alerts sent" }, { title: "Next service", value: "16 due", sub: "this month" }] },
  { id: "ai", label: "AI", icon: Sparkles,
    kpis: [{ label: "Insights", value: "1,240", delta: "this month" }, { label: "Anomalies", value: "17", delta: "-12" }, { label: "Uptime", value: "99.9%", delta: "tenant-isolated" }],
    bars: [20, 26, 32, 30, 40, 46, 52, 58, 64, 70, 78, 86],
    rows: [{ title: "Executive pack", value: "Ready", sub: "generated in 12s" }, { title: "Forecast", value: "Q4 +9%", sub: "confidence 87%" }, { title: "OCR processed", value: "8,420 docs", sub: "99.2% accuracy" }] },
  { id: "analytics", label: "Analytics", icon: Activity,
    kpis: [{ label: "Dashboards", value: "64", delta: "live" }, { label: "Reports", value: "1,020", delta: "scheduled" }, { label: "Drill-downs", value: "38K", delta: "this month" }],
    bars: [32, 38, 36, 44, 48, 52, 56, 54, 62, 66, 72, 78],
    rows: [{ title: "Top dashboard", value: "Executive", sub: "214 views today" }, { title: "Exports", value: "2,840", sub: "PDF · Excel · CSV" }, { title: "AI narrative", value: "Weekly", sub: "auto-distributed" }] },
  { id: "service-desk", label: "Service Desk", icon: Ticket,
    kpis: [{ label: "Open tickets", value: "126", delta: "-18%" }, { label: "SLA met", value: "96.4%", delta: "+2.1pts" }, { label: "CSAT", value: "4.7/5", delta: "+0.2" }],
    bars: [80, 76, 72, 70, 65, 62, 58, 55, 52, 48, 45, 42],
    rows: [{ title: "Auto-triage", value: "68%", sub: "AI classified" }, { title: "Escalated", value: "9", sub: "SLA timer active" }, { title: "Knowledge hits", value: "42%", sub: "resolved via KB" }] },
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
                  ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <PIcon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
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
            className="p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-semibold leading-tight">{active.label} module</h3>
                  <p className="text-xs text-muted-foreground">Live preview · sample tenant data</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> Updated just now
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {active.kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-border bg-muted/50 p-3.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{kpi.value}</div>
                  {kpi.delta ? (
                    <div className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{kpi.delta}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">12-month trend</span>
                  <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="flex h-32 items-end gap-1.5" aria-hidden="true">
                  {active.bars.map((h, i) => (
                    <div
                      key={i}
                      className="w-full rounded-sm bg-gradient-to-t from-primary/80 to-accent"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                {active.rows.map((row) => (
                  <div key={row.title} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{row.title}</div>
                      <div className="text-xs text-muted-foreground">{row.sub}</div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}