"use client";

import { useMemo, useState } from "react";
import { Play, Lock, Unlock, FileText, Building2, Banknote } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useEntityList } from "@/hooks/use-entity-query";
import { entityKeys } from "@/lib/api/query-keys";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { lockPayrollRun, unlockPayrollRun, publishPayslips } from "@/lib/payroll";
import { apiPost, promptDualControlId } from "@/lib/api-client";

export default function PayrollRunsPage() {
  const { auth } = useUser();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const companyId = auth?.profile?.company_id as string | undefined;

  // Runs flow through the hardened CRUD API (permission-checked, server-scoped).
  const runsQuery = useEntityList<Record<string, unknown>>("payroll_runs", {
    pageSize: 50,
    sort: "created_at",
    order: "desc",
  });
  const runs = useMemo(() => runsQuery.data?.data ?? [], [runsQuery.data]);
  // Active run: the user's explicit selection, or the most recent run once the
  // list loads (derived, so no state-sync effect is needed).
  const activeRunId = selected ?? (runs.length > 0 ? String(runs[0].id) : null);

  // Payroll lines load reactively for the selected run (join embedded server-side).
  const linesQuery = useEntityList<Record<string, unknown>>(
    "payroll_lines",
    {
      filters: activeRunId ? { payroll_run_id: activeRunId } : {},
      select: "*, employees(first_name,last_name,employee_number,department)",
    },
    { enabled: !!activeRunId }
  );
  const lines = useMemo(() => linesQuery.data?.data ?? [], [linesQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: entityKeys.entity("payroll_runs") });
    queryClient.invalidateQueries({ queryKey: entityKeys.entity("payroll_lines") });
  };

  /** Server API - preferred production path */
  const process = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await apiPost<{
        run?: {
          run_number?: string;
          employee_count?: number;
          net_total?: number;
        };
        queued?: boolean;
        job_id?: string;
      }>("/api/payroll/process", {});
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.queued) {
        toast.success(`Payroll queued (job ${res.data.job_id || "…"})`);
      } else {
        const run = res.data.run;
        toast.success(
          `Payroll processed: ${run?.run_number || "run"} · ${run?.employee_count ?? 0} employees`
        );
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Process failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!companyId || !activeRunId) return;
    setBusy(true);
    try {
      const r = await publishPayslips({
        company_id: companyId,
        payroll_run_id: activeRunId,
      });
      toast.success(`Published ${r.count} payslips`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const bankFile = async (dualControlId?: string | null) => {
    if (!activeRunId) return;
    setBusy(true);
    try {
      const res = await apiPost<{
        batch?: {
          batch_number?: string;
          file_format?: string;
        };
        file_content?: string;
        csv_preview?: string;
      }>("/api/payroll/bank-file", {
        payroll_run_id: activeRunId,
        dual_control_id: dualControlId || undefined,
      });

      if (!res.ok) {
        if (res.status === 403 && (res.code === "FORBIDDEN" || /dual-control/i.test(res.error))) {
          const id = promptDualControlId(
            "Bank file requires dual-control. Paste approved request UUID:"
          );
          if (id) {
            setBusy(false);
            return bankFile(id);
          }
        }
        toast.error(res.error);
        return;
      }

      const batchNo = res.data.batch?.batch_number || "bank-file";
      const csv = res.data.file_content || res.data.csv_preview;
      if (csv) {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${batchNo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Bank batch ${batchNo} generated (server)`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const releasePay = async (dualControlId?: string | null) => {
    if (!activeRunId) return;
    const active = runs.find((r) => String(r.id) === activeRunId);
    const net = Number(active?.net_total || 0);
    if (!confirm("Release payroll payment for this run? This marks the run paid.")) return;
    setBusy(true);
    try {
      const res = await apiPost("/api/payroll/release", {
        payroll_run_id: activeRunId,
        dual_control_id: dualControlId || undefined,
        post_gl: true,
        net_total: net > 0 ? net : undefined,
      });
      if (!res.ok) {
        if (res.status === 403 && /dual-control/i.test(res.error)) {
          const id = promptDualControlId(
            "Payroll release requires dual-control. Paste approved request UUID:"
          );
          if (id) {
            setBusy(false);
            return releasePay(id);
          }
        }
        toast.error(res.error);
        return;
      }
      toast.success("Payroll released (server)");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Release failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleLock = async (run: Record<string, unknown>) => {
    if (!auth?.user?.id) return;
    try {
      if (run.locked_at || run.status === "locked") {
        await unlockPayrollRun(String(run.id));
        toast.success("Payroll unlocked");
      } else {
        await lockPayrollRun(String(run.id), auth.user.id);
        toast.success("Payroll locked");
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lock failed");
    }
  };

  if (runsQuery.isPending) return <LoadingState message="Loading payroll runs…" />;

  const active = runs.find((r) => String(r.id) === activeRunId) || runs[0];

  return (
    <div>
      <PageHeader
        title="Payroll Runs"
        description="Server-side process · bank file · release · dual-control gated"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={process} disabled={busy} aria-label="Run payroll on server">
              <Play className="h-4 w-4 mr-1" /> {busy ? "Working…" : "Run payroll"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={publish}
              disabled={!activeRunId || busy}
              aria-label="Publish payslips"
            >
              <FileText className="h-4 w-4 mr-1" /> Publish payslips
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bankFile()}
              disabled={!activeRunId || busy}
              aria-label="Generate bank file"
            >
              <Building2 className="h-4 w-4 mr-1" /> Bank file
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => releasePay()}
              disabled={!activeRunId || busy}
              aria-label="Release payroll payment"
            >
              <Banknote className="h-4 w-4 mr-1" /> Release pay
            </Button>
          </div>
        }
      />

      {active && (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <StatCard title="Employees" value={String(active.employee_count || 0)} />
          <StatCard title="Gross" value={formatNumber(Number(active.gross_total || 0))} />
          <StatCard title="Deductions" value={formatNumber(Number(active.deductions_total || 0))} />
          <StatCard title="Net" value={formatNumber(Number(active.net_total || 0))} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border lg:col-span-1 max-h-[520px] overflow-y-auto">
          {runs.length === 0 ? (
            <EmptyState
              icon={Play}
              title="No runs"
              description="Click Run payroll to calculate this period via the server API."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow
                    key={String(r.id)}
                    className={activeRunId === String(r.id) ? "bg-muted/50" : "cursor-pointer"}
                    onClick={() => setSelected(String(r.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(String(r.id));
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={activeRunId === String(r.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{String(r.period_label)}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {String(r.run_number)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.created_at ? formatDate(String(r.created_at)) : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status || "draft")} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={
                          r.locked_at || r.status === "locked"
                            ? "Unlock payroll run"
                            : "Lock payroll run"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleLock(r);
                        }}
                      >
                        {r.locked_at || r.status === "locked" ? (
                          <Unlock className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-md border lg:col-span-2 max-h-[520px] overflow-y-auto">
          {!activeRunId || lines.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Select a run to view lines
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NSSF</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => {
                  const emp = l.employees as {
                    first_name?: string;
                    last_name?: string;
                    employee_number?: string;
                  } | null;
                  return (
                    <TableRow key={String(l.id)}>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {emp
                            ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
                            : "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {emp?.employee_number}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(Number(l.gross_pay))}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(Number(l.paye))}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatNumber(Number(l.nssf_employee))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatNumber(Number(l.net_pay))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
