"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ScmKpisPage() {
  const [snap, setSnap] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("scm_kpi_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(12);
      setHistory(data ?? []);
      setSnap(data?.[0] ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Supply Chain KPIs"
        description="Procurement · inventory · manufacturing · logistics · customer service scorecards"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/scm">Hub</Link>
          </Button>
        }
      />

      {!snap ? (
        <p className="text-sm text-muted-foreground">No KPI snapshots yet</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Inventory</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Turnover"
                  value={String(snap.inventory_turnover ?? "—")}
                  icon={BarChart3}
                />
                <StatCard title="DOH" value={String(snap.days_of_inventory ?? "—")} />
                <StatCard title="Stockout %" value={`${snap.stockout_rate_pct ?? 0}%`} />
                <StatCard
                  title="Value"
                  value={formatNumber(Math.round(Number(snap.inventory_value || 0)))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Service & logistics</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatCard title="Fill rate" value={`${snap.fill_rate_pct ?? 0}%`} />
                <StatCard title="OTD" value={`${snap.on_time_delivery_pct ?? 0}%`} />
                <StatCard title="Perfect order" value={`${snap.perfect_order_pct ?? 0}%`} />
                <StatCard
                  title="Transport $"
                  value={formatNumber(Math.round(Number(snap.transport_cost || 0)))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Planning</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatCard
                  title="Forecast accuracy"
                  value={`${snap.forecast_accuracy_pct ?? 0}%`}
                />
                <StatCard
                  title="Proc. cycle days"
                  value={String(snap.procurement_cycle_days ?? "—")}
                />
              </CardContent>
            </Card>
          </div>

          <h3 className="font-medium mb-2">Snapshot history</h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Turnover</TableHead>
                  <TableHead className="text-right">OTD %</TableHead>
                  <TableHead className="text-right">Fill %</TableHead>
                  <TableHead className="text-right">Forecast acc.</TableHead>
                  <TableHead className="text-right">Inventory value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={String(h.id)}>
                    <TableCell>
                      {h.snapshot_date ? formatDate(String(h.snapshot_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {String(h.inventory_turnover ?? "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {String(h.on_time_delivery_pct ?? "—")}%
                    </TableCell>
                    <TableCell className="text-right">
                      {String(h.fill_rate_pct ?? "—")}%
                    </TableCell>
                    <TableCell className="text-right">
                      {String(h.forecast_accuracy_pct ?? "—")}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Math.round(Number(h.inventory_value || 0)))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
