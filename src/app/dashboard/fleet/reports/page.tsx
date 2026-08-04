"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv, toCsv } from "@/lib/fleet";
import { toast } from "sonner";

const REPORTS = [
  { id: "vehicles", title: "Vehicle Register", table: "fleet_vehicles", cols: ["registration", "vehicle_code", "make", "model", "status", "current_odometer", "assigned_driver_name"] },
  { id: "drivers", title: "Driver Performance", table: "fleet_drivers", cols: ["driver_code", "full_name", "status", "performance_score", "safety_score", "license_expiry"] },
  { id: "fuel", title: "Fuel Consumption", table: "fleet_fuel_transactions", cols: ["txn_number", "registration", "litres", "total_cost", "txn_date", "station_name"] },
  { id: "maint", title: "Maintenance Cost", table: "fleet_work_orders", cols: ["work_order_number", "registration", "work_type", "status", "total_cost", "scheduled_date"] },
  { id: "trips", title: "Trip Reports", table: "fleet_trips", cols: ["trip_number", "purpose", "registration", "driver_name", "status", "planned_distance_km", "actual_distance_km"] },
  { id: "insurance", title: "Insurance Expiry", table: "fleet_insurance_policies", cols: ["policy_number", "registration", "insurer_name", "expiry_date", "status", "premium"] },
  { id: "accidents", title: "Accident Reports", table: "fleet_accidents", cols: ["accident_number", "registration", "driver_name", "severity", "status", "estimated_damage"] },
  { id: "costs", title: "Cost Analysis", table: "fleet_costs", cols: ["cost_number", "registration", "cost_type", "amount", "cost_date", "status"] },
] as const;

export default function FleetReportsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const sb = createClient();
      const next: Record<string, number> = {};
      await Promise.all(
        REPORTS.map(async (r) => {
          const { count } = await sb
            .from(r.table)
            .select("*", { count: "exact", head: true })
            .eq("company_id", companyId);
          next[r.id] = count ?? 0;
        })
      );
      setCounts(next);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  const exportReport = async (r: (typeof REPORTS)[number]) => {
    if (!companyId) return;
    try {
      let q = createClient()
        .from(r.table)
        .select("*")
        .eq("company_id", companyId)
        .limit(2000);
      // soft-delete filter when column exists
      try {
        q = q.is("deleted_at", null);
      } catch {
        /* ignore */
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Array<Record<string, unknown>>;
      downloadCsv(
        `fleet-${r.id}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows, [...r.cols])
      );
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading) return <LoadingState message="Loading fleet reports…" />;

  return (
    <div>
      <PageHeader
        title="Fleet Reports"
        description="Utilization · fuel · maintenance · trips · compliance · export CSV"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{counts[r.id] ?? 0} records</span>
              <Button size="sm" variant="outline" onClick={() => exportReport(r)}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
