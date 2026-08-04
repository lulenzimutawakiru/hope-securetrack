"use client";

import { useEffect, useState } from "react";
import { Building2, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function PayPaymentsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await createClient()
      .from("pay_payment_batches")
      .select("*, payroll_runs(run_number,period_label)")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const download = (r: Record<string, unknown>) => {
    if (!r.file_content) {
      toast.error("No file content");
      return;
    }
    const blob = new Blob([String(r.file_content)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.batch_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirm = async (id: string) => {
    const crudRes = await crudUpdate("pay_payment_batches", id, { status: "confirmed", confirmed_at: new Date().toISOString() });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Payment confirmed");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading payment batches…" />;

  return (
    <div>
      <PageHeader
        title="Bank Payments"
        description="Payment batches · bank upload CSV · confirmation"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No payment batches"
          description="Generate a bank file from Payroll Runs after approval."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Run</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const run = r.payroll_runs as { run_number?: string; period_label?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      <div className="font-mono text-xs">{String(r.batch_number)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.payment_date ? formatDate(String(r.payment_date)) : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {run?.period_label || "—"}
                      <div className="text-[10px] font-mono text-muted-foreground">{run?.run_number}</div>
                    </TableCell>
                    <TableCell className="text-sm">{String(r.bank_name || "—")}</TableCell>
                    <TableCell className="text-right">{String(r.employee_count || 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(Number(r.total_amount))}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => download(r)}>
                        <Download className="h-3 w-3 mr-1" /> CSV
                      </Button>
                      {r.status !== "confirmed" && (
                        <Button size="sm" variant="ghost" onClick={() => confirm(String(r.id))}>
                          Confirm
                        </Button>
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
