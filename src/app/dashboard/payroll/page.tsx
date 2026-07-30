"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, Users, Play, Calculator, Receipt, Clock, Landmark, Heart,
  GitBranch, Building2, FileText, BarChart3, Wand2, Calendar,
  FlaskConical, ArrowRight, Brain, Smartphone, Factory, Settings2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  PAY_MENU,
  PAYROLL_LIFECYCLE,
  getPayrollDashboardStats,
  generatePayrollInsights,
  type PayrollDashboardStats,
} from "@/lib/payroll";
import { formatNumber } from "@/lib/utils";

const QUICK = [
  { title: "Process payroll", href: "/dashboard/payroll/runs", icon: Play, desc: "Calculate · lock · release" },
  { title: "Workspace", href: "/dashboard/payroll/workspace", icon: Wallet, desc: "Inbox · queue · exceptions" },
  { title: "Simulations", href: "/dashboard/payroll/simulations", icon: FlaskConical, desc: "What-if before live" },
  { title: "Periods", href: "/dashboard/payroll/periods", icon: Calendar, desc: "Open · close · lock" },
  { title: "Profiles", href: "/dashboard/payroll/profiles", icon: Users, desc: "Compensation master" },
  { title: "Formulas", href: "/dashboard/payroll/formulas", icon: Calculator, desc: "No-code pay rules" },
  { title: "Tax & NSSF", href: "/dashboard/payroll/tax", icon: Receipt, desc: "PAYE · statutory" },
  { title: "Bank files", href: "/dashboard/payroll/bank-files", icon: Building2, desc: "Payment file gen" },
  { title: "Mobile money", href: "/dashboard/payroll/mobile-money", icon: Smartphone, desc: "MTN · Airtel" },
  { title: "Costing", href: "/dashboard/payroll/cost-allocations", icon: Factory, desc: "Labour cost allocation" },
  { title: "Payslips", href: "/dashboard/payroll/payslips", icon: FileText, desc: "PDF · QR · publish" },
  { title: "AI Assistant", href: "/dashboard/payroll/ai", icon: Brain, desc: "Anomalies · forecast" },
];

export default function PayrollHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<PayrollDashboardStats | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      try {
        const s = await getPayrollDashboardStats(companyId);
        setStats(s);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const insights = useMemo(() => {
    if (!stats) return [];
    return generatePayrollInsights({
      employeeCount: stats.employeeCount || stats.profiles,
      grossTotal: stats.latestGross,
      netTotal: stats.latestNet,
      pendingApprovals: stats.pendingApprovals,
      openLoans: stats.activeLoans,
      pendingOt: stats.pendingOt,
    });
  }, [stats]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PAY_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof PAY_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Enterprise Payroll…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Payroll & Compensation"
        description="Processing · tax · benefits · loans · costing · bank · mobile money · GL · multi-company"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/payroll/workspace">Workspace</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/payroll/ai">
                <Wand2 className="h-4 w-4 mr-1" /> AI
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/payroll/runs">
                <Play className="h-4 w-4 mr-1" /> Process payroll
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PAYROLL_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">
            {s}
          </Badge>
        ))}
      </div>

      {stats?.latestRunLabel && (
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Latest run</p>
              <h2 className="text-xl font-semibold">{stats.latestRunLabel}</h2>
              <p className="text-sm text-muted-foreground">
                {stats.latestRunNumber} · {stats.latestRunStatus} · {stats.employeeCount} employees
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Net total</p>
              <p className="text-2xl font-bold text-primary">
                UGX {formatNumber(stats.latestNet)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Gross UGX {formatNumber(stats.latestGross)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Payroll runs" value={String(stats?.runs ?? 0)} icon={Wallet} />
        <StatCard title="Pay profiles" value={String(stats?.profiles ?? 0)} icon={Users} />
        <StatCard title="Pending approvals" value={String(stats?.pendingApprovals ?? 0)} icon={GitBranch} />
        <StatCard title="Active loans" value={String(stats?.activeLoans ?? 0)} icon={Landmark} />
        <StatCard title="OT pending" value={String(stats?.pendingOt ?? 0)} icon={Clock} />
        <StatCard title="Open periods" value={String(stats?.openPeriods ?? 0)} icon={Calendar} />
        <StatCard title="Published payslips" value={String(stats?.publishedPayslips ?? 0)} icon={FileText} />
        <StatCard title="MM pending" value={String(stats?.mobileMoneyPending ?? 0)} icon={Smartphone} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> AI risk alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">No critical alerts. Payroll health looks stable.</p>
            )}
            {insights.slice(0, 5).map((ins, i) => (
              <div key={i} className="rounded-md border p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      ins.severity === "high"
                        ? "destructive"
                        : ins.severity === "medium"
                          ? "default"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {ins.severity}
                  </Badge>
                  <span className="text-xs font-medium">{ins.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ins.detail}</p>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href="/dashboard/payroll/ai">Open AI assistant</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Input
          placeholder="Search payroll modules…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="outline" className="text-xs">
          {PAY_MENU.length} modules
        </Badge>
      </div>

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {group}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href + m.title}
                  href={m.href}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-muted/30 transition"
                >
                  <span>{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5" />
        <span>Ugandan PAYE · NSSF · LST · multi-currency · multi-company · RLS · maker-checker</span>
        <span>·</span>
        <Link href="/dashboard/hr" className="underline hover:text-foreground">HR</Link>
        <Link href="/dashboard/finance" className="underline hover:text-foreground">Finance</Link>
        <Link href="/dashboard/attendance" className="underline hover:text-foreground">Attendance</Link>
        <Link href="/dashboard/talent" className="underline hover:text-foreground">Talent</Link>
        <Heart className="h-3.5 w-3.5 ml-2" />
        <BarChart3 className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
