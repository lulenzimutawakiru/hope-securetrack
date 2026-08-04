"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function PayrollPage() {
  const { auth } = useUser();
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("payroll_runs")
      .select("*")
      .order("period_start", { ascending: false });
    setRuns(data ?? []);
    if (data?.[0]) loadLines(String(data[0].id));
    setLoading(false);
  };

  const loadLines = async (runId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("payroll_lines")
      .select("*, employees(first_name,last_name,employee_number)")
      .eq("payroll_run_id", runId)
      .order("created_at");
    setLines(data ?? []);
    setSelected(runId);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPayroll = async () => {
    if (!auth) return;
    setRunning(true);
    const supabase = createClient();
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const label = now.toLocaleString("en-UG", { month: "long", year: "numeric" });
    const num = `PAY-${y}-${String(m + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`;

    const { data: employees } = await supabase
      .from("employees")
      .select("*")
      .eq("status", "active");

    const crudRes4 = await crudCreate("payroll_runs", {
        company_id: auth.profile.company_id,
        run_number: num,
        period_label: label,
        period_start: start,
        period_end: end,
        pay_date: end,
        status: "draft",
        created_by: auth.profile.id,
      });
    if (!crudRes4.ok) {
      toast.error(crudRes4.error ?? "Failed");
      setRunning(false);
      return;
    }
    const run = crudRes4.data as Record<string, unknown>;

    let grossT = 0;
    let dedT = 0;
    let netT = 0;
    let cnt = 0;

    for (const emp of employees ?? []) {
      const gross = Number(emp.salary || 0);
      if (!gross) continue;
      const nssf = Math.round(gross * 0.05);
      let paye = 0;
      if (gross > 410000) paye = Math.round(25000 + (gross - 410000) * 0.3);
      else if (gross > 335000) paye = Math.round(10000 + (gross - 335000) * 0.2);
      else if (gross > 235000) paye = Math.round((gross - 235000) * 0.1);
      const net = gross - nssf - paye;

      const crudRes3 = await crudCreate("payroll_lines", {
        payroll_run_id: run.id,
        company_id: auth.profile.company_id,
        employee_id: emp.id,
        basic_salary: gross,
        gross_pay: gross,
        paye,
        nssf_employee: nssf,
        nssf_employer: Math.round(gross * 0.1),
        net_pay: net,
      });

      grossT += gross;
      dedT += nssf + paye;
      netT += net;
      cnt++;
    }

    const crudRes2 = await crudUpdate("payroll_runs", String(run.id), {
        employee_count: cnt,
        gross_total: grossT,
        deductions_total: dedT,
        net_total: netT,
        status: "processing",
      });

    toast.success(`Payroll ${num}: ${cnt} employees`);
    setRunning(false);
    load();
    loadLines(String(run.id));
  };

  const approve = async (id: string) => {
    if (!auth) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("payroll_runs", id, {
        status: "approved",
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Payroll approved");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const activeRun = runs.find((r) => r.id === selected);

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Monthly runs · PAYE · NSSF · LST · payslip print · Uganda tax bands"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Button size="sm" onClick={runPayroll} disabled={running}>
              <Play className="h-4 w-4 mr-1" />
              {running ? "Running…" : "Run payroll"}
            </Button>
          </div>
        }
      />

      {activeRun && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <StatCard title="Employees" value={formatNumber(Number(activeRun.employee_count))} icon={Wallet} />
          <StatCard title="Gross" value={formatNumber(Math.round(Number(activeRun.gross_total)))} />
          <StatCard title="Deductions" value={formatNumber(Math.round(Number(activeRun.deductions_total)))} />
          <StatCard title="Net pay" value={formatNumber(Math.round(Number(activeRun.net_total)))} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border overflow-x-auto">
          {runs.length === 0 ? (
            <EmptyState icon={Wallet} title="No payroll runs" description="Run monthly payroll" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow
                    key={String(r.id)}
                    className="cursor-pointer"
                    onClick={() => loadLines(String(r.id))}
                  >
                    <TableCell className="font-mono text-sm">
                      {String(r.run_number)}
                    </TableCell>
                    <TableCell className="text-sm">{String(r.period_label)}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell>
                      {["draft", "processing"].includes(String(r.status)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            approve(String(r.id));
                          }}
                        >
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">NSSF</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    Select a payroll run
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((l) => {
                  const emp = l.employees as {
                    first_name?: string;
                    last_name?: string;
                    employee_number?: string;
                  } | null;
                  return (
                    <TableRow key={String(l.id)}>
                      <TableCell>
                        {emp?.employee_number} {emp?.first_name} {emp?.last_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(l.basic_salary))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(l.paye))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(l.nssf_employee))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(Number(l.net_pay))}
                      </TableCell>
                      <TableCell>
                        <DocumentActions
                          showLabel={false}
                          size="sm"
                          variant="ghost"
                          doc={(): BusinessDocument => ({
                            title: `Payslip ${emp?.employee_number}`,
                            docType: "Payslip",
                            number: `${String(activeRun?.run_number ?? "PAY")}-${emp?.employee_number ?? ""}`,
                            date: activeRun?.pay_date
                              ? String(activeRun.pay_date)
                              : formatDate(new Date()),
                            status: String(activeRun?.status ?? "draft"),
                            currency: "UGX",
                            billToLabel: "Employee",
                            billToName: `${emp?.first_name ?? ""} ${emp?.last_name ?? ""}`,
                            billToMeta: [emp?.employee_number ?? ""],
                            meta: [
                              {
                                label: "Period",
                                value: String(activeRun?.period_label ?? ""),
                              },
                            ],
                            lines: [
                              {
                                description: "Basic salary",
                                quantity: 1,
                                unit_price: Number(l.basic_salary),
                                amount: Number(l.basic_salary),
                              },
                              {
                                description: "PAYE (deduction)",
                                quantity: 1,
                                unit_price: -Number(l.paye),
                                amount: -Number(l.paye),
                              },
                              {
                                description: "NSSF employee 5%",
                                quantity: 1,
                                unit_price: -Number(l.nssf_employee),
                                amount: -Number(l.nssf_employee),
                              },
                            ],
                            total: Number(l.net_pay),
                            footerNote:
                              "Confidential payslip · SecureTrack ERP · Uganda PAYE/NSSF",
                          })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
