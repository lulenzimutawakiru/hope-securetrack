"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { convertInboundToTicket } from "@/lib/service-desk";
import { formatDateTime } from "@/lib/utils";

export default function InboundTicketsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_inbound_items")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const convert = async (id: string) => {
    if (!companyId) return;
    try {
      const t = await convertInboundToTicket({
        company_id: companyId,
        inbound_id: id,
        created_by: userId,
      });
      toast.success(`Ticket ${t.ticket_number} created`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const ignore = async (id: string) => {
    const crudRes = await crudUpdate("sd_inbound_items", id, { status: "ignored" });
    toast.success("Ignored");
    await load();
  };

  if (loading) return <LoadingState message="Loading inbound channels…" />;

  return (
    <div>
      <PageHeader
        title="Multi-Channel Inbox"
        description="Email-to-ticket · WhatsApp · IoT alerts · chat · phone logs · AI convert"
      />

      {rows.length === 0 ? (
        <EmptyState title="Inbox empty" description="Apply migration 00042 for sample email inbound." icon={Inbox} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.source)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.from_address || "—")}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{String(r.subject || "(no subject)")}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{String(r.body || "")}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.received_at))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "new" && (
                      <>
                        <Button size="sm" onClick={() => convert(String(r.id))}>Create ticket</Button>
                        <Button size="sm" variant="ghost" onClick={() => ignore(String(r.id))}>Ignore</Button>
                      </>
                    )}
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
