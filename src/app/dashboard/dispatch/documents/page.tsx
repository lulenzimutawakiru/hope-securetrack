"use client";

import { useEffect, useState } from "react";
import { FileText, Printer, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { generateShippingDocument, buildDispatchNoteHtml, DOC_TYPES } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/utils";

export default function DispatchDocumentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState("dispatch_note");
  const [requestId, setRequestId] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: r }] = await Promise.all([
      sb.from("dsp_documents").select("*").order("created_at", { ascending: false }).limit(100),
      sb.from("dsp_requests").select("id, request_number, customer_name, delivery_address").is("deleted_at", null).limit(50),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setRequests((r as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!companyId) return;
    const req = requests.find((r) => String(r.id) === requestId);
    try {
      const doc = await generateShippingDocument({
        company_id: companyId,
        doc_type: docType,
        request_id: requestId || null,
        title: `${docType} ${req?.request_number || ""}`.trim(),
        html_body: buildDispatchNoteHtml({
          docNumber: String(req?.request_number || "DRAFT"),
          customerName: String(req?.customer_name || ""),
          address: String(req?.delivery_address || ""),
          qrPayload: `SHP-${req?.request_number || "X"}`,
        }),
        qr_payload: `SHP-${req?.request_number || "X"}`,
        created_by: userId,
      });
      toast.success(`Generated ${doc.doc_number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const print = (html: string) => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  if (loading) return <LoadingState message="Loading shipping documents…" />;

  return (
    <div>
      <PageHeader
        title="Shipping Documents"
        description="Dispatch note · DN · packing list · BOL · waybill · trip sheet · watermark"
      />

      <div className="flex flex-wrap gap-2 mb-6 items-end">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Document type</p>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Request</p>
          <Select value={requestId} onValueChange={setRequestId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {requests.map((r) => (
                <SelectItem key={String(r.id)} value={String(r.id)}>
                  {String(r.request_number)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={generate}>
          <Plus className="h-4 w-4 mr-1" /> Generate
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No documents" description="Generate from a dispatch request." icon={FileText} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>QR</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.doc_number)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{String(r.doc_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{String(r.title)}</TableCell>
                  <TableCell className="font-mono text-[10px]">{String(r.qr_payload || "—")}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-right">
                    {r.html_body ? (
                      <Button size="sm" variant="ghost" onClick={() => print(String(r.html_body))}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    ) : null}
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
