"use client";

import { useEffect, useState } from "react";
import { GitBranch, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { APPROVAL_STAGES, advancePayrollApproval } from "@/lib/payroll";

export default function PayApprovalsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pay_approvals")
      .select("*, payroll_runs(run_number,period_label,net_total,status,employee_count)")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const decide = async (id: string, approve: boolean) => {
    if (!companyId || !auth?.user?.id) return;
    try {
      await advancePayrollApproval({
        approval_id: id,
        company_id: companyId,
        approve,
        reviewer_id: auth.user.id,
        comments: approve ? "Approved" : "Rejected",
      });
      toast.success(approve ? "Stage approved" : "Rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading payroll approvals…" />;

  const stageLabel = (s: string) =>
    APPROVAL_STAGES.find((x) => x.value === s)?.label || s;

  return (
    <div>
      <PageHeader
        title="Payroll Approvals"
        description="Payroll Officer → HR Manager → Finance Manager → Director → Payment Release"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {APPROVAL_STAGES.map((s, i) => (
          <Badge key={s.value} variant="outline" className="text-[10px]">
            {i + 1}. {s.label}
          </Badge>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={GitBranch} title="No approvals" description="Process a payroll run to open the approval chain." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const run = r.payroll_runs as {
                  run_number?: string;
                  period_label?: string;
                  net_total?: number;
                  employee_count?: number;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <div className="font-medium text-sm">{run?.period_label || "—"}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{run?.run_number}</div>
                      <div className="text-[10px] text-muted-foreground">{run?.employee_count ?? 0} employees</div>
                    </TableCell>
                    <TableCell className="text-sm">{stageLabel(String(r.stage))}</TableCell>
                    <TableCell className="text-right text-sm">{formatNumber(Number(run?.net_total || 0))}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_at ? formatDate(String(r.created_at)) : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => decide(String(r.id), true)}>
                            <Check className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => decide(String(r.id), false)}>
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
