"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Target,
  FileSignature,
  CreditCard,
  RotateCcw,
  Trophy,
  Brain,
  ArrowRight,
  Users,
  Truck,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const LIFECYCLE = [
  "Lead",
  "Opportunity",
  "Quotation",
  "Order",
  "Credit",
  "Inventory / Production",
  "Delivery",
  "Invoice",
  "Payment",
  "Support",
];

const MODULES = [
  { title: "Pipeline", href: "/dashboard/sales/pipeline", icon: Target, desc: "Leads & opportunities" },
  { title: "Quotations", href: "/dashboard/sales/quotations", icon: FileSignature, desc: "Quotes, revisions, convert" },
  { title: "Orders", href: "/dashboard/sales/orders", icon: ShoppingCart, desc: "Order-to-cash orders" },
  { title: "Credit", href: "/dashboard/sales/credit", icon: CreditCard, desc: "Limits, holds, approvals" },
  { title: "Returns", href: "/dashboard/sales/returns", icon: RotateCcw, desc: "RMA, claims, credit notes" },
  { title: "Commissions", href: "/dashboard/sales/commissions", icon: Trophy, desc: "Rep incentives" },
  { title: "Invoices", href: "/dashboard/invoices", icon: Receipt, desc: "Tax invoices & payments" },
  { title: "Dispatch", href: "/dashboard/dispatch", icon: Truck, desc: "Delivery & logistics" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
  product_code: string | null;
}

export default function SalesCommandCenterPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    openOrders: 0,
    quotes: 0,
    pipelineValue: 0,
    invoices: 0,
    outstanding: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        cust,
        orders,
        quotes,
        opps,
        inv,
        { data: insightData },
        { data: openInvoices },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase
          .from("sales_orders")
          .select("*", { count: "exact", head: true })
          .in("status", ["confirmed", "picking", "dispatched"]),
        supabase
          .from("quotations")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "sent"]),
        supabase
          .from("sales_opportunities")
          .select("expected_value, stage")
          .not("stage", "in", '("won","lost")'),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase
          .from("sales_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("total_amount, amount_paid, status")
          .not("status", "in", '("paid","void","cancelled")'),
      ]);

      const pipelineValue = (opps.data ?? []).reduce(
        (s, o) => s + Number(o.expected_value || 0),
        0
      );
      const outstanding = (openInvoices ?? []).reduce(
        (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)),
        0
      );

      setStats({
        customers: cust.count ?? 0,
        openOrders: orders.count ?? 0,
        quotes: quotes.count ?? 0,
        pipelineValue,
        invoices: inv.count ?? 0,
        outstanding,
      });
      setInsights((insightData as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading sales command center…" />;

  return (
    <div>
      <PageHeader
        title="Sales & Revenue Management"
        description="Hope Design Group Ltd — Security Printing · Paper · Engineering · Quote-to-cash"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/sales/quotations">
              <Button>New quotation</Button>
            </Link>
            <Link href="/dashboard/sales/orders">
              <Button variant="outline">Sales orders</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy via-[#0d2847] to-hope-teal text-white p-4 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          Sales lifecycle
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {LIFECYCLE.map((step, i) => (
            <span
              key={step}
              className="inline-flex items-center text-[10px] sm:text-xs bg-white/10 border border-white/15 rounded-full px-2 py-0.5"
            >
              {i + 1}. {step}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <StatCard title="Customers" value={formatNumber(stats.customers)} icon={Users} />
        <StatCard title="Open orders" value={formatNumber(stats.openOrders)} icon={ShoppingCart} />
        <StatCard title="Open quotes" value={formatNumber(stats.quotes)} />
        <StatCard
          title="Pipeline"
          value={`UGX ${formatNumber(Math.round(stats.pipelineValue))}`}
        />
        <StatCard title="Invoices" value={formatNumber(stats.invoices)} />
        <StatCard
          title="Receivables"
          value={`UGX ${formatNumber(Math.round(stats.outstanding))}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-hope-teal" />
              AI Sales Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Insights appear as pipeline and order volume grows.
              </p>
            ) : (
              insights.map((i) => (
                <div key={i.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{i.title}</p>
                    <StatusBadge status={i.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.recommendation}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {i.insight_type.replace(/_/g, " ")}
                    </Badge>
                    {i.product_code && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {i.product_code}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channels</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>B2B · B2C · Distributors · Dealers</p>
            <p>Wholesale · Retail · Government · Export</p>
            <p className="text-xs pt-2">
              Integrates with Inventory, Manufacturing, Finance, Warehouse,
              Logistics, CRM, and SecureTrack product verification.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border p-4 hover:border-hope-teal/40 hover:bg-muted/40 transition-colors"
            >
              <div className="flex justify-between mb-2">
                <Icon className="h-5 w-5 text-hope-teal" />
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
