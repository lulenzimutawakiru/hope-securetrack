"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Shield, Users, Lock, AlertTriangle, Fingerprint, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

export default function SecurityMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [failed, setFailed] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [tempExpiring, setTempExpiring] = useState(0);
  const [recentFails, setRecentFails] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const dayAgo = new Date(Date.now() - 864e5).toISOString();
      const in14 = new Date(Date.now() + 14 * 864e5).toISOString();
      const [
        { data: u },
        failedC,
        alertsC,
        sessionsC,
        tempC,
        { data: fails },
      ] = await Promise.all([
        supabase.from("user_profiles").select("id,is_active,account_status,mfa_enabled,require_mfa,mfa_enforced,account_expires_at,failed_login_count,last_login_at").is("deleted_at", null),
        supabase.from("login_history").select("*", { count: "exact", head: true }).eq("success", false).gte("created_at", dayAgo),
        supabase.from("security_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("user_sessions").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("idm_temp_access")
          .select("*", { count: "exact", head: true })
          .in("status", ["active", "scheduled"])
          .lte("end_at", in14),
        supabase
          .from("login_history")
          .select("*")
          .eq("success", false)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      setUsers((u as Array<Record<string, unknown>>) || []);
      setFailed(failedC.count ?? 0);
      setAlerts(alertsC.count ?? 0);
      setSessions(sessionsC.count ?? 0);
      setTempExpiring(tempC.count ?? 0);
      setRecentFails((fails as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active).length;
    const locked = users.filter(
      (u) => u.account_status === "locked" || Number(u.failed_login_count || 0) >= 5
    ).length;
    const mfa = users.filter((u) => u.mfa_enabled || u.require_mfa || u.mfa_enforced).length;
    const mfaPct = total ? Math.round((mfa / total) * 1000) / 10 : 0;
    const now = Date.now();
    const expiring = users.filter((u) => {
      if (!u.account_expires_at) return false;
      const d = new Date(String(u.account_expires_at)).getTime() - now;
      return d >= 0 && d <= 14 * 864e5;
    }).length;
    const inactive = users.filter((u) => {
      if (!u.is_active) return false;
      if (!u.last_login_at) return true;
      return now - new Date(String(u.last_login_at)).getTime() > 90 * 864e5;
    }).length;
    return { total, active, locked, mfaPct, expiring, inactive };
  }, [users]);

  if (loading) return <LoadingState message="Loading security monitor…" />;

  return (
    <div>
      <PageHeader
        title="Security Monitoring"
        description="Users · locked · failed logins · MFA · expiring · sessions · threats"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/identity/security">Alerts</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/identity/ai">AI insights</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total users" value={String(metrics.total)} icon={Users} />
        <StatCard title="Active users" value={String(metrics.active)} icon={Users} />
        <StatCard title="Locked accounts" value={String(metrics.locked)} icon={Lock} />
        <StatCard title="Failed logins (24h)" value={String(failed)} icon={AlertTriangle} />
        <StatCard title="Open alerts" value={String(alerts)} icon={Shield} />
        <StatCard title="MFA adoption %" value={formatNumber(metrics.mfaPct)} icon={Fingerprint} />
        <StatCard title="Expiring accounts" value={String(metrics.expiring)} icon={Clock} />
        <StatCard title="Active sessions" value={String(sessions)} icon={Shield} />
        <StatCard title="Inactive 90d+" value={String(metrics.inactive)} icon={Users} />
        <StatCard title="Temp access ≤14d" value={String(tempExpiring)} icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Suspicious login failures</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentFails.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent failures.</p>
            )}
            {recentFails.map((f) => (
              <div key={String(f.id)} className="text-sm border-b py-1.5 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{String(f.email || "unknown")}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.created_at ? new Date(String(f.created_at)).toLocaleString() : ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {String(f.failure_reason || "Failed")} · {String(f.ip_address || "—")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quick links</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2">
            {[
              { href: "/dashboard/identity/sessions", label: "Sessions" },
              { href: "/dashboard/identity/devices", label: "Devices" },
              { href: "/dashboard/identity/temporary", label: "Temp access" },
              { href: "/dashboard/identity/audit", label: "Audit trail" },
              { href: "/dashboard/identity/users", label: "Directory" },
              { href: "/dashboard/identity/sso", label: "SSO" },
            ].map((l) => (
              <Button key={l.href} asChild variant="outline" size="sm">
                <Link href={l.href}>{l.label}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
