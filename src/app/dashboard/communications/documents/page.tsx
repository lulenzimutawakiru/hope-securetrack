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
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export default function DocumentDeliveryPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [attachments, setAttachments] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    Promise.all([
      listDocumentJobs(auth.profile.company_id),
      createClient().from("comm_attachments").select("*").eq("company_id", auth.profile.company_id).order("created_at", { ascending: false }).limit(100),
    ])
      .then(([j, a]) => {
        setJobs(j as Array<Record<string, unknown>>);
        setAttachments((a.data as Array<Record<string, unknown>>) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading document delivery…" />;

  return (
    <div>
      <PageHeader
        title="Document Delivery"
        description="Auto-generated PDFs · QR · barcodes · digital signature refs · attachments"
      />

      <h3 className="text-sm font-semibold mb-2">PDF generation jobs</h3>
      {jobs.length === 0 ? (
        <EmptyState title="No document jobs" description="Jobs are created when messages attach documents." />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verify</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id as string}>
                  <TableCell className="font-mono text-xs">{String(j.job_number)}</TableCell>
                  <TableCell><Badge variant="outline">{String(j.doc_type)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(j.entity_code || j.entity_type || "—")}</TableCell>
                  <TableCell><Badge variant="secondary">{String(j.status)}</Badge></TableCell>
                  <TableCell className="text-[10px] max-w-[160px] truncate">{String(j.qr_verify_url || "—")}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(j.created_at))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2">Attachments</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>QR / Barcode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attachments.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">No attachments yet</TableCell></TableRow>
            ) : attachments.map((a) => (
              <TableRow key={a.id as string}>
                <TableCell className="text-sm">{String(a.file_name)}</TableCell>
                <TableCell><Badge variant="outline">{String(a.doc_type)}</Badge></TableCell>
                <TableCell className="text-xs">{String(a.classification)}</TableCell>
                <TableCell className="font-mono text-[10px]">{String(a.barcode_value || "—")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
