"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getFleetDashboardStats } from "@/lib/fleet";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import { BarChart3, Fuel, Truck, Wrench } from "lucide-react";

export default function FleetAnalyticsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getFleetDashboardStats>> | null>(null);
  const [fuelByDay, setFuelByDay] = useState<Array<{ day: string; cost: number; litres: number }>>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const sb = createClient();
      const [s, { data: fuel }, { data: vehicles }] = await Promise.all([
        getFleetDashboardStats(companyId),
        sb
          .from("fleet_fuel_transactions")
          .select("txn_date,total_cost,litres")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .order("txn_date", { ascending: false })
          .limit(200),
        sb
          .from("fleet_vehicles")
          .select("status")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .limit(500),
      ]);
      setStats(s);

      const dayMap = new Map<string, { cost: number; litres: number }>();
      for (const row of fuel || []) {
        const day = String(row.txn_date || "").slice(0, 10);
        if (!day) continue;
        const cur = dayMap.get(day) || { cost: 0, litres: 0 };
        cur.cost += Number(row.total_cost || 0);
        cur.litres += Number(row.litres || 0);
        dayMap.set(day, cur);
      }
      setFuelByDay(
        Array.from(dayMap.entries())
          .map(([day, v]) => ({ day, ...v }))
          .sort((a, b) => a.day.localeCompare(b.day))
          .slice(-14)
      );

      const br: Record<string, number> = {};
      for (const v of vehicles || []) {
        const st = String(v.status || "unknown");
        br[st] = (br[st] || 0) + 1;
      }
      setStatusBreakdown(br);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <LoadingState message="Loading fleet analytics…" />;

  const maxFuel = Math.max(1, ...fuelByDay.map((d) => d.cost));

  return (
    <div>
      <PageHeader
        title="Fleet Analytics"
        description="Fuel trends · utilization · cost analysis · operational KPIs"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Utilization" value={`${stats?.utilization ?? 0}%`} icon={Truck} />
        <StatCard title="Fleet Health" value={`${stats?.fleetHealth ?? 0}%`} icon={BarChart3} />
        <StatCard title="Fuel (month)" value={formatNumber(stats?.fuelCostMonth ?? 0)} icon={Fuel} />
        <StatCard title="Maint. (month)" value={formatNumber(stats?.maintenanceCost ?? 0)} icon={Wrench} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fuel cost (last 14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {fuelByDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fuel transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {fuelByDay.map((d) => (
                  <div key={d.day} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-muted-foreground shrink-0">{d.day.slice(5)}</span>
                    <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded"
                        style={{ width: `${(d.cost / maxFuel) * 100}%` }}
                      />
                    </div>
                    <span className="w-28 text-right tabular-nums">{formatNumber(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vehicle status mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(statusBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground">No vehicles registered.</p>
            )}
            {Object.entries(statusBreakdown).map(([st, n]) => (
              <div key={st} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <span className="capitalize">{st.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
