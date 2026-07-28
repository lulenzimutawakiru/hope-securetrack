"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  KeyRound,
  MonitorSmartphone,
  AlertTriangle,
  Scale,
  ArrowRight,
  Lock,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const MODULES = [
  { title: "Directory", href: "/dashboard/identity/users", icon: Users, desc: "User profiles & lifecycle" },
  { title: "Roles", href: "/dashboard/identity/roles", icon: UserCog, desc: "RBAC roles & assignments" },
  { title: "Permissions", href: "/dashboard/identity/permissions", icon: KeyRound, desc: "Permission matrix" },
  { title: "Sessions", href: "/dashboard/identity/sessions", icon: MonitorSmartphone, desc: "Active sessions" },
  { title: "Security", href: "/dashboard/identity/security", icon: AlertTriangle, desc: "Alerts & login history" },
  { title: "Policies", href: "/dashboard/identity/policies", icon: Lock, desc: "Password & MFA policy" },
  { title: "Approval Matrix", href: "/dashboard/identity/approvals", icon: Scale, desc: "Authority limits" },
  { title: "Audit Logs", href: "/dashboard/audit", icon: Shield, desc: "Immutable activity trail" },
];

export default function IdentityHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    active: 0,
    locked: 0,
    roles: 0,
    openAlerts: 0,
    failedLogins: 0,
  });
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const [users, active, locked, roles, alertsC, failed, { data: alertRows }] =
        await Promise.all([
          supabase.from("user_profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("user_profiles")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("user_profiles")
            .select("*", { count: "exact", head: true })
            .not("locked_until", "is", null),
          supabase.from("roles").select("*", { count: "exact", head: true }),
          supabase
            .from("security_alerts")
            .select("*", { count: "exact", head: true })
            .eq("status", "open"),
          supabase
            .from("login_history")
            .select("*", { count: "exact", head: true })
            .eq("success", false)
            .gte("created_at", dayAgo),
          supabase
            .from("security_alerts")
            .select("*")
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      setStats({
        users: users.count ?? 0,
        active: active.count ?? 0,
        locked: locked.count ?? 0,
        roles: roles.count ?? 0,
        openAlerts: alertsC.count ?? 0,
        failedLogins: failed.count ?? 0,
      });
      setAlerts(alertRows ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading identity platform…" />;

  return (
    <div>
      <PageHeader
        title="User & Identity Management"
        description="Hope Design Group Ltd — Authentication · RBAC · MFA · Sessions · Audit · SoD"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/identity/users">
              <Button>User directory</Button>
            </Link>
            <Link href="/dashboard/identity/security">
              <Button variant="outline">Security center</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          Identity architecture
        </p>
        <p className="text-white/70 text-xs mt-1">
          Identity Provider → Authentication → MFA → Role & Permission Engine →
          Session Management → ERP Modules → Audit & Security Monitoring
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <StatCard title="Users" value={formatNumber(stats.users)} icon={Users} />
        <StatCard title="Active" value={formatNumber(stats.active)} />
        <StatCard title="Locked" value={formatNumber(stats.locked)} />
        <StatCard title="Roles" value={formatNumber(stats.roles)} />
        <StatCard title="Open alerts" value={formatNumber(stats.openAlerts)} icon={AlertTriangle} />
        <StatCard title="Failed logins 24h" value={formatNumber(stats.failedLogins)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Security alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open security alerts.</p>
            ) : (
              alerts.map((a) => (
                <div key={String(a.id)} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium text-sm">{String(a.title)}</p>
                    <StatusBadge status={String(a.severity)} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {String(a.description || a.alert_type)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance posture</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>✓ RBAC + RLS multi-tenant</p>
            <p>✓ Immutable audit logs</p>
            <p>✓ Login history & lockout</p>
            <p>✓ Approval authority matrix</p>
            <p className="text-xs pt-2">
              Aligns with Uganda Data Protection and Privacy Act, ISO 27001 access
              control practices, and internal SoD policies.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border p-4 hover:border-hope-teal/40 hover:bg-muted/40 transition-colors"
            >
              <div className="flex justify-between mb-2">
                <Icon className="h-5 w-5 text-hope-teal" />
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
