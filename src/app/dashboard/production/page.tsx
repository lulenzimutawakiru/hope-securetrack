"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Factory, ClipboardList, Gauge, ShieldCheck, ArrowRight, Activity,
  Boxes, Calendar, Wand2, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import { MES_MENU } from "@/lib/mes";

export default function ProductionMesHubPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({
    orders: 0, inProgress: 0, delayed: 0, machines: 0, running: 0,
    oee: 0, openNcr: 0, workCenters: 0, mrpOpen: 0, waste: 0, plans: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [
        orders, inProgress, delayed, machines, running, workCenters, openNcr, mrpOpen, plans,
        { data: oeeRows }, { data: recentOrders }, { data: wasteRows },
      ] = await Promise.all([
        supabase.from("mes_production_orders").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("mes_production_orders").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("mes_production_orders").select("*", { count: "exact", head: true }).lt("planned_finish", today).not("status", "in", '("completed","closed","cancelled")'),
        supabase.from("production_machines").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("production_machines").select("*", { count: "exact", head: true }).eq("status", "running"),
        supabase.from("mes_work_centers").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("mes_ncr").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("mes_mrp_suggestions").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("mes_production_plans").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("mes_oee_snapshots").select("oee_pct").order("snapshot_date", { ascending: false }).limit(20),
        supabase
          .from("mes_production_orders")
          .select("id,order_number,product_name,quantity_planned,quantity_completed,status,batch_number")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("mes_waste_records").select("quantity").is("deleted_at", null).limit(100),
      ]);

      const oeeList = oeeRows || [];
      const avgOee =
        oeeList.length > 0
          ? oeeList.reduce((s, r) => s + Number(r.oee_pct || 0), 0) / oeeList.length
          : 0;
      const wasteQty = (wasteRows || []).reduce((s, r) => s + Number(r.quantity || 0), 0);

      setStats({
        orders: orders.count ?? 0,
        inProgress: inProgress.count ?? 0,
        delayed: delayed.count ?? 0,
        machines: machines.count ?? 0,
        running: running.count ?? 0,
        oee: Math.round(avgOee * 10) / 10,
        openNcr: openNcr.count ?? 0,
        workCenters: workCenters.count ?? 0,
        mrpOpen: mrpOpen.count ?? 0,
        waste: wasteQty,
        plans: plans.count ?? 0,
      });
      setRecent((recentOrders as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return MES_MENU.filter((m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s));
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof MES_MENU[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Manufacturing Execution System…" />;

  return (
    <div>
      <PageHeader
        title="Production · MES Platform"
        description="Planning · MPS · MRP · Orders · Shop floor · Quality · OEE · Packaging · Costing · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/production/shop-floor"><Factory className="h-4 w-4 mr-1" /> Shop Floor</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/production/orders"><ClipboardList className="h-4 w-4 mr-1" /> New Order</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Active orders" value={String(stats.inProgress)} icon={Activity} />
        <StatCard title="All orders" value={String(stats.orders)} icon={ClipboardList} />
        <StatCard title="Delayed" value={String(stats.delayed)} icon={AlertTriangle} />
        <StatCard title="Avg OEE %" value={String(stats.oee || "—")} icon={Gauge} />
        <StatCard title="Machines running" value={`${stats.running}/${stats.machines}`} icon={Factory} />
        <StatCard title="Open NCR" value={String(stats.openNcr)} icon={ShieldCheck} />
        <StatCard title="MRP open" value={String(stats.mrpOpen)} icon={Boxes} />
        <StatCard title="Plans" value={String(stats.plans)} icon={Calendar} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent production orders</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet. Create one to start.</p>
            ) : recent.map((r) => (
              <Link
                key={r.id as string}
                href="/dashboard/production/orders"
                className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <div>
                  <p className="font-medium font-mono text-xs">{String(r.order_number)}</p>
                  <p className="text-muted-foreground text-xs">{String(r.product_name || "—")} · batch {String(r.batch_number || "—")}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{String(r.status)}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatNumber(Number(r.quantity_completed || 0))}/{formatNumber(Number(r.quantity_planned || 0))}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quick launch</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["/dashboard/production/planning", "Planning / MPS"],
              ["/dashboard/production/mrp", "Run MRP"],
              ["/dashboard/production/quality", "Quality & NCR"],
              ["/dashboard/production/oee", "OEE dashboard"],
              ["/dashboard/production/packaging", "Packaging"],
              ["/dashboard/production/ai", "AI assistant"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded border px-2 py-1.5 hover:bg-muted/40">
                {label}<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <Input placeholder="Search production modules…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      </div>

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link key={m.href} href={m.href}>
                  <Card className="h-full hover:border-hope-navy/40 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
