"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Network,
  TrendingUp,
  CalendarRange,
  Cog,
  ArrowLeftRight,
  AlertTriangle,
  Leaf,
  Brain,
  ArrowRight,
  Radar,
  BarChart3,
  FileBarChart,
  Factory,
  ShoppingBag,
  Warehouse,
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

const FLOW = [
  "Demand",
  "S&OP",
  "Supply",
  "Procurement",
  "Inventory",
  "Manufacturing",
  "Distribution",
  "Delivery",
  "Returns",
];

const MODULES = [
  { title: "Control Tower", href: "/dashboard/scm/tower", icon: Radar, desc: "End-to-end live visibility" },
  { title: "Demand Planning", href: "/dashboard/scm/demand", icon: TrendingUp, desc: "Forecasts & AI demand" },
  { title: "S&OP", href: "/dashboard/scm/sop", icon: CalendarRange, desc: "Sales & operations plans" },
  { title: "MRP", href: "/dashboard/scm/mrp", icon: Cog, desc: "Material requirements" },
  { title: "DRP", href: "/dashboard/scm/drp", icon: ArrowLeftRight, desc: "Distribution balancing" },
  { title: "Risks", href: "/dashboard/scm/risks", icon: AlertTriangle, desc: "Resilience & alerts" },
  { title: "KPIs", href: "/dashboard/scm/kpis", icon: BarChart3, desc: "Scorecard metrics" },
  { title: "Sustainability", href: "/dashboard/scm/sustainability", icon: Leaf, desc: "ESG & carbon" },
  { title: "Reports", href: "/dashboard/scm/reports", icon: FileBarChart, desc: "Planning & executive" },
  { title: "Procurement", href: "/dashboard/procurement", icon: ShoppingBag, desc: "Source-to-pay" },
  { title: "Inventory", href: "/dashboard/inventory", icon: Warehouse, desc: "Stock & GRN" },
  { title: "Production", href: "/dashboard/production", icon: Factory, desc: "Manufacturing" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

export default function ScmHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    forecastLines: 0,
    openMrp: 0,
    openRisks: 0,
    openPo: 0,
    inTransit: 0,
    inventoryValue: 0,
    otd: 0,
    fillRate: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        fc,
        mrp,
        risks,
        po,
        ship,
        bal,
        kpi,
        { data: ins },
      ] = await Promise.all([
        supabase.from("demand_forecasts").select("*", { count: "exact", head: true }),
        supabase
          .from("mrp_recommendations")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("supply_chain_risks")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "mitigating"]),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("closed","cancelled")'),
        supabase
          .from("inbound_shipments")
          .select("*", { count: "exact", head: true })
          .in("status", ["in_transit", "booked", "delayed"]),
        supabase.from("stock_balances").select("total_value"),
        supabase
          .from("scm_kpi_snapshots")
          .select("on_time_delivery_pct, fill_rate_pct")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("scm_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const inventoryValue = (bal.data ?? []).reduce(
        (s, b) => s + Number(b.total_value || 0),
        0
      );

      setStats({
        forecastLines: fc.count ?? 0,
        openMrp: mrp.count ?? 0,
        openRisks: risks.count ?? 0,
        openPo: po.count ?? 0,
        inTransit: ship.count ?? 0,
        inventoryValue,
        otd: Number(kpi.data?.on_time_delivery_pct ?? 0),
        fillRate: Number(kpi.data?.fill_rate_pct ?? 0),
      });
      setInsights((ins as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading supply chain command centre…" />;

  return (
    <div>
      <PageHeader
        title="Supply Chain Management"
        description="Demand · S&OP · MRP · DRP · control tower · risk · sustainability · AI planning"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm/mrp">MRP</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/scm/tower">Control tower</Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            End-to-end supply chain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {step}
                </Badge>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Forecast lines" value={formatNumber(stats.forecastLines)} icon={TrendingUp} />
        <StatCard title="Open MRP actions" value={formatNumber(stats.openMrp)} icon={Cog} />
        <StatCard title="Open risks" value={formatNumber(stats.openRisks)} icon={AlertTriangle} />
        <StatCard title="Open POs" value={formatNumber(stats.openPo)} />
        <StatCard title="Inbound transit" value={formatNumber(stats.inTransit)} />
        <StatCard
          title="Inventory value"
          value={formatNumber(Math.round(stats.inventoryValue))}
          icon={Warehouse}
        />
        <StatCard title="OTD %" value={`${stats.otd}%`} />
        <StatCard title="Fill rate %" value={`${stats.fillRate}%`} icon={Network} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition-colors hover:border-hope-teal/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="rounded-lg bg-hope-navy/10 p-2">
                  <m.icon className="h-5 w-5 text-hope-teal" />
                </div>
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-hope-gold" />
            <CardTitle>AI supply chain intelligence</CardTitle>
          </div>
          <Badge variant="outline">Demand · shortage · network</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open SCM insights.</p>
          ) : (
            insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={ins.severity} />
                  <Badge variant="secondary" className="capitalize">
                    {ins.insight_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-medium">{ins.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{ins.recommendation}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
