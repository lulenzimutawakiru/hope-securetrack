"use client";

import { useEffect, useState } from "react";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { decideTicketApproval, approveCatalogRequest } from "@/lib/service-desk";
import { formatDateTime } from "@/lib/utils";

export default function TicketApprovalsPage() {
  const { auth } = useUser();
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const actorName = auth?.profile
    ? `${(auth.profile as { first_name?: string }).first_name || ""}`.trim()
    : "Approver";

  const load = async () => {
    const sb = createClient();
    const [{ data: a }, { data: c }] = await Promise.all([
      sb.from("sd_approvals").select("*, support_tickets(ticket_number, subject)").eq("decision", "pending").order("created_at", { ascending: false }),
      sb.from("sd_catalog_requests").select("*, sd_catalog_items(name)").eq("approval_status", "pending").order("created_at", { ascending: false }),
    ]);
    setApprovals((a as Array<Record<string, unknown>>) || []);
    setCatalog((c as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const decide = async (id: string, ticketId: string, ok: boolean) => {
    if (!companyId) return;
    try {
      await decideTicketApproval({
        approval_id: id,
        company_id: companyId,
        ticket_id: ticketId,
        approved: ok,
        approver_id: userId,
        approver_name: actorName,
      });
      toast.success(ok ? "Approved" : "Rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const decideCatalog = async (id: string, ok: boolean) => {
    if (!userId) return;
    try {
      await approveCatalogRequest(id, userId, ok);
      toast.success(ok ? "Catalog approved" : "Catalog rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading approvals…" />;

  return (
    <div>
      <PageHeader
        title="Ticket & Request Approvals"
        description="Multi-level · software purchase · access · change · catalog fulfillment"
      />

      <h3 className="text-sm font-medium mb-2">Ticket approvals</h3>
      {approvals.length === 0 ? (
        <EmptyState title="No pending ticket approvals" description="Approval chains appear when requested." icon={CheckSquare} />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Seq</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((a) => {
                const t = a.support_tickets as { ticket_number?: string; subject?: string } | null;
                return (
                  <TableRow key={String(a.id)}>
                    <TableCell>
                      <p className="font-mono text-xs">{t?.ticket_number || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t?.subject}</p>
                    </TableCell>
                    <TableCell className="text-xs">{String(a.approver_role || "—")}</TableCell>
                    <TableCell>{String(a.sequence_no)}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(String(a.created_at))}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" onClick={() => decide(String(a.id), String(a.ticket_id), true)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(String(a.id), String(a.ticket_id), false)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Catalog requests</h3>
      {catalog.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending catalog approvals.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.map((c) => {
                const item = c.sd_catalog_items as { name?: string } | null;
                return (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-mono text-xs">{String(c.request_number)}</TableCell>
                    <TableCell className="text-sm">{item?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{String(c.approval_status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" onClick={() => decideCatalog(String(c.id), true)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => decideCatalog(String(c.id), false)}>Reject</Button>
                    </TableCell>
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
