"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FolderKanban, AlertTriangle, CheckCircle2, Target, ArrowRight,
  Activity, DollarSign, Gauge, ListTodo, ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { PPM_MENU, getPpmDashboardStats } from "@/lib/ppm";
import { formatNumber } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function ProjectDashboardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPpmDashboardStats>> | null>(null);
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);
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
        const [s, { data: projects }, { data: ai }] = await Promise.all([
          getPpmDashboardStats(companyId),
          sb
            .from("ppm_projects")
            .select("id,project_code,name,status,health,percent_complete,manager_name,spi,cpi")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(8),
          sb
            .from("ppm_ai_insights")
            .select("title,severity,summary,score")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
        setStats(s);
        setRecent((projects as Array<Record<string, unknown>>) || []);
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
    return PPM_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof PPM_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Project Portfolio Management…" />;

  return (
    <div>
      <PageHeader
        title="Project Portfolio Management"
        description="PPM · WBS · Gantt · Agile · Resources · Finance · Billing · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/projects/gantt">Gantt</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/projects/kanban">Kanban</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/projects/ai"><Activity className="h-4 w-4 mr-1" /> AI</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/projects/list"><FolderKanban className="h-4 w-4 mr-1" /> Projects</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
        <StatCard title="Active Projects" value={String(stats?.activeProjects ?? 0)} icon={FolderKanban} />
        <StatCard title="Delayed" value={String(stats?.delayedProjects ?? 0)} icon={AlertTriangle} />
        <StatCard title="Completed" value={String(stats?.completedProjects ?? 0)} icon={CheckCircle2} />
        <StatCard title="Upcoming Milestones" value={String(stats?.upcomingMilestones ?? 0)} icon={Target} />
        <StatCard title="Budget Utilization" value={`${stats?.budgetUtilization ?? 0}%`} icon={DollarSign} />
        <StatCard title="SPI" value={String(stats?.spi ?? 1)} icon={Gauge} />
        <StatCard title="CPI" value={String(stats?.cpi ?? 1)} icon={Gauge} />
        <StatCard title="Planned Value (PV)" value={formatNumber(stats?.plannedValue ?? 0)} icon={DollarSign} />
        <StatCard title="Earned Value (EV)" value={formatNumber(stats?.earnedValue ?? 0)} icon={DollarSign} />
        <StatCard title="Actual Cost (AC)" value={formatNumber(stats?.actualCost ?? 0)} icon={DollarSign} />
        <StatCard title="Open Risks" value={String(stats?.openRisks ?? 0)} icon={ShieldAlert} />
        <StatCard title="Open Issues" value={String(stats?.openIssues ?? 0)} icon={AlertTriangle} />
        <StatCard title="Pending Approvals" value={String(stats?.pendingApprovals ?? 0)} icon={ListTodo} />
        <StatCard title="Profitability (EV−AC)" value={formatNumber(stats?.profitability ?? 0)} icon={DollarSign} />
        <StatCard title="Team Productivity" value={`${stats?.teamProductivity ?? 0}%`} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">No projects yet. Create one from Templates or Requests.</p>
            )}
            {recent.map((p) => (
              <div key={String(p.id)} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{String(p.project_code)} · {String(p.name)}</div>
                  <div className="text-xs text-muted-foreground">
                    {String(p.manager_name || "—")} · {String(p.percent_complete || 0)}% · SPI {String(p.spi ?? "—")} · CPI {String(p.cpi ?? "—")}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline">{String(p.health)}</Badge>
                  <Badge variant="secondary">{String(p.status)}</Badge>
                </div>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/projects/list">All projects <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">Run AI Project Assistant for forecasts and risks.</p>
            )}
            {insights.map((ins, i) => (
              <div key={i} className="border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={String(ins.severity) === "critical" ? "destructive" : "outline"}>
                    {String(ins.severity)}
                  </Badge>
                  <span className="font-medium">{String(ins.title)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{String(ins.summary)}</p>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/projects/ai">Open AI assistant <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <Input placeholder="Search project modules…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
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
