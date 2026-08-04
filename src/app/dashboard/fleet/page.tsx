"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck, Users, Fuel, Wrench, MapPin, Activity, AlertTriangle,
  Gauge, ArrowRight, Navigation, ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { FLEET_MENU, getFleetDashboardStats } from "@/lib/fleet";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/crud-compat";

export default function FleetDashboardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getFleetDashboardStats>> | null>(null);
  const [recentTrips, setRecentTrips] = useState<Array<Record<string, unknown>>>([]);
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
        const [s, { data: trips }, { data: ai }] = await Promise.all([
          getFleetDashboardStats(companyId),
          sb
            .from("fleet_trips")
            .select("id,trip_number,purpose,registration,driver_name,status,planned_distance_km")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(8),
          sb
            .from("fleet_ai_insights")
            .select("title,severity,summary,score")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        setStats(s);
        setRecentTrips((trips as Array<Record<string, unknown>>) || []);
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
    return FLEET_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof FLEET_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Fleet & Transport Platform…" />;

  return (
    <div>
      <PageHeader
        title="Fleet & Transport"
        description="Enterprise FMS · TMS · GPS · Fuel · Maintenance · Drivers · POD · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/fleet/map"><MapPin className="h-4 w-4 mr-1" /> Live Map</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/fleet/ai"><Activity className="h-4 w-4 mr-1" /> AI Assistant</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/fleet/vehicles"><Truck className="h-4 w-4 mr-1" /> Vehicles</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
        <StatCard title="Total Vehicles" value={String(stats?.totalVehicles ?? 0)} icon={Truck} />
        <StatCard title="Available" value={String(stats?.available ?? 0)} icon={Navigation} />
        <StatCard title="In Maintenance" value={String(stats?.inMaintenance ?? 0)} icon={Wrench} />
        <StatCard title="Active Trips" value={String(stats?.activeTrips ?? 0)} icon={MapPin} />
        <StatCard title="Drivers Available" value={String(stats?.driversAvailable ?? 0)} icon={Users} />
        <StatCard title="Fuel Today" value={formatNumber(stats?.fuelCostToday ?? 0)} icon={Fuel} />
        <StatCard title="Fuel This Month" value={formatNumber(stats?.fuelCostMonth ?? 0)} icon={Fuel} />
        <StatCard title="Fleet Health" value={`${stats?.fleetHealth ?? 0}%`} icon={ShieldCheck} />
        <StatCard title="Utilization" value={`${stats?.utilization ?? 0}%`} icon={Gauge} />
        <StatCard title="GPS Online" value={String(stats?.gpsOnline ?? 0)} icon={Activity} />
        <StatCard title="Delayed Trips" value={String(stats?.delayedTrips ?? 0)} icon={AlertTriangle} />
        <StatCard title="Assigned" value={String(stats?.assigned ?? 0)} icon={Users} />
        <StatCard title="Maint. Cost (mo)" value={formatNumber(stats?.maintenanceCost ?? 0)} icon={Wrench} />
        <StatCard title="Cost / Km" value={formatNumber(stats?.costPerKm ?? 0)} icon={Gauge} />
        <StatCard title="Total Cost (mo)" value={formatNumber(stats?.totalCostMonth ?? 0)} icon={Fuel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent trips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTrips.length === 0 && (
              <p className="text-sm text-muted-foreground">No trips yet. Create a trip request to start.</p>
            )}
            {recentTrips.map((t) => (
              <div key={String(t.id)} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{String(t.trip_number)} · {String(t.purpose || "—")}</div>
                  <div className="text-muted-foreground text-xs">
                    {String(t.registration || "—")} · {String(t.driver_name || "Unassigned")} · {String(t.planned_distance_km || 0)} km
                  </div>
                </div>
                <Badge variant="outline">{String(t.status)}</Badge>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/fleet/trips">View all trips <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">Run AI Fleet Assistant to generate insights.</p>
            )}
            {insights.map((ins, i) => (
              <div key={i} className="border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={String(ins.severity) === "critical" ? "destructive" : "outline"}>
                    {String(ins.severity)}
                  </Badge>
                  <span className="font-medium">{String(ins.title)}</span>
                </div>
                <p className="text-muted-foreground text-xs">{String(ins.summary)}</p>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/fleet/ai">Open AI assistant <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <Input
          placeholder="Search fleet modules…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
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
