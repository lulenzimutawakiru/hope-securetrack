"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#0B1F3A", "#C9A227", "#0D7377", "#64748B", "#22c55e", "#ef4444"];

export default function DashboardCenterPage() {
  const [loading, setLoading] = useState(true);
  const [dashboards, setDashboards] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Array<Record<string, unknown>>>([]);
  const [kpis, setKpis] = useState<Array<Record<string, unknown>>>([]);
  const [live, setLive] = useState({
    batches: 0,
    invoices: 0,
    employees: 0,
    fraud: 0,
    statusData: [] as { name: string; value: number }[],
  });

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: dbs }, { data: kpiRows }, batches, invoices, employees, fraud] =
      await Promise.all([
        supabase
          .from("bi_dashboards")
          .select("*")
          .is("deleted_at", null)
          .order("sort_order"),
        supabase
          .from("bi_kpis")
          .select("*")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name")
          .limit(8),
        supabase.from("production_batches").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("*", { count: "exact", head: true }),
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("fraud_alerts")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
      ]);

    const list = dbs ?? [];
    setDashboards(list);
    setKpis(kpiRows ?? []);
    const first = selected ?? (list.find((d) => d.is_default)?.id as string) ?? (list[0]?.id as string);
    setSelected(first ?? null);

    if (first) {
      const { data: w } = await supabase
        .from("bi_dashboard_widgets")
        .select("*")
        .eq("dashboard_id", first)
        .eq("is_visible", true)
        .order("sort_order");
      setWidgets(w ?? []);
    }

    const statuses = ["draft", "in_progress", "qc_pending", "approved", "packed", "completed"];
    const statusCounts = await Promise.all(
      statuses.map(async (s) => {
        const { count } = await supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .eq("production_status", s);
        return { name: s.replace(/_/g, " "), value: count ?? 0 };
      })
    );

    setLive({
      batches: batches.count ?? 0,
      invoices: invoices.count ?? 0,
      employees: employees.count ?? 0,
      fraud: fraud.count ?? 0,
      statusData: statusCounts.filter((s) => s.value > 0),
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDashboard = async (id: string) => {
    setSelected(id);
    const supabase = createClient();
    const { data: w } = await supabase
      .from("bi_dashboard_widgets")
      .select("*")
      .eq("dashboard_id", id)
      .eq("is_visible", true)
      .order("sort_order");
    setWidgets(w ?? []);
  };

  const current = useMemo(
    () => dashboards.find((d) => String(d.id) === selected),
    [dashboards, selected]
  );

  const pieData = kpis.slice(0, 5).map((k) => ({
    name: String(k.name).slice(0, 12),
    value: Math.abs(Number(k.actual_value) || 1),
  }));

  if (loading) return <LoadingState message="Loading dashboard center…" />;

  return (
    <div>
      <PageHeader
        title="Dashboard Center"
        description="Role-based enterprise dashboards — CEO · Finance · Production · HR · Security · Board"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      {dashboards.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No dashboards"
          description="Run BI migration seeds"
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4 max-h-28 overflow-y-auto">
            {dashboards.map((d) => (
              <Button
                key={String(d.id)}
                size="sm"
                variant={selected === String(d.id) ? "default" : "outline"}
                onClick={() => selectDashboard(String(d.id))}
              >
                {String(d.name).replace(" Dashboard", "")}
              </Button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{String(current?.name ?? "Dashboard")}</h2>
            <Badge variant="outline" className="capitalize">
              {String(current?.audience ?? "")}
            </Badge>
            {current?.is_system ? <Badge variant="secondary">System</Badge> : null}
            <p className="text-xs text-muted-foreground w-full sm:w-auto">
              {String(current?.description ?? "")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Batches" value={formatNumber(live.batches)} icon={LayoutDashboard} />
            <StatCard title="Invoices" value={formatNumber(live.invoices)} icon={LayoutDashboard} />
            <StatCard title="Active staff" value={formatNumber(live.employees)} icon={LayoutDashboard} />
            <StatCard title="Open fraud" value={formatNumber(live.fraud)} icon={LayoutDashboard} />
          </div>

          {kpis.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {kpis.slice(0, 4).map((k) => {
                const actual = Number(k.actual_value);
                const target = Number(k.target_value);
                const onTarget =
                  k.higher_is_better === false ? actual <= target : actual >= target * 0.95;
                return (
                  <Card key={String(k.id)}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs text-muted-foreground font-medium">
                        {String(k.name)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-semibold">
                        {formatNumber(actual)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          {String(k.unit ?? "")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Target {formatNumber(target)} ·{" "}
                        <span className={onTarget ? "text-green-600" : "text-amber-600"}>
                          {String(k.trend)}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Production batch status</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {live.statusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No batch data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={live.statusData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0D7377" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">KPI weight sample</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KPIs</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {widgets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Widget layout ({widgets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {widgets.map((w) => (
                    <div
                      key={String(w.id)}
                      className="rounded border p-3 text-sm bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{String(w.title)}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {String(w.widget_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {String(w.data_source ?? "—")} ·{" "}
                        {JSON.stringify(w.position ?? {})}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
