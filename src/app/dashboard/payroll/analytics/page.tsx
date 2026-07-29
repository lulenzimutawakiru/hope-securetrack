"use client";

import { useEffect, useState } from "react";
import { BarChart3, Wallet, Users, Receipt, Landmark, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function PayAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    runs: 0,
    profiles: 0,
    ytdGross: 0,
    ytdNet: 0,
    ytdPaye: 0,
    ytdNssf: 0,
    activeLoans: 0,
    loanOutstanding: 0,
    pendingOt: 0,
  });
  const [byDept, setByDept] = useState<Array<{ dept: string; net: number; count: number }>>([]);
  const [recentRuns, setRecentRuns] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        runs, profiles, loans, ot,
        { data: runRows }, { data: lineRows }, { data: loanRows },
      ] = await Promise.all([
        sb.from("payroll_runs").select("*", { count: "exact", head: true }),
        sb.from("pay_employee_profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("pay_loans").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("pay_overtime_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("payroll_runs").select("gross_total,net_total,period_label,run_number,employee_count,created_at").order("created_at", { ascending: false }).limit(6),
        sb.from("payroll_lines").select("net_pay,paye,nssf_employee,gross_pay,employees(department)").limit(2000),
        sb.from("pay_loans").select("outstanding").eq("status", "active"),
      ]);

      const ytdGross = (runRows || []).reduce((s, r) => s + Number(r.gross_total || 0), 0);
      const ytdNet = (runRows || []).reduce((s, r) => s + Number(r.net_total || 0), 0);
      const ytdPaye = (lineRows || []).reduce((s, l) => s + Number(l.paye || 0), 0);
      const ytdNssf = (lineRows || []).reduce((s, l) => s + Number(l.nssf_employee || 0), 0);
      const loanOutstanding = (loanRows || []).reduce((s, l) => s + Number(l.outstanding || 0), 0);

      const deptMap = new Map<string, { net: number; count: number }>();
      for (const l of lineRows || []) {
        const emp = l.employees as { department?: string } | null;
        const d = emp?.department || "Unassigned";
        const cur = deptMap.get(d) || { net: 0, count: 0 };
        cur.net += Number(l.net_pay || 0);
        cur.count += 1;
        deptMap.set(d, cur);
      }

      setStats({
        runs: runs.count ?? 0,
        profiles: profiles.count ?? 0,
        ytdGross,
        ytdNet,
        ytdPaye,
        ytdNssf,
        activeLoans: loans.count ?? 0,
        loanOutstanding,
        pendingOt: ot.count ?? 0,
      });
      setByDept(
        Array.from(deptMap.entries())
          .map(([dept, v]) => ({ dept, ...v }))
          .sort((a, b) => b.net - a.net)
          .slice(0, 10)
      );
      setRecentRuns((runRows as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading payroll analytics…" />;

  return (
    <div>
      <PageHeader
        title="Payroll Analytics"
        description="Labour cost · tax · NSSF · department · loans · trends"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Runs" value={String(stats.runs)} icon={Wallet} />
        <StatCard title="Pay profiles" value={String(stats.profiles)} icon={Users} />
        <StatCard title="Gross (recent)" value={formatNumber(stats.ytdGross)} icon={BarChart3} />
        <StatCard title="Net (recent)" value={formatNumber(stats.ytdNet)} icon={Receipt} />
        <StatCard title="PAYE (lines)" value={formatNumber(stats.ytdPaye)} icon={Receipt} />
        <StatCard title="NSSF EE (lines)" value={formatNumber(stats.ytdNssf)} icon={Receipt} />
        <StatCard title="Active loans" value={String(stats.activeLoans)} icon={Landmark} />
        <StatCard title="OT pending" value={String(stats.pendingOt)} icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department net cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byDept.length === 0 ? (
              <p className="text-sm text-muted-foreground">Process payroll to populate department costs.</p>
            ) : (
              byDept.map((d) => (
                <div key={d.dept} className="flex justify-between text-sm border-b pb-1">
                  <span>{d.dept} <span className="text-muted-foreground">({d.count})</span></span>
                  <span className="font-medium">{formatNumber(d.net)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRuns.map((r) => (
              <div key={String(r.run_number)} className="flex justify-between text-sm border-b pb-1">
                <span>
                  {String(r.period_label)}
                  <span className="text-muted-foreground text-xs ml-1">{String(r.employee_count)} ee</span>
                </span>
                <span className="font-medium">{formatNumber(Number(r.net_total || 0))}</span>
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              Loan outstanding book: {formatNumber(stats.loanOutstanding)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
