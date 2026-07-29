"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getPpmDashboardStats } from "@/lib/ppm";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { BarChart3, DollarSign, FolderKanban, Gauge } from "lucide-react";

export default function PpmAnalyticsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPpmDashboardStats>> | null>(null);
  const [healthMix, setHealthMix] = useState<Record<string, number>>({});
  const [statusMix, setStatusMix] = useState<Record<string, number>>({});
  const [burn, setBurn] = useState<Array<{ label: string; planned: number; actual: number }>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const sb = createClient();
      const [s, { data: projects }, { data: budgets }] = await Promise.all([
        getPpmDashboardStats(companyId),
        sb
          .from("ppm_projects")
          .select("health,status,budget_planned,budget_actual,percent_complete")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .limit(200),
        sb
          .from("ppm_budgets")
          .select("category,planned_amount,actual_amount")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .limit(100),
      ]);
      setStats(s);

      const h: Record<string, number> = {};
      const st: Record<string, number> = {};
      for (const p of projects || []) {
        const hk = String(p.health || "unknown");
        const sk = String(p.status || "unknown");
        h[hk] = (h[hk] || 0) + 1;
        st[sk] = (st[sk] || 0) + 1;
      }
      setHealthMix(h);
      setStatusMix(st);

      const cat = new Map<string, { planned: number; actual: number }>();
      for (const b of budgets || []) {
        const c = String(b.category || "other");
        const cur = cat.get(c) || { planned: 0, actual: 0 };
        cur.planned += Number(b.planned_amount || 0);
        cur.actual += Number(b.actual_amount || 0);
        cat.set(c, cur);
      }
      setBurn(
        Array.from(cat.entries()).map(([label, v]) => ({
          label,
          planned: v.planned,
          actual: v.actual,
        }))
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <LoadingState message="Loading project analytics…" />;

  const maxBurn = Math.max(1, ...burn.flatMap((b) => [b.planned, b.actual]));

  return (
    <div>
      <PageHeader title="Project Analytics" description="Portfolio health · earned value · budget burn · status mix" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="SPI" value={String(stats?.spi ?? 1)} icon={Gauge} />
        <StatCard title="CPI" value={String(stats?.cpi ?? 1)} icon={Gauge} />
        <StatCard title="EV" value={formatNumber(stats?.earnedValue ?? 0)} icon={DollarSign} />
        <StatCard title="Projects" value={String(stats?.totalProjects ?? 0)} icon={FolderKanban} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Budget burn by category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {burn.length === 0 && (
              <p className="text-sm text-muted-foreground">No budget lines yet.</p>
            )}
            {burn.map((b) => (
              <div key={b.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{b.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatNumber(b.actual)} / {formatNumber(b.planned)}
                  </span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden relative">
                  <div
                    className="absolute h-full bg-primary/30"
                    style={{ width: `${(b.planned / maxBurn) * 100}%` }}
                  />
                  <div
                    className="absolute h-full bg-primary"
                    style={{ width: `${(b.actual / maxBurn) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Health & status mix</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Health</p>
              {Object.entries(healthMix).map(([k, n]) => (
                <div key={k} className="flex justify-between text-sm border rounded px-2 py-1.5">
                  <span className="capitalize">{k}</span>
                  <span className="tabular-nums font-medium">{n}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              {Object.entries(statusMix).map(([k, n]) => (
                <div key={k} className="flex justify-between text-sm border rounded px-2 py-1.5">
                  <span className="capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="tabular-nums font-medium">{n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
