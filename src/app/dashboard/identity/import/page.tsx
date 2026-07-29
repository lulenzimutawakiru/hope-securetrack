"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { parseBulkCsv, runBulkImport } from "@/lib/idm";

const SAMPLE = `first_name,last_name,email,phone,department,job_title,employee_id,role_slug,user_type
Jane,Operator,jane.operator@hopedesign.ug,+256700000001,Production,Machine Operator,HDG-0101,production_operator,employee
Sam,Clerk,sam.clerk@hopedesign.ug,+256700000002,Finance,Accounts Clerk,HDG-0102,accountant,employee`;

export default function BulkImportPage() {
  const { auth } = useUser();
  const [csv, setCsv] = useState(SAMPLE);
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: Array<{ row: number; email: string; error: string }> } | null>(null);
  const [autoActivate, setAutoActivate] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("idm_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setBatches((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const run = async () => {
    if (!companyId) return;
    setRunning(true);
    setResult(null);
    try {
      const rows = await parseBulkCsv(csv);
      if (!rows.length) {
        toast.error("No valid rows found");
        return;
      }
      const res = await runBulkImport({
        company_id: companyId,
        rows,
        actor_id: auth?.user?.id,
        file_name: "paste.csv",
        auto_activate: autoActivate,
      });
      setResult({ success: res.success, failed: res.failed, errors: res.errors });
      toast.success(`Import ${res.batch_number}: ${res.success} ok, ${res.failed} failed`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingState message="Loading import history…" />;

  return (
    <div>
      <PageHeader
        title="Bulk User Import"
        description="CSV import · create provision requests · optional auto-activate"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">CSV data</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Paste CSV (header required)</Label>
              <textarea
                className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoActivate} onChange={(e) => setAutoActivate(e.target.checked)} />
              Skip approval (admin-approved requests)
            </label>
            <Button onClick={run} disabled={running}>
              <Upload className="h-4 w-4 mr-1" />
              {running ? "Importing…" : "Run import"}
            </Button>
            {result && (
              <div className="text-sm border rounded p-3 space-y-1">
                <p>Success: {result.success} · Failed: {result.failed}</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-destructive">Row {e.row} {e.email}: {e.error}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Import batches</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>OK</TableHead>
                    <TableHead>Fail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={String(b.id)}>
                      <TableCell className="font-mono text-xs">{String(b.batch_number)}</TableCell>
                      <TableCell>{String(b.total_rows)}</TableCell>
                      <TableCell>{String(b.success_rows)}</TableCell>
                      <TableCell>{String(b.failed_rows)}</TableCell>
                      <TableCell><StatusBadge status={String(b.status)} /></TableCell>
                      <TableCell className="text-xs">{b.created_at ? formatDate(String(b.created_at)) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
