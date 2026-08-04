"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings,
  Building2,
  GitBranch,
  Hash,
  Blocks,
  GitPullRequest,
  Bell,
  Plug,
  Shield,
  Palette,
  Globe,
  Brain,
  DatabaseBackup,
  ScrollText,
  User,
  Users,
  KeyRound,
  ArrowRight,
  Activity,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

const PILLARS = [
  "Company",
  "Identity",
  "Workflows",
  "Integrations",
  "Security",
  "Audit",
];

const MODULES = [
  {
    title: "Enterprise Platform",
    href: "/dashboard/enterprise",
    icon: Building2,
    desc: "Multi-company · org chart · governance · risk · AI",
  },
  {
    title: "Company",
    href: "/dashboard/settings/company",
    icon: Building2,
    desc: "Legal entity · TIN · fiscal year · branding assets",
  },
  {
    title: "Branches",
    href: "/dashboard/settings/branches",
    icon: GitBranch,
    desc: "Offices · factories · warehouses · DCs",
  },
  {
    title: "Document Numbering",
    href: "/dashboard/settings/numbering",
    icon: Hash,
    desc: "PO · INV · GRN · sequences & formats",
  },
  {
    title: "ERP Modules",
    href: "/dashboard/settings/modules",
    icon: Blocks,
    desc: "Enable · license · feature flags",
  },
  {
    title: "Approval Workflows",
    href: "/dashboard/settings/workflows",
    icon: GitPullRequest,
    desc: "Sequential · parallel · amount rules",
  },
  {
    title: "Notifications",
    href: "/dashboard/settings/notifications",
    icon: Bell,
    desc: "Templates · Resend send · triggers",
  },
  {
    title: "Email (Resend)",
    href: "/dashboard/settings/email",
    icon: Mail,
    desc: "Resend status · test · outbox",
  },
  {
    title: "Integrations & API",
    href: "/dashboard/settings/integrations",
    icon: Plug,
    desc: "Resend · MoMo · printers · OAuth",
  },
  {
    title: "Security Center",
    href: "/dashboard/settings/security",
    icon: Shield,
    desc: "Password · MFA · session · IP policy",
  },
  {
    title: "Branding",
    href: "/dashboard/settings/branding",
    icon: Palette,
    desc: "Colours · logos · theme · dark mode",
  },
  {
    title: "Localization",
    href: "/dashboard/settings/localization",
    icon: Globe,
    desc: "Language · timezone · currency · dates",
  },
  {
    title: "AI Configuration",
    href: "/dashboard/settings/ai",
    icon: Brain,
    desc: "Models · confidence · feature toggles",
  },
  {
    title: "Backup & DR",
    href: "/dashboard/settings/backup",
    icon: DatabaseBackup,
    desc: "Frequency · retention · restore points",
  },
  {
    title: "Config Audit",
    href: "/dashboard/settings/audit",
    icon: ScrollText,
    desc: "Immutable change log · rollback trail",
  },
  {
    title: "My Profile",
    href: "/dashboard/settings/profile",
    icon: User,
    desc: "Name · phone · personal preferences",
  },
  {
    title: "Users & Roles",
    href: "/dashboard/identity",
    icon: Users,
    desc: "IAM directory · RBAC · sessions",
  },
  {
    title: "Permissions",
    href: "/dashboard/identity/permissions",
    icon: KeyRound,
    desc: "Permission matrix · SoD",
  },
];

export default function SettingsHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    branches: 0,
    sequences: 0,
    modulesOn: 0,
    workflows: 0,
    integrations: 0,
    changes: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const dayAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [
        br,
        seq,
        mod,
        wf,
        intg,
        chg,
        { data: rows },
      ] = await Promise.all([
        supabase
          .from("branches")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("document_sequences")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("erp_modules")
          .select("*", { count: "exact", head: true })
          .eq("is_enabled", true),
        supabase
          .from("approval_workflows")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("integration_configs")
          .select("*", { count: "exact", head: true })
          .eq("is_enabled", true),
        supabase
          .from("config_change_log")
          .select("*", { count: "exact", head: true })
          .gte("created_at", dayAgo),
        supabase
          .from("config_change_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      setStats({
        branches: br.count ?? 0,
        sequences: seq.count ?? 0,
        modulesOn: mod.count ?? 0,
        workflows: wf.count ?? 0,
        integrations: intg.count ?? 0,
        changes: chg.count ?? 0,
      });
      setRecent(rows ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading configuration center…" />;

  return (
    <div>
      <PageHeader
        title="Settings & System Administration"
        description="SecureTrack ERP — No-code enterprise configuration · multi-company · multi-branch · auditable"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/settings/company">
              <Button size="sm">Company</Button>
            </Link>
            <Link href="/dashboard/settings/security">
              <Button size="sm" variant="outline">
                Security
              </Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
          <Settings className="h-3.5 w-3.5" />
          Configuration architecture
        </p>
        <p className="text-white/80 mt-2 flex flex-wrap items-center gap-2">
          {PILLARS.map((p, i) => (
            <span key={p} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 text-white/40" />}
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{p}</span>
            </span>
          ))}
        </p>
        <p className="text-white/50 text-xs mt-2">
          All changes are version-aware via config audit log. Users, roles, and
          sessions live under Identity; financial tax codes under Finance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard title="Branches" value={formatNumber(stats.branches)} icon={GitBranch} />
        <StatCard title="Sequences" value={formatNumber(stats.sequences)} icon={Hash} />
        <StatCard title="Modules on" value={formatNumber(stats.modulesOn)} icon={Blocks} />
        <StatCard title="Workflows" value={formatNumber(stats.workflows)} icon={GitPullRequest} />
        <StatCard title="Integrations" value={formatNumber(stats.integrations)} icon={Plug} />
        <StatCard title="Changes (7d)" value={formatNumber(stats.changes)} icon={Activity} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href + m.title} href={m.href}>
            <Card className="h-full hover:border-hope-teal transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <m.icon className="h-4 w-4 text-hope-teal" />
                  {m.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent configuration changes</CardTitle>
          <Link href="/dashboard/settings/audit">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No configuration changes logged yet. Edits from this center will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={String(r.id)}
                  className="flex flex-wrap items-center gap-2 text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {String(r.entity_type)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {String(r.action)}
                  </Badge>
                  {r.field_name ? (
                    <span className="text-muted-foreground text-xs">
                      {String(r.field_name)}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {r.created_at
                      ? new Date(String(r.created_at)).toLocaleString()
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
