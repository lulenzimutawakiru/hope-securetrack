"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, AlertTriangle, Users, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";

export default function PlatformSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/platform/command-center")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading security console…" />;

  const s = data?.security;
  const h = data?.health;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security administration"
        description="Platform-wide identity, MFA, privileged access, and threat signals"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/identity">IAM (ERP)</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/security/dual-control">Dual control</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Failed logins (24h)</p>
            <p className="text-2xl font-semibold">{s?.failed_logins_24h ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Open security alerts</p>
            <p className="text-2xl font-semibold">{s?.open_alerts ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">MFA-enabled users</p>
            <p className="text-2xl font-semibold">{s?.mfa_enabled_users ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Platform admins</p>
            <p className="text-2xl font-semibold">{s?.platform_admins ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Policy posture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row ok={h?.mfa_enforced} label="MFA_ENFORCE_PRIVILEGED" />
            <Row ok={h?.dual_control} label="DUAL_CONTROL_REQUIRED" />
            <Row ok={!h?.payment_sandbox} label="Payment sandbox disabled" />
            <Row ok={h?.job_worker_configured} label="Job worker authenticated" />
            <p className="text-xs text-muted-foreground pt-2">
              Privileged users (est.): {s?.privileged_users ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Recent security events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-72 overflow-y-auto">
            {(data?.recent_security_events || []).map((ev) => (
              <div
                key={ev.id}
                className="flex justify-between gap-2 text-xs border-b py-1.5 last:border-0"
              >
                <span className="font-medium truncate">{ev.event_type}</span>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {ev.severity || "info"}
                </Badge>
              </div>
            ))}
            {!data?.recent_security_events?.length && (
              <p className="text-sm text-muted-foreground">No events.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Security operations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/users">Estate users</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/ops">Break-glass elevation</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/audit">Audit and compliance (ERP)</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/mfa">MFA challenge</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Password policies — Supabase Auth + app MFA enrollment</p>
            <p>MFA — TOTP AAL2 for privileged routes (requireMfa)</p>
            <p>SSO / OAuth / SAML / Entra ID / Google Workspace — Integration Center</p>
            <p>Session management — force logout from User Administration</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Access control</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">RBAC</strong> — 1000+ roles,
              fail-closed route permissions
            </p>
            <p>
              <strong className="text-foreground">ABAC</strong> — tenant,
              company, branch stamps on every request
            </p>
            <p>
              <strong className="text-foreground">Zero Trust</strong> — never
              trust URL/body tenant IDs; session is authority
            </p>
            <p>
              <strong className="text-foreground">SoD</strong> — dual control for
              payroll/payments; Finance Admin cannot modify payroll by default
            </p>
            <p>
              <strong className="text-foreground">PAM</strong> — platform elevation
              with reason, duration, audit (Ops)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex justify-between items-center border-b py-1.5 last:border-0">
      <span>{label}</span>
      <Badge variant={ok ? "secondary" : "destructive"} className="text-[10px]">
        {ok ? "on" : "off"}
      </Badge>
    </div>
  );
}
