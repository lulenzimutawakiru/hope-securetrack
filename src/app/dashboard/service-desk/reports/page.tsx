"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { slaStatus } from "@/lib/service-desk";

export default function ServiceDeskReportsPage() {
  const [tickets, setTickets] = useState<Array<Record<string, unknown>>>([]);
  const [csat, setCsat] = useState<Array<{ score: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: c }] = await Promise.all([
        supabase.from("support_tickets").select("*").is("deleted_at", null).limit(1000),
        supabase.from("sd_csat_responses").select("score").limit(500),
      ]);
      setTickets((data as Array<Record<string, unknown>>) || []);
      setCsat((c as Array<{ score: number }>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => !["closed", "resolved", "archived"].includes(String(t.status))).length;
    const resolved = tickets.filter((t) => ["resolved", "closed"].includes(String(t.status))).length;
    const breached = tickets.filter(
      (t) =>
        slaStatus({
          due: t.sla_resolve_due as string,
          met: t.sla_resolve_met as boolean | null,
          completedAt: t.resolved_at as string,
        }) === "breached"
    ).length;
    const slaCompliance =
      total > 0 ? Math.round(((total - breached) / total) * 1000) / 10 : 100;

    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    for (const t of tickets) {
      const p = String(t.priority || "medium");
      const c = String(t.category || "general");
      const ch = String(t.channel || "web");
      byPriority[p] = (byPriority[p] || 0) + 1;
      byCategory[c] = (byCategory[c] || 0) + 1;
      byChannel[ch] = (byChannel[ch] || 0) + 1;
    }

    const avgCsat =
      csat.length > 0 ? csat.reduce((s, r) => s + Number(r.score || 0), 0) / csat.length : 0;

    // Agent productivity (by assigned_to)
    const byAgent: Record<string, number> = {};
    for (const t of tickets) {
      const a = String(t.assigned_to || "unassigned");
      byAgent[a] = (byAgent[a] || 0) + 1;
    }

    return {
      total,
      open,
      resolved,
      breached,
      slaCompliance,
      byPriority: Object.entries(byPriority).sort((a, b) => b[1] - a[1]),
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8),
      byChannel: Object.entries(byChannel).sort((a, b) => b[1] - a[1]),
      avgCsat,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 1000) / 10 : 0,
      agentCount: Object.keys(byAgent).length,
    };
  }, [tickets, csat]);

  if (loading) return <LoadingState message="Loading analytics…" />;

  return (
    <div>
      <PageHeader
        title="Service Desk Analytics"
        description="Volume · SLA compliance · CSAT · agent load · channel mix"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Ticket volume" value={String(analytics.total)} icon={BarChart3} />
        <StatCard title="Open backlog" value={String(analytics.open)} icon={BarChart3} />
        <StatCard title="SLA compliance %" value={formatNumber(analytics.slaCompliance)} icon={BarChart3} />
        <StatCard title="Resolution rate %" value={formatNumber(analytics.resolutionRate)} icon={BarChart3} />
        <StatCard title="Breached" value={String(analytics.breached)} icon={BarChart3} />
        <StatCard title="Avg CSAT" value={analytics.avgCsat ? formatNumber(analytics.avgCsat) : "—"} icon={BarChart3} />
        <StatCard title="Resolved" value={String(analytics.resolved)} icon={BarChart3} />
        <StatCard title="Agent queues" value={String(analytics.agentCount)} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By priority</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byPriority.map(([k, n]) => (
              <div key={k} className="flex justify-between text-sm capitalize">
                <span>{k}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By category</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byCategory.map(([k, n]) => (
              <div key={k} className="flex justify-between text-sm capitalize">
                <span>{k}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By channel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byChannel.map(([k, n]) => (
              <div key={k} className="flex justify-between text-sm capitalize">
                <span>{k}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
