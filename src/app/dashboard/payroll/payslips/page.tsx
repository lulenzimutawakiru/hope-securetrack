"use client";

import { useEffect, useState } from "react";
import { FileText, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate } from "@/lib/utils";

export default function PayPayslipsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("pay_payslips")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("created_at", { ascending: false })
        .limit(300);
      setRows((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading payslips…" />;

  const filtered = rows.filter((r) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const emp = r.employees as { first_name?: string; last_name?: string; employee_number?: string } | null;
    return (
      String(r.payslip_number).toLowerCase().includes(s) ||
      String(r.period_label || "").toLowerCase().includes(s) ||
      `${emp?.first_name || ""} ${emp?.last_name || ""} ${emp?.employee_number || ""}`.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader
        title="Digital Payslips"
        description="Online · PDF-ready HTML · verification code · publish from runs"
      />

      <div className="mb-4">
        <Input placeholder="Search payslip or employee…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No payslips" description="Publish payslips from Payroll Runs after processing." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payslip #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Verify</TableHead>
                <TableHead>Published</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const emp = r.employees as { first_name?: string; last_name?: string; employee_number?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.payslip_number)}</TableCell>
                    <TableCell className="text-sm">
                      {emp ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() : "—"}
                      <div className="text-[10px] text-muted-foreground">{emp?.employee_number}</div>
                    </TableCell>
                    <TableCell className="text-sm">{String(r.period_label || "—")}</TableCell>
                    <TableCell className="font-mono text-[10px]">{String(r.verification_code || "—")}</TableCell>
                    <TableCell>
                      {r.is_published ? (
                        <Badge>Published</Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {r.created_at ? formatDate(String(r.created_at)) : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setPreview(String(r.html_body || ""))}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Payslip preview</DialogTitle></DialogHeader>
          {preview && (
            <iframe title="Payslip" srcDoc={preview} className="w-full h-[70vh] rounded border bg-white" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
