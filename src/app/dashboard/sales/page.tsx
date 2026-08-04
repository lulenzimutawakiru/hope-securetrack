"use client";

import { useEffect, useMemo, useState } from "react";
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
  TrendingUp,
  Handshake,
  MapPin,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { SALES_MENU, getSalesDashboardStats } from "@/lib/sales";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/crud-compat";

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

const QUICK = [
  { title: "Pipeline", href: "/dashboard/sales/pipeline", icon: Target, desc: "Leads & opportunities" },
  { title: "Quotations", href: "/dashboard/sales/quotations", icon: FileSignature, desc: "Quotes & convert" },
  { title: "Orders", href: "/dashboard/sales/orders", icon: ShoppingCart, desc: "Order-to-cash" },
  { title: "Credit", href: "/dashboard/sales/credit", icon: CreditCard, desc: "Limits & holds" },
  { title: "Returns", href: "/dashboard/sales/returns", icon: RotateCcw, desc: "RMA & credit notes" },
  { title: "Commissions", href: "/dashboard/sales/commissions", icon: Trophy, desc: "Rep incentives" },
  { title: "Contracts", href: "/dashboard/sales/contracts", icon: Handshake, desc: "Framework deals" },
  { title: "Forecasts", href: "/dashboard/sales/forecasts", icon: TrendingUp, desc: "Commit & targets" },
  { title: "Price Lists", href: "/dashboard/sales/price-lists", icon: Receipt, desc: "Pricing books" },
  { title: "Field Visits", href: "/dashboard/sales/visit-plans", icon: MapPin, desc: "Visit plans" },
  { title: "Invoices", href: "/dashboard/invoices", icon: Receipt, desc: "Tax invoices" },
  { title: "Dispatch", href: "/dashboard/dispatch", icon: Truck, desc: "Delivery" },
];

export default function SalesCommandCenterPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getSalesDashboardStats>> | null>(null);
  const [recentOrders, setRecentOrders] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      try {
        const sb = createClient();
        const [s, { data: orders }, { data: ai }] = await Promise.all([
          getSalesDashboardStats(companyId),
          sb
            .from("sales_orders")
            .select("id,order_number,status,total_amount,currency,order_date")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(8),
          sb
            .from("sales_ai_insights")
            .select("title,severity,summary,score")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        setStats(s);
        setRecentOrders((orders as Array<Record<string, unknown>>) || []);
        setInsights((ai as Array<Record<string, unknown>>) || []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SALES_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof SALES_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Advanced Sales Platform…" />;

  return (
    <div>
      <PageHeader
        title="Advanced Sales"
        description="Quote-to-cash · Pipeline · Pricing · Contracts · Forecast · Commissions · Field · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/sales/live">
                <Activity className="h-4 w-4 mr-1" /> Live Pipeline
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/sales/ai">
                <Brain className="h-4 w-4 mr-1" /> AI Assistant
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/sales/orders">
                <ShoppingCart className="h-4 w-4 mr-1" /> Orders
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
        <StatCard title="Customers" value={String(stats?.customers ?? 0)} icon={Users} />
        <StatCard title="Open Leads" value={String(stats?.openLeads ?? 0)} icon={Target} />
        <StatCard title="Open Opps" value={String(stats?.openOpps ?? 0)} icon={TrendingUp} />
        <StatCard title="Pipeline" value={formatNumber(stats?.pipelineValue ?? 0)} icon={Target} />
        <StatCard title="Weighted" value={formatNumber(stats?.weightedPipeline ?? 0)} icon={TrendingUp} />
        <StatCard title="Open Quotes" value={String(stats?.openQuotes ?? 0)} icon={FileSignature} />
        <StatCard title="Quote Value" value={formatNumber(stats?.quoteValue ?? 0)} icon={FileSignature} />
        <StatCard title="Open Orders" value={String(stats?.openOrders ?? 0)} icon={ShoppingCart} />
        <StatCard title="Order Value" value={formatNumber(stats?.orderValue ?? 0)} icon={ShoppingCart} />
        <StatCard title="Credit Holds" value={String(stats?.creditHolds ?? 0)} icon={CreditCard} />
        <StatCard title="Open Returns" value={String(stats?.returnsOpen ?? 0)} icon={RotateCcw} />
        <StatCard title="Commissions Due" value={formatNumber(stats?.commissionsDue ?? 0)} icon={Trophy} />
        <StatCard title="Active Contracts" value={String(stats?.contractsActive ?? 0)} icon={Handshake} />
        <StatCard title="Forecast (mo)" value={formatNumber(stats?.forecastMonth ?? 0)} icon={TrendingUp} />
        <StatCard title="Target Ach %" value={`${stats?.targetAchievement ?? 0}%`} icon={Trophy} />
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quote-to-Cash Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {LIFECYCLE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Badge variant={i < 4 ? "default" : "outline"}>{step}</Badge>
                {i < LIFECYCLE.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {QUICK.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:border-primary/50 transition-colors">
              <CardContent className="pt-4 flex gap-3 items-start">
                <m.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              recentOrders.map((o) => (
                <div key={String(o.id)} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{String(o.order_number)}</div>
                    <div className="text-xs text-muted-foreground">{String(o.order_date ?? "")}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{String(o.status)}</Badge>
                    <div className="text-xs mt-1">
                      {formatNumber(Number(o.total_amount || 0))} {String(o.currency || "UGX")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI Insights</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/sales/ai">Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stored insights. Open the AI assistant to generate them.
              </p>
            ) : (
              insights.map((ins, i) => (
                <div key={i} className="border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{String(ins.severity)}</Badge>
                    <span className="text-sm font-medium">{String(ins.title)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{String(ins.summary || "")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          className="max-w-sm"
          placeholder="Filter sales modules…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href + m.title}
                  href={m.href}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
