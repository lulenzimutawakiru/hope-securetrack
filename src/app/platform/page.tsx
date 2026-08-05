"use client";

/**
 * Enterprise Command Center — SecureTrack OS administration home.
 * Platform Super Admin only (enforced by layout + APIs).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Activity,
  Server,
  Shield,
  CreditCard,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  ArrowRight,
  Brain,
  Layers,
  LineChart,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";

export default function EnterpriseCommandCenterPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/command-center");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load command center");
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

  if (loading) {
    return <LoadingState message="Loading Enterprise Command Center…" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Command center unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Ensure you are signed in as platform staff (is_platform_admin, no tenant).
        </p>
      </div>
    );
  }

  const h = data.health;
  const e = data.estate;
  const s = data.security;
  const b = data.business;
  const j = data.jobs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Command Center"
        description="SecureTrack ERP operating system — platform, tenant, and company administration"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/tenants">Manage tenants</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/platform/provisioning">Provision tenant</Link>
            </Button>
          </div>
        }
      />

      {/* Architecture banner */}
      <div className="rounded-xl border bg-gradient-to-r from-[#0b1e36] to-[#0d3d4d] text-white p-4">
        <p className="text-hope-gold text-[10px] font-semibold uppercase tracking-wider">
          Three-layer control plane
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["platform", data.layers.platform],
              ["tenant", data.layers.tenant],
              ["company", data.layers.company],
            ] as const
          ).map(([key, layer], i) => (
            <div
              key={key}
              className="rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <p className="text-xs text-hope-gold font-semibold">
                {i + 1}. {layer.label}
              </p>
              <p className="text-[11px] text-white/70 mt-1 leading-snug">
                {layer.description}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-3">
          Isolated from /dashboard ERP operations · Roles: Platform Owner · CTO ·
          Security · DevOps · Compliance
        </p>
      </div>

      {/* Platform health */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4" /> Platform health
          <Badge
            variant={
              h.status === "healthy"
                ? "secondary"
                : h.status === "degraded"
                  ? "outline"
                  : "destructive"
            }
            className="text-[10px] capitalize"
          >
            {h.status}
          </Badge>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <HealthPill ok={h.database_ok} label="Database" detail={h.database_latency_ms != null ? `${h.database_latency_ms}ms` : undefined} />
          <HealthPill ok={h.redis_configured} label="Redis rate limits" />
          <HealthPill ok={h.job_worker_configured} label="Job worker secret" />
          <HealthPill ok={h.ai_configured} label="AI gateway" />
          <HealthPill ok={h.resend_configured} label="Email (Resend)" />
          <HealthPill ok={h.mfa_enforced} label="MFA enforced" />
          <HealthPill ok={h.dual_control} label="Dual control" />
          <HealthPill ok={!h.payment_sandbox} label="Payments live" detail={h.payment_sandbox ? "sandbox" : "prod"} />
        </div>
      </section>

      {/* Estate metrics */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Estate & business
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Tenants" value={String(e.tenants_total)} icon={Building2} />
          <StatCard title="Active" value={String(e.tenants_active)} icon={CheckCircle2} />
          <StatCard title="Trial" value={String(e.tenants_trial)} icon={Timer} />
          <StatCard title="Suspended" value={String(e.tenants_suspended)} icon={XCircle} />
          <StatCard title="Companies" value={String(e.companies)} icon={Layers} />
          <StatCard title="Users" value={String(e.users)} icon={Users} />
          <StatCard title="Active licenses" value={String(e.active_subscriptions)} icon={CreditCard} />
          <StatCard title="Expiring trials (7d)" value={String(b.expiring_trials_7d)} icon={Timer} />
        </div>
        {b.plan_breakdown.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {b.plan_breakdown.map((p) => (
              <Badge key={p.plan} variant="outline" className="text-[10px] capitalize">
                {p.plan}: {p.count}
              </Badge>
            ))}
            <Badge variant="secondary" className="text-[10px]">
              Module enablements: {b.module_enabled_rows}
            </Badge>
          </div>
        )}
      </section>

      {/* Jobs + security */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="h-4 w-4" /> Background jobs & queues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Pending" value={j.pending} />
              <Metric label="Running" value={j.running} />
              <Metric label="Failed" value={j.failed} tone={j.failed ? "danger" : undefined} />
              <Metric label="Dead letter" value={j.dead} tone={j.dead ? "danger" : undefined} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/jobs">
                  Job queue <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/monitoring">Monitoring</Link>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Events (24h): {e.events_24h} · Open provision jobs:{" "}
              {e.open_provision_jobs}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Security overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Failed logins (24h)"
                value={s.failed_logins_24h}
                tone={s.failed_logins_24h > 20 ? "danger" : undefined}
              />
              <Metric
                label="Open alerts"
                value={s.open_alerts}
                tone={s.open_alerts ? "danger" : undefined}
              />
              <Metric label="MFA-enabled users" value={s.mfa_enabled_users} />
              <Metric label="Privileged users" value={s.privileged_users} />
              <Metric label="Platform admins" value={s.platform_admins} />
            </div>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href="/platform/security">
                Security console <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent tenants</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/platform/tenants">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent_tenants.map((t) => (
              <Link
                key={t.id}
                href={`/platform/tenants/${t.id}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {t.slug} · {t.plan_code || "—"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {t.status}
                </Badge>
              </Link>
            ))}
            {data.recent_tenants.length === 0 && (
              <p className="text-sm text-muted-foreground">No tenants yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Security events
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/platform/events">Stream</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto">
            {data.recent_security_events.map((ev) => (
              <div
                key={ev.id}
                className="flex justify-between gap-2 text-xs border-b py-1.5 last:border-0"
              >
                <span className="font-medium truncate">{ev.event_type}</span>
                <span className="text-muted-foreground shrink-0">
                  {ev.created_at
                    ? new Date(ev.created_at).toLocaleString()
                    : ""}
                </span>
              </div>
            ))}
            {data.recent_security_events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recent security-tagged events.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick launch */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Control plane surfaces</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/platform/security", icon: Shield, title: "Security", desc: "MFA · alerts · privileged access" },
            { href: "/platform/monitoring", icon: LineChart, title: "Monitoring", desc: "Jobs · errors · performance" },
            { href: "/platform/ai", icon: Brain, title: "AI config", desc: "Gateway · governance · flags" },
            { href: "/platform/compliance", icon: Activity, title: "Compliance", desc: "Audit · dual control · holds" },
            { href: "/platform/companies", icon: Layers, title: "Companies", desc: "Legal entities estate-wide" },
            { href: "/platform/users", icon: Users, title: "Users", desc: "Cross-tenant identity" },
            { href: "/platform/subscriptions", icon: CreditCard, title: "Subscriptions", desc: "Plans · licenses · trials" },
            { href: "/platform/integrations", icon: Server, title: "Integrations", desc: "Providers · webhooks · keys" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/30 transition"
            >
              <item.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium group-hover:text-primary">
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[10px] text-muted-foreground">
        Snapshot {new Date(data.generated_at).toLocaleString()} · Control plane
        never mixes with tenant ERP UI sessions
      </p>
    </div>
  );
}

function HealthPill({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
        {label}
      </span>
      {detail ? (
        <span className="text-muted-foreground font-mono">{detail}</span>
      ) : (
        <span className="text-muted-foreground">{ok ? "ok" : "off"}</span>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold ${
          tone === "danger" && value > 0 ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
