"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { getCrmDashboardStats, listOpportunities, forecastPipeline } from "@/lib/crm";
import { formatNumber } from "@/lib/utils";

export default function CrmAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    openLeads: 0,
    openOpps: 0,
    pipelineValue: 0,
    weightedForecast: 0,
    activeContracts: 0,
    openTickets: 0,
  });
  const [byClass, setByClass] = useState<Array<{ k: string; n: number }>>([]);
  const [byStatus, setByStatus] = useState<Array<{ k: string; n: number }>>([]);
  const [targets, setTargets] = useState<Array<Record<string, unknown>>>([]);
  const [forecast, setForecast] = useState({ commit: 0, bestCase: 0, winRateHint: "" });
  const [avgHealth, setAvgHealth] = useState(0);
  const [avgClv, setAvgClv] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const s = await getCrmDashboardStats();
        setStats({
          customers: s.customers,
          openLeads: s.openLeads,
          openOpps: s.openOpps,
          pipelineValue: s.pipelineValue,
          weightedForecast: s.weightedForecast,
          activeContracts: s.activeContracts,
          openTickets: s.openTickets,
        });

        const opps = await listOpportunities();
        const f = forecastPipeline(
          opps.map((o) => ({
            expected_value: Number(o.expected_value),
            probability: Number(o.probability),
            stage: String(o.stage),
          }))
        );
        setForecast({ commit: f.commit, bestCase: f.bestCase, winRateHint: f.winRateHint });

        const supabase = createClient();
        const { data: cust } = await supabase
          .from("customers")
          .select("customer_class, customer_status, health_score, clv_estimate")
          .is("deleted_at", null)
          .limit(500);

        const classMap = new Map<string, number>();
        const statusMap = new Map<string, number>();
        let healthSum = 0;
        let clvSum = 0;
        for (const c of cust || []) {
          const cl = String(c.customer_class || "corporate");
          const st = String(c.customer_status || "active");
          classMap.set(cl, (classMap.get(cl) || 0) + 1);
          statusMap.set(st, (statusMap.get(st) || 0) + 1);
          healthSum += Number(c.health_score || 70);
          clvSum += Number(c.clv_estimate || 0);
        }
        setByClass(Array.from(classMap.entries()).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n));
        setByStatus(Array.from(statusMap.entries()).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n));
        setAvgHealth(cust?.length ? Math.round(healthSum / cust.length) : 0);
        setAvgClv(cust?.length ? Math.round(clvSum / cust.length) : 0);

        const { data: t } = await supabase.from("crm_sales_targets").select("*").limit(20);
        setTargets(t || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading CRM analytics…" />;

  return (
    <div>
      <PageHeader
        title="CRM Analytics & Forecasting"
        description="CLV · churn · win rate · funnel · receivables · team targets"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/reports">BI reports</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total customers" value={formatNumber(stats.customers)} />
        <StatCard title="Open leads" value={formatNumber(stats.openLeads)} />
        <StatCard title="Avg health score" value={String(avgHealth)} />
        <StatCard title="Avg CLV" value={formatNumber(avgClv)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Pipeline value" value={formatNumber(Math.round(stats.pipelineValue))} />
        <StatCard title="Weighted forecast" value={formatNumber(Math.round(stats.weightedForecast))} />
        <StatCard title="Commit" value={formatNumber(Math.round(forecast.commit))} />
        <StatCard title="Best case" value={formatNumber(Math.round(forecast.bestCase))} />
      </div>
      <p className="text-xs text-muted-foreground mb-6">{forecast.winRateHint}</p>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">By customer class</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byClass.map((x) => (
              <div key={x.k} className="flex justify-between text-sm">
                <span className="capitalize">{x.k}</span>
                <span className="font-medium">{x.n}</span>
              </div>
            ))}
            {byClass.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byStatus.map((x) => (
              <div key={x.k} className="flex justify-between text-sm">
                <span className="capitalize">{x.k}</span>
                <span className="font-medium">{x.n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Branch sales targets</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {targets.map((t) => {
              const tgt = Number(t.target_amount || 0);
              const act = Number(t.actual_amount || 0);
              const pct = tgt > 0 ? Math.round((act / tgt) * 100) : 0;
              return (
                <div key={String(t.id)} className="text-sm">
                  <div className="flex justify-between">
                    <span>{String(t.branch_name || "Branch")}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatNumber(act)} / {formatNumber(tgt)}
                  </p>
                </div>
              );
            })}
            {targets.length === 0 && <p className="text-sm text-muted-foreground">No targets configured</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Executive KPIs</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Active contracts</p>
            <p className="text-xl font-semibold">{stats.activeContracts}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Open support tickets</p>
            <p className="text-xl font-semibold">{stats.openTickets}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Open opportunities</p>
            <p className="text-xl font-semibold">{stats.openOpps}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Pipeline coverage</p>
            <p className="text-xl font-semibold">
              {stats.weightedForecast > 0 ? `${(stats.pipelineValue / Math.max(1, stats.weightedForecast)).toFixed(1)}x` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
