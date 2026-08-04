"use client";

import { useEffect, useState } from "react";
import { BarChart3, Tags, UserCheck, AlertTriangle, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { crudList } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";
import { ASSET_DOMAINS } from "@/lib/assets";

export default function AssetAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    missing: 0,
    maintenance: 0,
    purchase: 0,
    current: 0,
    byDomain: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byDept: [] as Array<{ name: string; count: number; value: number }>,
  });

  useEffect(() => {
    async function load() {
      const res = await crudList<Record<string, unknown>>("ast_assets", {
        page: 1,
        pageSize: 100,
      });
      const list = res.ok ? res.data.data : [];
      const byDomain: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const deptMap: Record<string, { count: number; value: number }> = {};
      let purchase = 0;
      let current = 0;
      let assigned = 0;
      let missing = 0;
      let maintenance = 0;

      for (const a of list) {
        const d = String(a.domain || "other");
        byDomain[d] = (byDomain[d] || 0) + 1;
        const st = String(a.status || "active");
        byStatus[st] = (byStatus[st] || 0) + 1;
        const dept = String(a.department || "Unassigned");
        if (!deptMap[dept]) deptMap[dept] = { count: 0, value: 0 };
        deptMap[dept].count += 1;
        deptMap[dept].value += Number(a.current_value || 0);
        purchase += Number(a.purchase_cost || 0);
        current += Number(a.current_value || 0);
        if (st === "assigned") assigned += 1;
        if (st === "missing") missing += 1;
        if (st === "maintenance") maintenance += 1;
      }

      setStats({
        total: list.length,
        assigned,
        missing,
        maintenance,
        purchase,
        current,
        byDomain,
        byStatus,
        byDept: Object.entries(deptMap)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 12),
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading asset analytics…" />;

  const depreciation = Math.max(0, stats.purchase - stats.current);

  return (
    <div>
      <PageHeader
        title="Asset Analytics"
        description="Executive · operations · finance · distribution · depreciation"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Total assets" value={String(stats.total)} icon={Tags} />
        <StatCard title="Assigned" value={String(stats.assigned)} icon={UserCheck} />
        <StatCard title="Missing" value={String(stats.missing)} icon={AlertTriangle} />
        <StatCard title="Maintenance" value={String(stats.maintenance)} icon={Wrench} />
        <StatCard title="Acquisition cost" value={formatNumber(stats.purchase)} icon={BarChart3} />
        <StatCard title="Current value" value={formatNumber(stats.current)} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">By domain</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ASSET_DOMAINS.map((d) => (
              <div key={d.value} className="flex justify-between text-sm">
                <span>{d.label}</span>
                <span className="font-medium">{stats.byDomain[d.value] || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(stats.byStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm capitalize">
                <span>{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            {Object.keys(stats.byStatus).length === 0 && (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Finance snapshot</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Acquisition</span><span>{formatNumber(stats.purchase)}</span></div>
            <div className="flex justify-between"><span>Book / current</span><span>{formatNumber(stats.current)}</span></div>
            <div className="flex justify-between"><span>Accum. depreciation (est.)</span><span>{formatNumber(depreciation)}</span></div>
            <p className="text-xs text-muted-foreground pt-2">
              Link to Finance → Fixed Assets for formal depreciation schedules.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By department</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.byDept.map((d) => (
              <div key={d.name} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate">{d.name}</span>
                <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70"
                    style={{ width: `${Math.min(100, (d.count / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right">{d.count}</span>
                <span className="w-28 text-right text-muted-foreground">{formatNumber(d.value)}</span>
              </div>
            ))}
            {stats.byDept.length === 0 && (
              <p className="text-sm text-muted-foreground">No department breakdown</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
