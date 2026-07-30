"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, Users, Layers, Activity, Flag, HeartPulse, Sparkles,
  ArrowRight, Server, CreditCard, Workflow, Shield,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getPlatformStats,
  listDomainEvents,
  listHealthChecks,
  listProvisioningJobs,
  type DomainEvent,
  type PlatformStats,
  type ProvisioningJob,
} from "@/lib/platform";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const NAV = [
  { title: "Tenants", href: "/dashboard/tenants", icon: Building2, desc: "Tenant directory & companies" },
  { title: "Provisioning", href: "/dashboard/platform/provisioning", icon: Workflow, desc: "Auto-provision jobs" },
  { title: "Events", href: "/dashboard/platform/events", icon: Activity, desc: "Domain event stream" },
  { title: "Feature flags", href: "/dashboard/platform/flags", icon: Flag, desc: "Module & AI toggles" },
  { title: "Modules", href: "/dashboard/platform/modules", icon: Layers, desc: "Module catalog" },
  { title: "Health", href: "/dashboard/platform/health", icon: HeartPulse, desc: "Platform health checks" },
  { title: "Subscriptions", href: "/dashboard/platform/subscriptions", icon: CreditCard, desc: "Plans & billing" },
  { title: "Security", href: "/dashboard/identity", icon: Shield, desc: "IAM & sessions" },
];

export default function PlatformAdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const [jobs, setJobs] = useState<ProvisioningJob[]>([]);
  const [health, setHealth] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [s, e, j, h] = await Promise.all([
          getPlatformStats().catch(() => null),
          listDomainEvents({ limit: 8 }).catch(() => []),
          listProvisioningJobs(5).catch(() => []),
          listHealthChecks().catch(() => []),
        ]);
        setStats(s);
        setEvents(e);
        setJobs(j);
        setHealth(h as Array<Record<string, unknown>>);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading Platform Administration…" />;

  return (
    <div>
      <PageHeader
        title="Platform Administration"
        description={`${APP_NAME} · ${APP_TAGLINE} · multi-tenant control plane`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/register">Public register</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/platform/provisioning">
                <Sparkles className="h-4 w-4 mr-1" /> Provision tenant
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6">
        <div className="flex items-start gap-3">
          <Server className="h-8 w-8 text-hope-gold shrink-0" />
          <div>
            <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
              Enterprise operating system
            </p>
            <p className="text-sm text-white/80 mt-1">
              Tenant → Company → Branch → Department → User → Role → Permissions → Subscription →
              Language → Currency → Timezone → Feature Access
            </p>
            <p className="text-xs text-white/50 mt-2">
              SaaS · Single-tenant · Private cloud · Hybrid · On-premise · Government · Air-gapped ready
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Tenants" value={String(stats?.tenants ?? 0)} icon={Building2} />
        <StatCard title="Companies" value={String(stats?.companies ?? 0)} icon={Layers} />
        <StatCard title="Users" value={String(stats?.users ?? 0)} icon={Users} />
        <StatCard title="Active subs" value={String(stats?.activeSubscriptions ?? 0)} icon={CreditCard} />
        <StatCard title="Events (24h)" value={String(stats?.events24h ?? 0)} icon={Activity} />
        <StatCard title="Open provision jobs" value={String(stats?.openProvisionJobs ?? 0)} icon={Workflow} />
        <StatCard
          title="Health"
          value={`${stats?.healthyChecks ?? 0}/${stats?.totalChecks ?? 0}`}
          icon={HeartPulse}
        />
        <StatCard title="Platform" value="Live" icon={Server} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {NAV.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent domain events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet. Module actions will stream here.</p>
            )}
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{ev.event_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.source_module || "system"} · {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{ev.severity || "info"}</Badge>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/dashboard/platform/events">View event stream</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Provisioning & health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Latest jobs</p>
              {jobs.length === 0 && (
                <p className="text-sm text-muted-foreground">No provisioning jobs.</p>
              )}
              {jobs.map((j) => (
                <div key={j.id} className="flex justify-between text-sm border-b py-1.5 last:border-0">
                  <span className="truncate">{j.organization_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{j.status}</Badge>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Health checks</p>
              <div className="flex flex-wrap gap-1.5">
                {health.slice(0, 8).map((h, i) => (
                  <Badge
                    key={i}
                    variant={h.status === "healthy" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {String(h.check_key)} · {String(h.status)}
                  </Badge>
                ))}
                {health.length === 0 && (
                  <span className="text-xs text-muted-foreground">Run migration 00065 for health seeds.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
