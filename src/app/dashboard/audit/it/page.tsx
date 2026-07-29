"use client";

import { useEffect, useState } from "react";
import { Server, KeyRound, Globe, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

export default function AuditItDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ changes: 0, failed: 0, api: 0, devices: 0 });
  const [changes, setChanges] = useState<Array<Record<string, unknown>>>([]);
  const [failed, setFailed] = useState<Array<Record<string, unknown>>>([]);
  const [api, setApi] = useState<Array<Record<string, unknown>>>([]);
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [
        { data: ch, count: chN },
        { data: fl, count: flN },
        { data: ap, count: apN },
        { data: sess, count: dN },
      ] = await Promise.all([
        sb.from("eal_events").select("*", { count: "exact" }).in("crud_op", ["config", "update", "create", "delete"]).in("module", ["settings", "iam", "print", "api", "workflows"]).gte("created_at", since).order("created_at", { ascending: false }).limit(15),
        sb.from("eal_events").select("*", { count: "exact" }).eq("event_type", "login_failed").gte("created_at", since).order("created_at", { ascending: false }).limit(15),
        sb.from("eal_api_calls").select("*", { count: "exact" }).gte("created_at", since).order("created_at", { ascending: false }).limit(15),
        sb.from("eal_sessions").select("*", { count: "exact" }).order("login_at", { ascending: false }).limit(15),
      ]);
      setChanges((ch as Array<Record<string, unknown>>) || []);
      setFailed((fl as Array<Record<string, unknown>>) || []);
      setApi((ap as Array<Record<string, unknown>>) || []);
      setSessions((sess as Array<Record<string, unknown>>) || []);
      setStats({
        changes: chN ?? 0,
        failed: flN ?? 0,
        api: apN ?? 0,
        devices: dN ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading IT security dashboard…" />;

  return (
    <div>
      <PageHeader
        title="IT Security Dashboard"
        description="System changes · failed logins · API usage · device activity"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="System changes (7d)" value={String(stats.changes)} icon={Server} />
        <StatCard title="Failed logins (7d)" value={String(stats.failed)} icon={KeyRound} />
        <StatCard title="API calls (7d)" value={String(stats.api)} icon={Globe} />
        <StatCard title="Device sessions" value={String(stats.devices)} icon={Smartphone} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">System changes</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {changes.map((e) => (
              <div key={String(e.id)} className="text-sm border-b pb-2">
                <p className="font-medium truncate">{String(e.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(e.module)} · {String(e.user_email || "system")} · {formatDateTime(String(e.created_at))}
                </p>
              </div>
            ))}
            {changes.length === 0 && <p className="text-sm text-muted-foreground">No config/system events</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Failed logins</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {failed.map((e) => (
              <div key={String(e.id)} className="text-sm border-b pb-2 flex justify-between">
                <div>
                  <p className="font-medium">{String(e.user_email || e.title)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{String(e.ip_address || "—")}</p>
                </div>
                <Badge variant="destructive" className="text-[10px]">fail</Badge>
              </div>
            ))}
            {failed.length === 0 && <p className="text-sm text-muted-foreground">No failed logins</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">API usage</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {api.map((e) => (
              <div key={String(e.id)} className="text-xs flex justify-between border-b pb-1">
                <span className="font-mono">{String(e.method)} {String(e.path)}</span>
                <Badge variant={Number(e.status_code) >= 400 ? "destructive" : "outline"} className="text-[10px]">
                  {String(e.status_code)}
                </Badge>
              </div>
            ))}
            {api.length === 0 && <p className="text-sm text-muted-foreground">No API telemetry</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Device activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {sessions.map((s) => (
              <div key={String(s.id)} className="text-sm border-b pb-2">
                <p className="font-medium">{String(s.full_name || s.username)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(s.ip_address || "—")} · MFA {s.mfa_verified ? "yes" : "no"} · {String(s.status)}
                </p>
              </div>
            ))}
            {sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
