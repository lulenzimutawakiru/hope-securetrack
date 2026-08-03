"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowRight, Brain, Clock, Gauge, Layers,
  Siren, Ticket, TrendingUp, UserCog, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import {
  buildExecutiveInsights,
  detectSlaBreachRisks,
  slaHealthSnapshot,
  agentWorkload,
  responseTimeStats,
  type Insight,
} from "@/lib/service-desk";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-200",
  warning: "bg-amber-500/10 text-amber-600 border-amber-200",
  info: "bg-blue-500/10 text-blue-600 border-blue-200",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

export default function ExecutivePage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [stats, setStats] = useState({
    open: 0,
    breached: 0,
    atRisk: 0,
    compliance: 0,
    csat: 0,
    firstResponseH: 0,
    resolutionH: 0,
  });
  const [workload, setWorkload] = useState<Array<{ agentName: string; openCount: number; criticalCount: number }>>([]);
  const [priorityBacklog, setPriorityBacklog] = useState<Array<{ priority: string; count: number }>>([]);
  const [escalations, setEscalations] = useState<Array<Record<string, unknown>>>([]);
  const [csatScores, setCsatScores] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        tickets, articles, agents, { data: csatRows }, { data: escalationsRows },
      ] = await Promise.all([
        supabase
          .from("support_tickets")
          .select(
            "id,ticket_number,subject,category,subcategory,priority,status,assigned_to,created_at,first_response_at,resolved_at,sla_resolve_due,sla_resolve_met"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase.from("sd_knowledge_articles").select("id,category").limit(500),
        supabase.from("sd_agents").select("id,name,email,full_name").limit(500),
        supabase
          .from("sd_csat_responses")
          .select("score,created_at")
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("sd_ticket_events")
          .select("id,event_type,message,new_value,created_at,ticket_id")
          .eq("event_type", "escalate")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const rows = (tickets.data as Array<Record<string, unknown>>) || [];
      const articlesRows = (articles.data as Array<Record<string, unknown>>) || [];
      const agentsRows = (agents.data as Array<Record<string, unknown>>) || [];

      const health = slaHealthSnapshot(rows);
      const timings = responseTimeStats(rows);
      const breachRisks = detectSlaBreachRisks(rows);
      const workloads = agentWorkload(rows, agentsRows);

      const scores = (csatRows as Array<Record<string, unknown>>) || [];
      const avgCsat =
        scores.length > 0
          ? scores.reduce((s, r) => s + Number(r.score || 0), 0) / scores.length
          : 0;

      const priorityMap = new Map<string, number>();
      for (const t of rows) {
        if (["closed", "resolved", "archived"].includes(String(t.status))) continue;
        const p = String(t.priority || "medium");
        priorityMap.set(p, (priorityMap.get(p) ?? 0) + 1);
      }
      const priorityOrder = ["critical", "high", "medium", "low"];
      const priorityRows = priorityOrder
        .map((p) => ({ priority: p, count: priorityMap.get(p) ?? 0 }))
        .filter((r) => r.count > 0);

      setInsights(buildExecutiveInsights({ tickets: rows, articles: articlesRows, agents: agentsRows }));
      setStats({
        open: health.active,
        breached: health.breached,
        atRisk: health.atRisk,
        compliance: health.compliancePct,
        csat: Math.round(avgCsat * 10) / 10,
        firstResponseH: timings.avgFirstResponseHours,
        resolutionH: timings.avgResolutionHours,
      });
      setWorkload(workloads.slice(0, 6));
      setPriorityBacklog(priorityRows);
      setEscalations((escalationsRows as Array<Record<string, unknown>>) || []);
      setCsatScores(scores.slice(0, 12).map((s) => Number(s.score || 0)));
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading executive command center..." />;

  const maxWorkload = Math.max(1, ...workload.map((w) => w.openCount));

  return (
    <div>
      <PageHeader
        title="Executive Service Command Center"
        description="Service performance · SLA compliance · AI insights · backlog · escalations"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/service-desk/reports"><BarChartIcon /> Reports</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/service-desk/escalations"><Siren className="h-4 w-4 mr-1" /> Escalation center</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Open tickets" value={String(stats.open)} icon={Ticket} description="Active across all services" />
        <StatCard title="SLA compliance" value={`${stats.compliance}%`} icon={Gauge} description="Resolved within target" trend={stats.compliance >= 90 ? "Healthy" : "Needs attention"} />
        <StatCard title="SLA breached" value={String(stats.breached)} icon={AlertTriangle} description="Past or near resolve deadline" />
        <StatCard title="At risk (3h)" value={String(stats.atRisk)} icon={Clock} description="Approaching resolve due" />
        <StatCard title="CSAT average" value={stats.csat ? formatNumber(stats.csat) : "--"} icon={Layers} description="Last 300 responses" />
        <StatCard title="First response" value={`${stats.firstResponseH}h`} icon={Activity} description="Average for measured tickets" />
        <StatCard title="Resolution" value={`${stats.resolutionH}h`} icon={Zap} description="Average time to resolve" />
        <StatCard title="AI insights" value={String(insights.length)} icon={Brain} description="Executive recommendations" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI service intelligence</CardTitle>
            <Badge variant="outline" className="text-[10px]">Tenant-isolated · realtime window</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[ins.severity]}`}>
                        {ins.severity}
                      </span>
                      <span className="text-sm font-medium">{ins.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ins.description}</p>
                    {ins.action && (
                      <p className="text-xs mt-1.5"><span className="font-medium">Action:</span> {ins.action}</p>
                    )}
                  </div>
                  {ins.metric && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{ins.metric}</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Agent workload</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {workload.length === 0 && (
                <p className="text-sm text-muted-foreground">No assigned work yet.</p>
              )}
              {workload.map((w) => (
                <div key={w.agentName}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="truncate">{w.agentName}</span>
                    <span className="text-muted-foreground text-xs">
                      {w.openCount} open {w.criticalCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{w.criticalCount} crit</Badge>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (w.openCount / maxWorkload) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Escalations (30d)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {escalations.length === 0 && (
                <p className="text-sm text-muted-foreground">No escalations recorded.</p>
              )}
              {escalations.map((e) => (
                <div key={String(e.id)} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground truncate">{String(e.message || "Escalated")}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(String(e.created_at)).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Backlog by priority</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityBacklog.length === 0 && (
                  <TableRow><TableCell colSpan={3}><EmptyState title="No backlog" description="All clear across priorities." /></TableCell></TableRow>
                )}
                {priorityBacklog.map((r) => {
                  const total = priorityBacklog.reduce((s, x) => s + x.count, 0) || 1;
                  return (
                    <TableRow key={r.priority}>
                      <TableCell className="capitalize">{r.priority}</TableCell>
                      <TableCell className="text-right font-mono">{r.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Math.round((r.count / total) * 100)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">CSAT trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {csatScores.length === 0 ? (
              <EmptyState title="No survey responses" description="CSAT scores appear after ticket closure." />
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {csatScores.map((s, i) => (
                  <div
                    key={i}
                    title={`${s}/10`}
                    className={`flex-1 rounded-t ${s >= 7 ? "bg-emerald-500/70" : s >= 4 ? "bg-amber-500/70" : "bg-red-500/70"}`}
                    style={{ height: `${(s / 10) * 100}%` }}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              <UserCog className="h-3 w-3 inline mr-1" />
              Latest {csatScores.length} responses, newest right.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Command center actions</CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/dashboard/service-desk/tickets", label: "Ticket management" },
            { href: "/dashboard/service-desk/problems", label: "Problem management" },
            { href: "/dashboard/service-desk/changes", label: "Change management" },
            { href: "/dashboard/service-desk/knowledge", label: "Knowledge base" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium">{l.label}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BarChartIcon() {
  return <Activity className="h-4 w-4 mr-1" />;
}