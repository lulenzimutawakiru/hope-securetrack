"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Layers,
  Activity,
  CreditCard,
  Workflow,
  Server,
  Sparkles,
  ArrowRight,
  PauseCircle,
  PlayCircle,
  Timer,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

type Overview = {
  tenants: number;
  tenants_active: number;
  tenants_trial: number;
  tenants_suspended: number;
  companies: number;
  users: number;
  active_subscriptions: number;
  open_provision_jobs: number;
  events_24h: number;
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan_code?: string | null;
  company_count?: number;
  user_count?: number;
  created_at?: string | null;
};

const QUICK = [
  {
    title: "All tenants",
    href: "/platform/tenants",
    icon: Building2,
    desc: "Directory · suspend · plan · modules",
  },
  {
    title: "Provision tenant",
    href: "/platform/provisioning",
    icon: Sparkles,
    desc: "Create org · company · admin · wizard",
  },
  {
    title: "Subscriptions",
    href: "/platform/subscriptions",
    icon: CreditCard,
    desc: "Plans · seats · billing status",
  },
  {
    title: "Feature flags",
    href: "/platform/flags",
    icon: Layers,
    desc: "Global defaults · per-tenant overrides",
  },
  {
    title: "Event stream",
    href: "/platform/events",
    icon: Activity,
    desc: "Domain events · audit feed",
  },
  {
    title: "Background jobs",
    href: "/platform/jobs",
    icon: Server,
    desc: "Queue · workers · retries",
  },
];

export default function PlatformCpanelHome() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [recent, setRecent] = useState<TenantRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [ov, list] = await Promise.all([
          fetch("/api/platform/tenants?overview=1").then((r) => r.json()),
          fetch("/api/platform/tenants?limit=8").then((r) => r.json()),
        ]);
        if (ov?.ok !== false) setOverview(ov.data ?? ov);
        const tenants = list?.data?.tenants ?? list?.tenants ?? [];
        setRecent(Array.isArray(tenants) ? tenants : []);
      } catch {
        setOverview(null);
        setRecent([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <LoadingState message="Loading platform cPanel…" />;
  }

  return (
    <div>
      <PageHeader
        title="Platform control panel"
        description={`${APP_NAME} · ${APP_TAGLINE} · manage every tenant like a hosting cPanel`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/register">Public register</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/platform/provisioning">
                <Sparkles className="h-4 w-4 mr-1" /> New tenant
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6">
        <div className="flex items-start gap-3">
          <Server className="h-8 w-8 text-hope-gold shrink-0" />
          <div>
            <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">
              Multi-tenant operating system
            </p>
            <p className="text-sm text-white/85 mt-1">
              This plane governs the whole ERP estate: tenants, companies,
              subscriptions, modules, flags, jobs, and lifecycle — without
              leaking into tenant-user sessions.
            </p>
            <p className="text-xs text-white/50 mt-2">
              Hierarchy: Tenant → Company → Branch → User → Role → Permissions →
              Subscription → Feature access
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Tenants"
          value={String(overview?.tenants ?? 0)}
          icon={Building2}
        />
        <StatCard
          title="Active"
          value={String(overview?.tenants_active ?? 0)}
          icon={PlayCircle}
        />
        <StatCard
          title="Trial"
          value={String(overview?.tenants_trial ?? 0)}
          icon={Timer}
        />
        <StatCard
          title="Suspended"
          value={String(overview?.tenants_suspended ?? 0)}
          icon={PauseCircle}
        />
        <StatCard
          title="Companies"
          value={String(overview?.companies ?? 0)}
          icon={Layers}
        />
        <StatCard
          title="Users"
          value={String(overview?.users ?? 0)}
          icon={Users}
        />
        <StatCard
          title="Active subs"
          value={String(overview?.active_subscriptions ?? 0)}
          icon={CreditCard}
        />
        <StatCard
          title="Open jobs"
          value={String(overview?.open_provision_jobs ?? 0)}
          icon={Workflow}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {QUICK.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">
                {m.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent tenants</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/tenants">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tenants yet. Provision the first organization.
            </p>
          )}
          {recent.map((t) => (
            <Link
              key={t.id}
              href={`/platform/tenants/${t.id}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {t.slug} · {t.plan_code || "—"} · {t.company_count ?? 0} cos ·{" "}
                  {t.user_count ?? 0} users
                </p>
              </div>
              <Badge
                variant={
                  t.status === "active"
                    ? "secondary"
                    : t.status === "suspended"
                      ? "destructive"
                      : "outline"
                }
                className="text-[10px] capitalize shrink-0"
              >
                {t.status}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
