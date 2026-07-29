"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { downloadCsv } from "@/lib/documents";

export default function ReportHistoryPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("bi_report_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Report Run History"
        description="Audit trail of interactive runs, exports, and scheduled executions"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!rows.length}
              onClick={() =>
                downloadCsv(
                  "report-runs.csv",
                  ["When", "Code", "Status", "Format", "Rows", "Duration ms"],
                  rows.map((r) => [
                    r.started_at ? new Date(String(r.started_at)).toISOString() : "",
                    String(r.report_code ?? ""),
                    String(r.status ?? ""),
                    String(r.format ?? ""),
                    String(r.row_count ?? 0),
                    String(r.duration_ms ?? ""),
                  ])
                )
              }
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No runs yet"
          description="Run a report from the Library or Export Center"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.started_at
                      ? new Date(String(r.started_at)).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {String(r.report_code ?? "—")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        r.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : undefined
                      }
                      variant={r.status === "completed" ? "default" : "secondary"}
                    >
                      {String(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase text-xs">{String(r.format)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(Number(r.row_count ?? 0))}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
