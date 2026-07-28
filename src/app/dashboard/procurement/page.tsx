"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  FileText,
  FileQuestion,
  ClipboardList,
  Ship,
  Truck,
  Users,
  Brain,
  ArrowRight,
  Award,
  PackageCheck,
  FileBarChart,
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
  "Requisition",
  "Budget",
  "Approval",
  "RFQ",
  "PO",
  "Inbound",
  "GRN",
  "Inventory",
  "Dispatch",
  "Delivery",
];

const MODULES = [
  { title: "Suppliers", href: "/dashboard/procurement/suppliers", icon: Users, desc: "Vendor master & risk" },
  { title: "Requisitions", href: "/dashboard/procurement/requisitions", icon: ClipboardList, desc: "Material & CAPEX requests" },
  { title: "RFQ / Tenders", href: "/dashboard/procurement/rfq", icon: FileQuestion, desc: "Sourcing & bid comparison" },
  { title: "Purchase Orders", href: "/dashboard/procurement/orders", icon: FileText, desc: "PO lifecycle & acknowledgements" },
  { title: "Contracts", href: "/dashboard/procurement/contracts", icon: Award, desc: "Framework & blanket agreements" },
  { title: "Inbound Logistics", href: "/dashboard/procurement/inbound", icon: Ship, desc: "Shipments & goods in transit" },
  { title: "Fleet", href: "/dashboard/procurement/fleet", icon: Truck, desc: "Vehicles, fuel, maintenance" },
  { title: "Performance", href: "/dashboard/procurement/performance", icon: ShoppingBag, desc: "Supplier scorecards" },
  { title: "Goods Receipt", href: "/dashboard/inventory/grn", icon: PackageCheck, desc: "GRN & QC (inventory)" },
  { title: "Dispatch", href: "/dashboard/dispatch", icon: Truck, desc: "Outbound delivery orders" },
  { title: "Reports", href: "/dashboard/procurement/reports", icon: FileBarChart, desc: "Spend & logistics reports" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

export default function ProcurementHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    suppliers: 0,
    openPr: 0,
    openPo: 0,
    poSpend: 0,
    inTransit: 0,
    fleetAvailable: 0,
    openRfq: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        sup,
        pr,
        po,
        poAmt,
        ship,
        fleet,
        rfq,
        { data: ins },
      ] = await Promise.all([
        supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("purchase_requisitions")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "submitted", "approved"]),
        supabase
          .from("purchase_orders")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("closed","cancelled")'),
        supabase
          .from("purchase_orders")
          .select("total_amount")
          .not("status", "in", '("cancelled")'),
        supabase
          .from("inbound_shipments")
          .select("*", { count: "exact", head: true })
          .in("status", ["booked", "in_transit", "customs", "delayed"]),
        supabase
          .from("fleet_vehicles")
          .select("*", { count: "exact", head: true })
          .eq("status", "available"),
        supabase
          .from("rfqs")
          .select("*", { count: "exact", head: true })
          .in("status", ["draft", "published"]),
        supabase
          .from("procurement_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const poSpend = (poAmt.data ?? []).reduce(
        (s, r) => s + Number(r.total_amount || 0),
        0
      );

      setStats({
        suppliers: sup.count ?? 0,
        openPr: pr.count ?? 0,
        openPo: po.count ?? 0,
        poSpend,
        inTransit: ship.count ?? 0,
        fleetAvailable: fleet.count ?? 0,
        openRfq: rfq.count ?? 0,
      });
      setInsights((ins as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading procurement & logistics…" />;

  return (
    <div>
      <PageHeader
        title="Procurement & Logistics"
        description="Source-to-pay · inbound logistics · fleet · supplier performance · AI supply chain insights"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement/orders">New PO</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/procurement/rfq">RFQs</Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Source-to-delivery flow
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 mb-6">
        <StatCard title="Suppliers" value={formatNumber(stats.suppliers)} icon={Users} />
        <StatCard title="Open PRs" value={formatNumber(stats.openPr)} />
        <StatCard title="Open RFQs" value={formatNumber(stats.openRfq)} />
        <StatCard title="Open POs" value={formatNumber(stats.openPo)} icon={FileText} />
        <StatCard
          title="PO spend (UGX)"
          value={formatNumber(Math.round(stats.poSpend))}
        />
        <StatCard title="In transit" value={formatNumber(stats.inTransit)} icon={Ship} />
        <StatCard title="Fleet available" value={formatNumber(stats.fleetAvailable)} icon={Truck} />
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
            <CardTitle>AI procurement & logistics intelligence</CardTitle>
          </div>
          <Badge variant="outline">Risk · freight · contracts</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open insights.</p>
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
