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
import { listDeliveryEvents } from "@/lib/communications";
import { formatDate } from "@/lib/utils";

export default function DeliveriesPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    listDeliveryEvents(auth.profile.company_id)
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading delivery reports…" />;

  return (
    <div>
      <PageHeader
        title="Delivery Reports"
        description="Sent · delivered · opened · clicked · downloaded · failed · retried"
      />
      {rows.length === 0 ? (
        <EmptyState title="No delivery events" description="Send a message to start tracking." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Recipient</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const msg = r.comm_messages as Record<string, unknown> | null;
                return (
                  <TableRow key={r.id as string}>
                    <TableCell className="text-xs">{formatDate(String(r.occurred_at))}</TableCell>
                    <TableCell><Badge variant="outline">{String(r.event_type)}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {msg ? `${String(msg.message_number)} · ${String(msg.subject || "")}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{String(r.recipient || "—")}</TableCell>
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
