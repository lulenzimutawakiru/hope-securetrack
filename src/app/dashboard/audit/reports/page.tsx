"use client";

import { useEffect, useState } from "react";
import { FileBarChart, Download, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { runAuditReport, exportRowsCsv } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";

export default function AuditReportsPage() {
  const { auth } = useUser();
  const [defs, setDefs] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: d }, { data: r }] = await Promise.all([
      sb.from("eal_report_defs").select("*").order("category"),
      sb.from("eal_report_runs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setDefs((d as Array<Record<string, unknown>>) || []);
    setRuns((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const run = async (code: string) => {
    if (!companyId) return;
    setRunning(code);
    try {
      const res = await runAuditReport({
        company_id: companyId,
        report_code: code,
        run_by: userId,
      });
      setPreview(res.rows.slice(0, 50));
      setSummary(res.summary);
      toast.success(`${code}: ${res.rows.length} row(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Report failed");
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <LoadingState message="Loading audit reports…" />;

  return (
    <div>
      <PageHeader
        title="Audit Reports"
        description="User activity · login · permissions · finance · inventory · production · payroll · documents · exports · print"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {defs.map((d) => (
          <Card key={String(d.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-primary" />
                {String(d.name)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{String(d.description || "")}</p>
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="text-[10px] capitalize">{String(d.category)}</Badge>
                <Button size="sm" onClick={() => run(String(d.report_code))} disabled={running === d.report_code}>
                  <Play className="h-3 w-3 mr-1" />
                  {running === d.report_code ? "…" : "Run"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {defs.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            Apply migration 00040 to seed report definitions.
          </p>
        )}
      </div>

      {summary && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Last run summary</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportRowsCsv(preview, "audit-report.csv")}
              disabled={!preview.length}
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
              {JSON.stringify(summary, null, 2)}
            </pre>
            {preview.length > 0 && (
              <div className="rounded-md border overflow-x-auto mt-4 max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0])
                        .filter((k) => typeof preview[0][k] !== "object")
                        .slice(0, 6)
                        .map((k) => (
                          <TableHead key={k} className="text-xs">{k}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        {Object.keys(preview[0])
                          .filter((k) => typeof preview[0][k] !== "object")
                          .slice(0, 6)
                          .map((k) => (
                            <TableCell key={k} className="text-xs max-w-[140px] truncate">
                              {String(r[k] ?? "")}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent report runs</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.report_code)}</TableCell>
                    <TableCell>{String(r.row_count ?? 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{String(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">No runs yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
