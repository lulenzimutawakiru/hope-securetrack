"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Factory,
  ShieldCheck,
  AlertTriangle,
  Package,
  Warehouse,
  Landmark,
  Users,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { KpiMetric } from "@/components/enterprise/kpi-metric";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

type RoleConfig = {
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
};

const CONFIG: Record<string, RoleConfig> = {
  ceo: {
    title: "CEO Workspace",
    description: "Enterprise-wide performance, risk, and strategic actions",
    links: [
      { label: "Executive BI", href: "/dashboard/reports/executive" },
      { label: "AI Assistant", href: "/dashboard/reports/assistant" },
      { label: "Board docs", href: "/dashboard/reports/intelligence" },
      { label: "Finance hub", href: "/dashboard/finance" },
    ],
  },
  finance: {
    title: "Finance Workspace",
    description: "Liquidity, ledgers, receivables, payables, and tax",
    links: [
      { label: "Chart of Accounts", href: "/dashboard/finance/coa" },
      { label: "Journals", href: "/dashboard/finance/journals" },
      { label: "AR", href: "/dashboard/finance/ar" },
      { label: "AP", href: "/dashboard/finance/ap" },
      { label: "Bank", href: "/dashboard/finance/bank" },
      { label: "Tax", href: "/dashboard/finance/tax" },
    ],
  },
  factory: {
    title: "Factory Workspace",
    description: "Production batches, QC, and print operations",
    links: [
      { label: "Production", href: "/dashboard/production" },
      { label: "QR codes", href: "/dashboard/qr-codes" },
      { label: "Printing", href: "/dashboard/printing" },
      { label: "Printers", href: "/dashboard/printers" },
    ],
  },
  warehouse: {
    title: "Warehouse Workspace",
    description: "Stock positions, GRN, transfers, and valuation",
    links: [
      { label: "Inventory hub", href: "/dashboard/inventory" },
      { label: "Stock", href: "/dashboard/inventory/stock" },
      { label: "GRN", href: "/dashboard/inventory/grn" },
      { label: "Transfers", href: "/dashboard/inventory/transfers" },
      { label: "Valuation", href: "/dashboard/inventory/valuation" },
    ],
  },
  sales: {
    title: "Sales Workspace",
    description: "Pipeline, orders, and customer revenue",
    links: [
      { label: "Sales hub", href: "/dashboard/sales" },
      { label: "Pipeline", href: "/dashboard/sales/pipeline" },
      { label: "Orders", href: "/dashboard/sales/orders" },
      { label: "CRM", href: "/dashboard/crm" },
      { label: "Invoices", href: "/dashboard/invoices" },
    ],
  },
  hr: {
    title: "HR Workspace",
    description: "People operations, leave, and payroll",
    links: [
      { label: "HR hub", href: "/dashboard/hr" },
      { label: "Employees", href: "/dashboard/hr/employees" },
      { label: "Leave", href: "/dashboard/hr/leave" },
      { label: "Payroll", href: "/dashboard/hr/payroll" },
    ],
  },
  security: {
    title: "Security Workspace",
    description: "Fraud, verification, and identity controls",
    links: [
      { label: "Fraud alerts", href: "/dashboard/fraud" },
      { label: "Verification", href: "/dashboard/verification" },
      { label: "Identity", href: "/dashboard/identity" },
      { label: "Audit logs", href: "/dashboard/audit" },
    ],
  },
};

export default function RoleWorkspacePage() {
  const params = useParams();
  const role = String(params.role || "ceo");
  const cfg = CONFIG[role] || CONFIG.ceo;
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    batches: 0,
    fraud: 0,
    reams: 0,
    invoices: 0,
    employees: 0,
    verify: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [b, f, r, inv, emp, v] = await Promise.all([
        supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .in("production_status", ["in_progress", "qc_pending"]),
        supabase
          .from("fraud_alerts")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("reams")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_warehouse"),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("paid","void","cancelled")'),
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("verification_logs")
          .select("*", { count: "exact", head: true })
          .gte("verified_at", `${today}T00:00:00`),
      ]);
      setKpis({
        batches: b.count ?? 0,
        fraud: f.count ?? 0,
        reams: r.count ?? 0,
        invoices: inv.count ?? 0,
        employees: emp.count ?? 0,
        verify: v.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [role]);

  const metrics = useMemo(() => {
    switch (role) {
      case "finance":
        return [
          { title: "Open AR invoices", value: formatNumber(kpis.invoices), icon: Landmark, tone: "warning" as const },
          { title: "Fraud risk open", value: formatNumber(kpis.fraud), icon: AlertTriangle, tone: "danger" as const },
          { title: "Warehouse reams", value: formatNumber(kpis.reams), icon: Package },
          { title: "Active staff", value: formatNumber(kpis.employees), icon: Users },
        ];
      case "warehouse":
        return [
          { title: "Reams on hand", value: formatNumber(kpis.reams), icon: Warehouse, tone: "info" as const },
          { title: "Batches in progress", value: formatNumber(kpis.batches), icon: Factory },
          { title: "Open fraud", value: formatNumber(kpis.fraud), icon: AlertTriangle },
          { title: "Verifications today", value: formatNumber(kpis.verify), icon: ShieldCheck },
        ];
      case "factory":
        return [
          { title: "Batches in progress", value: formatNumber(kpis.batches), icon: Factory, tone: "info" as const },
          { title: "Verifications today", value: formatNumber(kpis.verify), icon: ShieldCheck },
          { title: "Warehouse reams", value: formatNumber(kpis.reams), icon: Package },
          { title: "Open fraud", value: formatNumber(kpis.fraud), icon: AlertTriangle, tone: "warning" as const },
        ];
      case "hr":
        return [
          { title: "Active employees", value: formatNumber(kpis.employees), icon: Users, tone: "success" as const },
          { title: "Batches running", value: formatNumber(kpis.batches), icon: Factory },
          { title: "Open AR", value: formatNumber(kpis.invoices), icon: Landmark },
          { title: "Security alerts", value: formatNumber(kpis.fraud), icon: AlertTriangle },
        ];
      case "sales":
        return [
          { title: "Open invoices", value: formatNumber(kpis.invoices), icon: ShoppingCart, tone: "info" as const },
          { title: "Stock reams", value: formatNumber(kpis.reams), icon: Package },
          { title: "Batches WIP", value: formatNumber(kpis.batches), icon: Factory },
          { title: "Verifications", value: formatNumber(kpis.verify), icon: ShieldCheck },
        ];
      case "security":
        return [
          { title: "Open fraud alerts", value: formatNumber(kpis.fraud), icon: AlertTriangle, tone: "danger" as const },
          { title: "Verifications today", value: formatNumber(kpis.verify), icon: ShieldCheck, tone: "success" as const },
          { title: "Batches WIP", value: formatNumber(kpis.batches), icon: Factory },
          { title: "Active staff", value: formatNumber(kpis.employees), icon: Users },
        ];
      default:
        return [
          { title: "Batches WIP", value: formatNumber(kpis.batches), icon: Factory, tone: "info" as const },
          { title: "Open fraud", value: formatNumber(kpis.fraud), icon: AlertTriangle, tone: kpis.fraud ? "danger" as const : "success" as const },
          { title: "Open invoices", value: formatNumber(kpis.invoices), icon: Landmark },
          { title: "Active people", value: formatNumber(kpis.employees), icon: Users, tone: "success" as const },
        ];
    }
  }, [role, kpis]);

  if (loading) return <LoadingState message={`Loading ${cfg.title}…`} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/workspaces">All workspaces</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard">Main dashboard</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <KpiMetric key={m.title} title={m.title} value={m.value} icon={m.icon} tone={m.tone} />
        ))}
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium hover:border-accent/40 hover:bg-muted/40 transition-colors"
            >
              {l.label}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
