"use client";

import { useEffect, useState } from "react";
import { Activity, Users, ShieldAlert, KeyRound, Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime } from "@/lib/utils";

export default function AuditLivePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sessions: 0,
    failed: 0,
    highRisk: 0,
    alerts: 0,
    api: 0,
    mfa: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);

  const load = async () => {
    const sb = createClient();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [
      { count: sessions },
      { count: failed },
      { count: highRisk },
      { count: alerts },
      { count: api },
      { count: mfa },
      { data: events },
      { data: sess },
    ] = await Promise.all([
      sb.from("eal_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
      sb.from("eal_events").select("*", { count: "exact", head: true }).eq("event_type", "login_failed").gte("created_at", since),
      sb.from("eal_events").select("*", { count: "exact", head: true }).gte("risk_score", 70).gte("created_at", since),
      sb.from("eal_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
      sb.from("eal_api_calls").select("*", { count: "exact", head: true }).gte("created_at", since),
      sb.from("eal_sessions").select("*", { count: "exact", head: true }).eq("status", "active").eq("mfa_verified", true),
      sb.from("eal_events").select("*").order("created_at", { ascending: false }).limit(15),
      sb.from("eal_sessions").select("*").eq("status", "active").order("login_at", { ascending: false }).limit(10),
    ]);
    setStats({
      sessions: sessions ?? 0,
      failed: failed ?? 0,
      highRisk: highRisk ?? 0,
      alerts: alerts ?? 0,
      api: api ?? 0,
      mfa: mfa ?? 0,
    });
    setRecent((events as Array<Record<string, unknown>>) || []);
    setSessions((sess as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    const t = setInterval(() => load().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <LoadingState message="Loading live security dashboard…" />;

  return (
    <div>
      <PageHeader
        title="Live Security Dashboard"
        description="Active sessions · failed logins · high-risk · API · auto-refresh 15s"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Active sessions" value={String(stats.sessions)} icon={Users} />
        <StatCard title="Failed logins (24h)" value={String(stats.failed)} icon={KeyRound} />
        <StatCard title="High-risk (24h)" value={String(stats.highRisk)} icon={ShieldAlert} />
        <StatCard title="Open alerts" value={String(stats.alerts)} icon={ShieldAlert} />
        <StatCard title="API calls (24h)" value={String(stats.api)} icon={Globe} />
        <StatCard title="MFA sessions" value={String(stats.mfa)} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {recent.map((e) => (
              <div key={String(e.id)} className="flex justify-between gap-2 border-b pb-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{String(e.title || e.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(e.full_name || e.user_email || "System")} · {String(e.module)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{String(e.severity)}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDateTime(String(e.created_at))}
                  </p>
                </div>
              </div>
            ))}
            {recent.length === 0 && <p className="text-sm text-muted-foreground">No recent events</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Active sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {sessions.map((s) => (
              <div key={String(s.id)} className="rounded border p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{String(s.full_name || s.username)}</span>
                  <Badge variant={s.mfa_verified ? "default" : "outline"} className="text-[10px]">
                    {s.mfa_verified ? "MFA" : "No MFA"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {String(s.role_name || "—")} · {String(s.ip_address || "—")} · risk {String(s.risk_score ?? 0)}
                </p>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">No active sessions tracked</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
