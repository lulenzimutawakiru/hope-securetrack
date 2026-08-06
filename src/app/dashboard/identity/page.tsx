"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield, Users, KeyRound, MonitorSmartphone, AlertTriangle, Scale,
  ArrowRight, Lock, UserCog, UserPlus, Upload, ShieldCheck, Fingerprint,
  GitBranch, FileText, Hash,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { crudCount, crudList } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";
import { IDM_LIFECYCLE } from "@/lib/idm";

const MODULES = [
  { title: "Unified Ecosystem", href: "/dashboard/identity/ecosystem", icon: Fingerprint, desc: "One person · one UPID · all modules" },
  { title: "Person Directory", href: "/dashboard/identity/persons", icon: Users, desc: "Universal Person IDs" },
  { title: "Employee Lifecycle", href: "/dashboard/identity/lifecycle", icon: GitBranch, desc: "Hire → active → exit · all modules" },
  { title: "Hire & Provision", href: "/dashboard/identity/hire", icon: UserPlus, desc: "HR hire → auto ERP · email · ID · MFA" },
  { title: "Employee Numbering", href: "/dashboard/identity/numbering", icon: Hash, desc: "Auto employee ID generation" },
  { title: "Provision Engine", href: "/dashboard/identity/engine", icon: GitBranch, desc: "Checklist jobs · re-run · deprovision" },
  { title: "Org Structure", href: "/dashboard/identity/org", icon: Users, desc: "Branches · plants · depts · cost centres" },
  { title: "Security Clearance", href: "/dashboard/identity/clearance", icon: ShieldCheck, desc: "Visitor → system owner · module matrix" },
  { title: "Company ID Cards", href: "/dashboard/identity/id-cards", icon: Fingerprint, desc: "QR · barcode · print · reissue" },
  { title: "Biometrics", href: "/dashboard/identity/biometrics", icon: Fingerprint, desc: "Fingerprint · face · ZKTeco · Hikvision" },
  { title: "HR ↔ Sync", href: "/dashboard/identity/sync", icon: GitBranch, desc: "Department change propagates everywhere" },
  { title: "Workforce AI", href: "/dashboard/identity/workforce-ai", icon: Fingerprint, desc: "Turnover · OT abuse · staffing forecast" },
  { title: "User Directory", href: "/dashboard/identity/users", icon: Users, desc: "Search · status · roles · last login" },
  { title: "Create Account", href: "/dashboard/identity/create", icon: UserPlus, desc: "Manual provisioning form" },
  { title: "Provisioning Queue", href: "/dashboard/identity/provision", icon: GitBranch, desc: "Approval workflow · activate" },
  { title: "Bulk Import", href: "/dashboard/identity/import", icon: Upload, desc: "CSV / Excel mass create" },
  { title: "Self-Service", href: "/dashboard/identity/self-service", icon: Users, desc: "Password · MFA · access requests" },
  { title: "Roles Builder", href: "/dashboard/identity/roles", icon: UserCog, desc: "RBAC · custom roles" },
  { title: "Permissions", href: "/dashboard/identity/permissions", icon: KeyRound, desc: "Module permission matrix" },
  { title: "ABAC Rules", href: "/dashboard/identity/abac", icon: ShieldCheck, desc: "Attribute-based access" },
  { title: "Security Monitor", href: "/dashboard/identity/monitor", icon: AlertTriangle, desc: "MFA · locked · failed logins" },
  { title: "MFA & Alerts", href: "/dashboard/identity/security", icon: Fingerprint, desc: "Alerts · login history" },
  { title: "Sessions", href: "/dashboard/identity/sessions", icon: MonitorSmartphone, desc: "Devices · IP · terminate" },
  { title: "Devices", href: "/dashboard/identity/devices", icon: MonitorSmartphone, desc: "Laptop · mobile · block" },
  { title: "SSO Providers", href: "/dashboard/identity/sso", icon: KeyRound, desc: "Entra · Google · SAML · AD" },
  { title: "API Accounts", href: "/dashboard/identity/api-accounts", icon: KeyRound, desc: "Keys · IoT · integrations" },
  { title: "Temporary Access", href: "/dashboard/identity/temporary", icon: Lock, desc: "Contractors · auditors · expiry" },
  { title: "AI Assistant", href: "/dashboard/identity/ai", icon: Fingerprint, desc: "Risk · roles · inactive" },
  { title: "Policies", href: "/dashboard/identity/policies", icon: Lock, desc: "Password · MFA policy" },
  { title: "Approval Matrix", href: "/dashboard/identity/approvals", icon: Scale, desc: "Document authority limits" },
  { title: "ID Audit", href: "/dashboard/identity/audit", icon: FileText, desc: "Identity governance trail" },
  { title: "Profiles 360°", href: "/dashboard/profiles", icon: Users, desc: "Employee digital profiles" },
  { title: "ID Credentials", href: "/dashboard/credentials", icon: Fingerprint, desc: "Badges · access · QR verify" },
];

export default function IdentityHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    active: 0,
    pending: 0,
    locked: 0,
    roles: 0,
    openAlerts: 0,
    failedLogins: 0,
    provisionOpen: 0,
  });
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      try {
        const [
          users,
          active,
          locked,
          roles,
          alertsC,
          failed,
          provisionOpen,
          alertRes,
        ] = await Promise.all([
          crudCount("user_profiles"),
          crudCount("user_profiles", { is_active: true }),
          crudCount("user_profiles", { account_status: "locked" }),
          crudCount("roles"),
          crudCount("security_alerts", { status: "open" }),
          crudCount("login_history", {
            success: false,
            created_at: { gte: dayAgo },
          }),
          crudCount("idm_provision_requests", {
            status: { not_in: ["activated", "rejected", "cancelled"] },
          }),
          crudList<Record<string, unknown>>("security_alerts", {
            page: 1,
            pageSize: 5,
            sort: "created_at",
            order: "desc",
            filters: { status: "open" },
          }),
        ]);

        setStats({
          users,
          active,
          pending: provisionOpen,
          locked,
          roles,
          openAlerts: alertsC,
          failedLogins: failed,
          provisionOpen,
        });
        setAlerts(alertRes.ok ? alertRes.data.data : []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading identity platform…" />;

  return (
    <div>
      <PageHeader
        title="Identity Management · IDM"
        description="Provisioning · RBAC · ABAC · MFA · SSO-ready · lifecycle · governance"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/identity/ecosystem">
                <Fingerprint className="h-4 w-4 mr-1" /> Ecosystem
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/identity/lifecycle">Lifecycle</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/identity/engine">Provision engine</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/identity/hire">
                <UserPlus className="h-4 w-4 mr-1" /> Hire & provision
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {IDM_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
          Identity architecture
        </p>
        <p className="text-white/70 text-xs mt-1">
          Provisioning → Approval → Auth Account → Profile · Roles · MFA → Sessions → ERP Modules → Audit & Access Reviews
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Users" value={String(stats.users)} icon={Users} />
        <StatCard title="Active" value={String(stats.active)} icon={Shield} />
        <StatCard title="Pending provision" value={String(stats.provisionOpen)} icon={GitBranch} />
        <StatCard title="Locked" value={String(stats.locked)} icon={Lock} />
        <StatCard title="Roles" value={String(stats.roles)} icon={UserCog} />
        <StatCard title="Open alerts" value={String(stats.openAlerts)} icon={AlertTriangle} />
        <StatCard title="Failed logins (24h)" value={String(stats.failedLogins)} icon={Fingerprint} />
        <StatCard title="Modules" value={String(MODULES.length)} icon={KeyRound} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">IDM modules</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <Link
                  key={m.href + m.title}
                  href={m.href}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="rounded-md bg-primary/10 p-2">
                    <m.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Open security alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground">No open alerts.</p>
            )}
            {alerts.map((a) => (
              <div key={String(a.id)} className="rounded-md border p-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{String(a.title)}</span>
                  <StatusBadge status={String(a.severity || "medium")} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {String(a.description || a.alert_type || "")}
                </p>
              </div>
            ))}
            <Button asChild variant="outline" size="sm" className="w-full mt-2">
              <Link href="/dashboard/identity/security">Security center</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        Total accounts in directory: {formatNumber(stats.users)}
      </div>
    </div>
  );
}
