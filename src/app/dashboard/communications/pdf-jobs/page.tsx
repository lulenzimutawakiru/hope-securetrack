"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listDocumentJobs } from "@/lib/communications";
import { formatDate } from "@/lib/utils";

export default function PdfJobsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    listDocumentJobs(auth.profile.company_id)
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading PDF jobs…" />;

  return (
    <div>
      <PageHeader
        title="PDF Generation Jobs"
        description="Invoices · POs · payslips · QC certificates · branded · QR-verifiable"
      />
      {rows.length === 0 ? (
        <EmptyState title="No PDF jobs" description="Trigger an event rule with attach_docs to generate jobs." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Doc type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.job_number)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.doc_type)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.entity_code || "—")}</TableCell>
                  <TableCell><Badge variant="secondary">{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{r.completed_at ? formatDate(String(r.completed_at)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
