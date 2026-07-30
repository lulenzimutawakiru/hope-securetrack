"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox, AlertTriangle, Play, FlaskConical, GitBranch, RefreshCw,
  Lock, Unlock, RotateCcw, FileWarning, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

type QueueItem = {
  id: string;
  kind: string;
  title: string;
  status: string;
  href: string;
  meta?: string;
};

export default function PayrollWorkspacePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState({
    pendingApprovals: 0,
    pendingOt: 0,
    pendingCorrections: 0,
    openPeriods: 0,
    failedMm: 0,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const sb = createClient();
    try {
      const [
        { data: approvals },
        { data: ot },
        { data: corrections },
        { data: periods },
        { data: mm },
        { data: runs },
      ] = await Promise.all([
        sb.from("pay_approvals").select("id,stage,status,payroll_run_id,created_at").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
        sb.from("pay_overtime_claims").select("id,claim_number,hours,amount,status,work_date").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(8),
        sb.from("pay_corrections").select("id,correction_code,employee_name,amount,status,correction_type").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }).limit(8),
        sb.from("pay_periods").select("id,period_code,name,status,pay_date").eq("company_id", companyId).eq("status", "open").limit(5),
        sb.from("pay_mobile_money").select("id,txn_code,employee_name,amount,status").eq("company_id", companyId).in("status", ["pending", "failed"]).limit(8),
        sb.from("payroll_runs").select("id,run_number,period_label,status,net_total,employee_count").eq("company_id", companyId).in("status", ["draft", "processing", "pending_approval"]).order("created_at", { ascending: false }).limit(6),
      ]);

      const items: QueueItem[] = [];
      for (const r of runs || []) {
        items.push({
          id: String(r.id),
          kind: "run",
          title: `${r.run_number} · ${r.period_label}`,
          status: String(r.status),
          href: "/dashboard/payroll/runs",
          meta: `${r.employee_count || 0} emp · net ${formatNumber(Number(r.net_total || 0))}`,
        });
      }
      for (const a of approvals || []) {
        items.push({
          id: String(a.id),
          kind: "approval",
          title: `Approval · ${a.stage}`,
          status: String(a.status),
          href: "/dashboard/payroll/approvals",
        });
      }
      for (const o of ot || []) {
        items.push({
          id: String(o.id),
          kind: "overtime",
          title: `OT ${o.claim_number || o.id}`,
          status: String(o.status),
          href: "/dashboard/payroll/overtime",
          meta: `${o.hours}h · ${formatNumber(Number(o.amount || 0))}`,
        });
      }
      for (const c of corrections || []) {
        items.push({
          id: String(c.id),
          kind: "correction",
          title: `${c.correction_code} · ${c.employee_name || "—"}`,
          status: String(c.status),
          href: "/dashboard/payroll/corrections",
          meta: `${c.correction_type} · ${formatNumber(Number(c.amount || 0))}`,
        });
      }
      for (const m of mm || []) {
        items.push({
          id: String(m.id),
          kind: "mobile_money",
          title: `${m.txn_code} · ${m.employee_name || "—"}`,
          status: String(m.status),
          href: "/dashboard/payroll/mobile-money",
          meta: formatNumber(Number(m.amount || 0)),
        });
      }

      setQueue(items);
      setCounts({
        pendingApprovals: (approvals || []).length,
        pendingOt: (ot || []).length,
        pendingCorrections: (corrections || []).length,
        openPeriods: (periods || []).length,
        failedMm: (mm || []).filter((x) => x.status === "failed").length,
      });
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  if (loading) return <LoadingState message="Loading payroll workspace…" />;

  return (
    <div>
      <PageHeader
        title="Payroll Workspace"
        description="Operational control centre — inbox, queue, exceptions, simulation, release"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/payroll/simulations">
                <FlaskConical className="h-4 w-4 mr-1" /> Simulate
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/payroll/runs">
                <Play className="h-4 w-4 mr-1" /> Process
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {[
          { label: "Approvals", value: counts.pendingApprovals, href: "/dashboard/payroll/approvals", icon: GitBranch },
          { label: "OT claims", value: counts.pendingOt, href: "/dashboard/payroll/overtime", icon: AlertTriangle },
          { label: "Corrections", value: counts.pendingCorrections, href: "/dashboard/payroll/corrections", icon: RotateCcw },
          { label: "Open periods", value: counts.openPeriods, href: "/dashboard/payroll/periods", icon: Unlock },
          { label: "Failed MM", value: counts.failedMm, href: "/dashboard/payroll/mobile-money", icon: FileWarning },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="rounded-lg border p-3 hover:border-primary/40 transition">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Payroll queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Queue is clear. Start a payroll run or open a period.
              </p>
            )}
            {queue.map((item) => (
              <Link
                key={item.kind + item.id}
                href={item.href}
                className="flex items-center justify-between rounded-md border px-3 py-2.5 hover:bg-muted/40 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.kind.replace("_", " ")}
                    </Badge>
                    <span className="text-sm font-medium truncate">{item.title}</span>
                  </div>
                  {item.meta && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.meta}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wizard & controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { title: "1. Open / lock period", href: "/dashboard/payroll/periods", icon: Lock },
              { title: "2. Sync attendance & leave", href: "/dashboard/attendance", icon: RefreshCw },
              { title: "3. Approve OT / loans / bonuses", href: "/dashboard/payroll/overtime", icon: GitBranch },
              { title: "4. Simulate payroll", href: "/dashboard/payroll/simulations", icon: FlaskConical },
              { title: "5. Process live run", href: "/dashboard/payroll/runs", icon: Play },
              { title: "6. Approvals chain", href: "/dashboard/payroll/approvals", icon: GitBranch },
              { title: "7. Bank / mobile money", href: "/dashboard/payroll/bank-files", icon: Unlock },
              { title: "8. Publish payslips", href: "/dashboard/payroll/payslips", icon: FileWarning },
            ].map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:border-primary/40 transition"
              >
                <s.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{s.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
