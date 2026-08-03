"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Fingerprint,
  Users,
  Link2,
  GitBranch,
  Shield,
  ArrowRight,
  Network,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  getEcosystemStats,
  syncFromEmployees,
  MODULE_IDENTITY_MAP,
} from "@/lib/unified-identity";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const PRINCIPLES = [
  {
    title: "One person, one UPID",
    body: "Every human gets a Universal Person ID (HDG-PID-YYYY-######) that never changes across hire, transfer, role change, or credential reissue.",
  },
  {
    title: "Linked, not duplicated",
    body: "Login accounts, employee records, badges, CRM/SRM contacts, and portal users are links to the same person — not separate identities.",
  },
  {
    title: "Module entitlements",
    body: "Visibility in Production, Finance, Dispatch, SecureChat, etc. is controlled by entitlements on the person, derived from roles and explicit grants.",
  },
  {
    title: "Lifecycle consistency",
    body: "Activate, suspend, terminate, or archive once — status propagates through auth, HR, badges, and access control.",
  },
];

export default function IdentityEcosystemPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({
    totalPersons: 0,
    activePersons: 0,
    totalLinks: 0,
    totalEvents: 0,
    orphanAuthAccounts: 0,
    orphanEmployees: 0,
  });

  const load = async () => {
    try {
      setStats(await getEcosystemStats());
    } catch {
      /* migration pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    if (!auth) return;
    setSyncing(true);
    try {
      const r = await syncFromEmployees(auth.profile.company_id, auth.user.id);
      toast.success(`Synced ${r.created} employee(s) into unified persons`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <LoadingState message="Loading identity ecosystem…" />;

  return (
    <div>
      <PageHeader
        title="Unified Identity & Workforce Ecosystem"
        description="One digital person · consistent across every ERP module · UPID source of truth"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/identity/persons">Person directory</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/identity">IDM hub</Link>
            </Button>
            <Button size="sm" variant="outline" disabled={syncing} onClick={sync}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Sync employees
            </Button>
          </div>
        }
      />

      {/* Architecture diagram (text) */}
      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-hope-teal text-white p-5 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide mb-3">
          Identity architecture
        </p>
        <div className="font-mono text-[11px] sm:text-xs leading-relaxed space-y-1 opacity-95">
          <p>                    ┌─────────────────────────────┐</p>
          <p>                    │   Universal Person (UPID)   │</p>
          <p>                    │   One digital human being   │</p>
          <p>                    └─────────────┬───────────────┘</p>
          <p>           ┌──────────┬──────────┼──────────┬──────────┐</p>
          <p>           ▼          ▼          ▼          ▼          ▼</p>
          <p>        Login/IDM   Employee   ID Badge   CRM/SRM   SecureChat</p>
          <p>        (auth)      (HR 360°)  (access)   (parties) (presence)</p>
          <p>           │          │          │          │          │</p>
          <p>           └──────────┴──────────┴──────────┴──────────┘</p>
          <p>                         ERP module entitlements</p>
          <p>              Finance · Production · Dispatch · Assets · ITSM</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <StatCard title="Unified persons" value={formatNumber(stats.totalPersons)} icon={Users} />
        <StatCard title="Active" value={formatNumber(stats.activePersons)} icon={Fingerprint} />
        <StatCard title="Module links" value={formatNumber(stats.totalLinks)} icon={Link2} />
        <StatCard title="Lifecycle events" value={formatNumber(stats.totalEvents)} icon={GitBranch} />
        <StatCard title="Orphan auth accounts" value={String(stats.orphanAuthAccounts)} icon={AlertTriangle} />
        <StatCard title="Orphan employees" value={String(stats.orphanEmployees)} icon={AlertTriangle} />
      </div>

      {(stats.orphanAuthAccounts > 0 || stats.orphanEmployees > 0) && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Identity gaps detected</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auth accounts or employees without a UPID should be linked or synced so modules share one identity.
              </p>
            </div>
            <Button size="sm" onClick={sync} disabled={syncing}>
              Repair via sync
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Design principles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-lg border p-3">
                <p className="font-medium text-sm">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4" /> Module identity map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
            {MODULE_IDENTITY_MAP.map((m) => (
              <div key={m.module} className="flex items-start gap-2 border-b last:border-0 pb-2">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                  {m.module}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">{m.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Links: {m.linkTypes.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Operate the ecosystem
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Person directory", href: "/dashboard/identity/persons", desc: "Search UPIDs & status" },
          { title: "User accounts (IDM)", href: "/dashboard/identity/users", desc: "Auth · roles · MFA" },
          { title: "Employee profiles", href: "/dashboard/profiles", desc: "HR 360° digital profile" },
          { title: "ID credentials", href: "/dashboard/credentials", desc: "Badges · access · QR" },
          { title: "Provisioning", href: "/dashboard/identity/provision", desc: "Hire → account → badge" },
          { title: "SecureChat", href: "/dashboard/chat", desc: "Same person presence" },
          { title: "Payroll", href: "/dashboard/payroll", desc: "Same person payslips" },
          { title: "Service Desk", href: "/dashboard/service-desk", desc: "Same person tickets" },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-lg border bg-card p-4 hover:border-primary/40 transition-all"
          >
            <p className="font-medium text-sm flex items-center gap-1">
              {m.title}
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
