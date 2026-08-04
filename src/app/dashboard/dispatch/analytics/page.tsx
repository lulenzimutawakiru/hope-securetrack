"use client";

import { useEffect, useState } from "react";
import { BarChart3, Truck, PackageCheck, Clock, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";

export default function DispatchAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    failed: 0,
    inTransit: 0,
    vehicles: 0,
    available: 0,
    pods: 0,
    exceptions: 0,
    avgWeight: 0,
  });

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: total },
        { count: delivered },
        { count: failed },
        { count: inTransit },
        { count: vehicles },
        { count: available },
        { count: pods },
        { count: exceptions },
        { data: weights },
      ] = await Promise.all([
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "delivered"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "failed"),
        sb.from("dsp_requests").select("*", { count: "exact", head: true }).eq("status", "in_transit"),
        sb.from("fleet_vehicles").select("*", { count: "exact", head: true }),
        sb.from("fleet_vehicles").select("*", { count: "exact", head: true }).eq("status", "available"),
        sb.from("dsp_pods").select("*", { count: "exact", head: true }),
        sb.from("dsp_exceptions").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("dsp_requests").select("weight_kg").is("deleted_at", null).limit(200),
      ]);
      const w = weights || [];
      const avgWeight = w.length
        ? Math.round(w.reduce((s, x) => s + Number(x.weight_kg || 0), 0) / w.length)
        : 0;
      setStats({
        total: total ?? 0,
        delivered: delivered ?? 0,
        failed: failed ?? 0,
        inTransit: inTransit ?? 0,
        vehicles: vehicles ?? 0,
        available: available ?? 0,
        pods: pods ?? 0,
        exceptions: exceptions ?? 0,
        avgWeight,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading dispatch analytics…" />;

  const successRate =
    stats.total > 0
      ? Math.round((stats.delivered / Math.max(1, stats.delivered + stats.failed)) * 100)
      : 100;
  const utilization =
    stats.vehicles > 0
      ? Math.round(((stats.vehicles - stats.available) / stats.vehicles) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Dispatch Analytics"
        description="OTD · success rate · utilization · exceptions · POD volume"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Requests" value={String(stats.total)} icon={BarChart3} />
        <StatCard title="Delivered" value={String(stats.delivered)} icon={PackageCheck} />
        <StatCard title="Success rate" value={`${successRate}%`} icon={Clock} />
        <StatCard title="Vehicle util." value={`${utilization}%`} icon={Truck} />
        <StatCard title="In transit" value={String(stats.inTransit)} icon={Truck} />
        <StatCard title="PODs" value={String(stats.pods)} icon={PackageCheck} />
        <StatCard title="Open exceptions" value={String(stats.exceptions)} icon={AlertTriangle} />
        <StatCard title="Avg weight kg" value={String(stats.avgWeight)} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery funnel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Total requests", v: stats.total },
              { label: "Delivered", v: stats.delivered },
              { label: "In transit", v: stats.inTransit },
              { label: "Failed", v: stats.failed },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{row.label}</span>
                  <span className="font-medium">{row.v}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70"
                    style={{ width: `${Math.min(100, (row.v / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Fleet snapshot</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between"><span>Total vehicles</span><span>{stats.vehicles}</span></div>
            <div className="flex justify-between"><span>Available</span><span>{stats.available}</span></div>
            <div className="flex justify-between"><span>On duty / other</span><span>{stats.vehicles - stats.available}</span></div>
            <p className="text-xs text-muted-foreground pt-2">
              Cost-per-delivery and fuel efficiency improve with route optimization score ≥ 80.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
