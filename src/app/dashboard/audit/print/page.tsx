"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

export default function AuditPrintPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("eal_print_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading print audit…" />;

  return (
    <div>
      <PageHeader
        title="Print Audit"
        description="Who printed · document · printer · copies · outcome · watermark"
      />

      {rows.length === 0 ? (
        <EmptyState title="No print events" description="Integrate logPrintAudit with Print Ops." icon={Printer} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Watermark</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-sm">{String(r.username || "—")}</TableCell>
                  <TableCell>
                    <p className="text-sm">{String(r.document_name)}</p>
                    <p className="text-xs text-muted-foreground">{String(r.document_type || "")}</p>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.printer_name || "—")}</TableCell>
                  <TableCell>{String(r.copies ?? 1)}</TableCell>
                  <TableCell>
                    {r.watermark_applied ? (
                      <Badge className="text-[10px]">Yes</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.outcome)}</Badge>
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
