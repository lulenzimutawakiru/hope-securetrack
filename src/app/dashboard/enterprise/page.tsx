"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2, GitBranch, Factory, Network, Users, FileText,
  Calendar, Scale, ShieldAlert, Sparkles, ArrowRight, Landmark,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getEnterpriseStats, ENTERPRISE_MODULES } from "@/lib/enterprise-company";

const ICONS = [Building2, GitBranch, Network, Landmark, Users, FileText, Calendar, Scale, ShieldAlert, Sparkles];

export default function EnterpriseHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    companies: 0, branches: 0, factories: 0, departments: 0,
    warehouses: 0, businessUnits: 0, documents: 0, openRisks: 0,
    insurancePolicies: 0, openInsights: 0, boardMembers: 0,
  });

  useEffect(() => {
    if (!auth?.profile?.company_id) {
      setLoading(false);
      return;
    }
    getEnterpriseStats(auth.profile.company_id)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading enterprise structure…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Company Management"
        description="SecureTrack ERP · multi-tenant · multi-company · multi-branch · multi-factory · governance"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/enterprise/org-chart">Org chart</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/enterprise/companies">
                <Building2 className="h-4 w-4 mr-1" /> Companies
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">Multi-tenant hierarchy</p>
        <p className="text-white/70 text-xs mt-1">
          Tenant → Company → Branch / Factory / Warehouse / Department / Business Unit · switch companies from the header · every ERP module is company-scoped
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Companies" value={String(stats.companies)} icon={Building2} />
        <StatCard title="Branches" value={String(stats.branches)} icon={GitBranch} />
        <StatCard title="Factories" value={String(stats.factories)} icon={Factory} />
        <StatCard title="Departments" value={String(stats.departments)} icon={Users} />
        <StatCard title="Warehouses" value={String(stats.warehouses)} icon={Network} />
        <StatCard title="Business units" value={String(stats.businessUnits)} icon={Landmark} />
        <StatCard title="Open risks" value={String(stats.openRisks)} icon={ShieldAlert} />
        <StatCard title="AI insights" value={String(stats.openInsights)} icon={Sparkles} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENTERPRISE_MODULES.map((m, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Link key={m.href} href={m.href}>
              <Card className="h-full hover:border-hope-navy/40 transition-colors">
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-hope-navy" />
                    <CardTitle className="text-sm">{m.title}</CardTitle>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-1.5">
        {["Multi-company", "RLS isolation", "Org chart", "Governance", "Risk", "Insurance", "Branding", "AI"].map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
        ))}
      </div>
    </div>
  );
}
