"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet, Users, Layers, Calculator, Receipt, Clock, Gift, Landmark,
  Heart, GitBranch, Building2, FileText, UserCircle, BarChart3, Wand2,
  ArrowRight, Play,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { PAYROLL_LIFECYCLE } from "@/lib/payroll";

const MODULES = [
  { title: "Payroll Runs", href: "/dashboard/payroll/runs", icon: Play, desc: "Process · calculate · lock" },
  { title: "Employee Profiles", href: "/dashboard/payroll/profiles", icon: Users, desc: "Bank · grade · pay group" },
  { title: "Salary Structures", href: "/dashboard/payroll/structures", icon: Layers, desc: "Grades · components" },
  { title: "Pay Components", href: "/dashboard/payroll/components", icon: Calculator, desc: "Earnings · deductions" },
  { title: "Tax & Statutory", href: "/dashboard/payroll/tax", icon: Receipt, desc: "PAYE · NSSF · multi-country" },
  { title: "Overtime", href: "/dashboard/payroll/overtime", icon: Clock, desc: "Claims · rates · approval" },
  { title: "Bonuses", href: "/dashboard/payroll/bonuses", icon: Gift, desc: "Incentives · commissions" },
  { title: "Loans & Advances", href: "/dashboard/payroll/loans", icon: Landmark, desc: "Repayment schedules" },
  { title: "Benefits", href: "/dashboard/payroll/benefits", icon: Heart, desc: "Medical · life · pension" },
  { title: "Approvals", href: "/dashboard/payroll/approvals", icon: GitBranch, desc: "HR · Finance · Director" },
  { title: "Bank Payments", href: "/dashboard/payroll/payments", icon: Building2, desc: "Batches · bank files" },
  { title: "Payslips", href: "/dashboard/payroll/payslips", icon: FileText, desc: "Digital · PDF · QR" },
  { title: "Self-Service", href: "/dashboard/payroll/self-service", icon: UserCircle, desc: "Employee ESS portal" },
  { title: "Analytics", href: "/dashboard/payroll/analytics", icon: BarChart3, desc: "Cost · trends · dept" },
  { title: "AI Assistant", href: "/dashboard/payroll/ai", icon: Wand2, desc: "Anomalies · forecast · FAQ" },
];

export default function PayrollHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    runs: 0,
    profiles: 0,
    pending: 0,
    loans: 0,
    ot: 0,
    net: 0,
    gross: 0,
    payslips: 0,
  });
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        runs, profiles, pending, loans, ot, payslips,
        { data: lastRun },
      ] = await Promise.all([
        sb.from("payroll_runs").select("*", { count: "exact", head: true }),
        sb.from("pay_employee_profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pay_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("pay_loans").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("pay_overtime_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("pay_payslips").select("*", { count: "exact", head: true }).eq("is_published", true),
        sb.from("payroll_runs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setStats({
        runs: runs.count ?? 0,
        profiles: profiles.count ?? 0,
        pending: pending.count ?? 0,
        loans: loans.count ?? 0,
        ot: ot.count ?? 0,
        payslips: payslips.count ?? 0,
        net: Number(lastRun?.net_total || 0),
        gross: Number(lastRun?.gross_total || 0),
      });
      setLatest((lastRun as Record<string, unknown>) || null);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading payroll platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Payroll"
        description="Processing · tax · benefits · loans · payslips · bank · GL · multi-country"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr/payroll">Legacy HR payroll</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/payroll/runs"><Play className="h-4 w-4 mr-1" /> Process payroll</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {PAYROLL_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      {latest && (
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Latest run</p>
              <h2 className="text-xl font-semibold">{String(latest.period_label)}</h2>
              <p className="text-sm text-muted-foreground">
                {String(latest.run_number)} · {String(latest.status)} · {String(latest.employee_count || 0)} employees
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Net total</p>
              <p className="text-2xl font-bold text-primary">
                UGX {formatNumber(Number(latest.net_total || 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Payroll runs" value={String(stats.runs)} icon={Wallet} />
        <StatCard title="Pay profiles" value={String(stats.profiles)} icon={Users} />
        <StatCard title="Pending approvals" value={String(stats.pending)} icon={GitBranch} />
        <StatCard title="Active loans" value={String(stats.loans)} icon={Landmark} />
        <StatCard title="OT pending" value={String(stats.ot)} icon={Clock} />
        <StatCard title="Published payslips" value={String(stats.payslips)} icon={FileText} />
        <StatCard title="Latest gross" value={formatNumber(stats.gross)} icon={Calculator} />
        <StatCard title="Latest net" value={formatNumber(stats.net)} icon={Receipt} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group flex items-center gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-muted/40 transition"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm group-hover:text-primary">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
          </Link>
        ))}
      </div>
    </div>
  );
}
