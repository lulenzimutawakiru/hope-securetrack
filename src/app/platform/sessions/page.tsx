"use client";

/**
 * Login Monitoring / Security Operations - failed logins, sessions, blocked
 * IPs, MFA coverage, and live security events.
 */

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  LogIn,
  MonitorSmartphone,
  Ban,
  KeyRound,
  AlertTriangle,
  } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  } from "recharts";
import { formatNumber } from "@/lib/utils";
import type { SecurityOverview } from "@/lib/platform/admin-console";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-slate-100 text-slate-700 border-slate-200"};

export default function SessionsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SecurityOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/security-overview");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load security overview");
        }
        setData(json.data ?? json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading security overview..." />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Security overview unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login Monitoring & Sessions"
        description="Failed authentication, active sessions, blocked IPs, and MFA posture"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-[11px] font-medium uppercase tracking-wider">Security score</p>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{data.score}/100</p>
          <Progress value={data.score} className="mt-2" />
        </div>
        <MetricCard icon={<LogIn className="h-4 w-4" />} label="Failed logins 24h" value={formatNumber(data.failed_logins_24h)} />
        <MetricCard icon={<LogIn className="h-4 w-4" />} label="Failed logins 7d" value={formatNumber(data.failed_logins_7d)} />
        <MetricCard icon={<MonitorSmartphone className="h-4 w-4" />} label="Active sessions" value={formatNumber(data.active_sessions)} />
        <MetricCard icon={<Ban className="h-4 w-4" />} label="Blocked IPs 7d" value={formatNumber(data.distinct_blocked_ips)} />
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            <p className="text-[11px] font-medium uppercase tracking-wider">MFA coverage</p>
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{data.mfa_coverage_pct}%</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatNumber(data.mfa_users)} of {formatNumber(data.total_users)} users
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Failed logins <span className="text-xs font-normal text-muted-foreground">last 7 days</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.failed_logins_daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Open security alerts <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{data.open_alerts} open</Badge>
              <Badge variant="outline" className="border-red-300 text-red-700">
                {data.critical_alerts} critical
              </Badge>
              <Badge variant="outline">{data.platform_admins} platform admins</Badge>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {data.events.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No events"
                  description="Security events will appear here as they are detected."
                  className="py-8"
                />
              ) : (
                data.events.map((ev) => (
                  <div key={`${ev.kind}-${ev.id}`} className="rounded-md border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={SEVERITY_COLORS[ev.severity] ?? "bg-muted text-muted-foreground"}
                      >
                        {ev.severity || "info"}
                      </Badge>
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.tenant_name && (
                        <span className="text-[11px] text-muted-foreground">{ev.tenant_name}</span>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {ev.ip_address && <span className="font-mono">{ev.ip_address}</span>}
                      {ev.status && <StatusBadge status={ev.status} />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Snapshot {new Date(data.generated_at).toLocaleString()} - Security Center is
        restricted to Security and Platform Owner roles.
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}