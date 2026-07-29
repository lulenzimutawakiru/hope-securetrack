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
import { listCommAudit } from "@/lib/communications";
import { formatDate } from "@/lib/utils";

export default function CommAuditPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    listCommAudit(auth.profile.company_id)
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading communication audit…" />;

  return (
    <div>
      <PageHeader
        title="Communication Audit Logs"
        description="Immutable trail of compose · send · retry · campaign actions"
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries" description="Actions will appear here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="text-xs">{formatDate(String(r.created_at))}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.action)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.entity_table || "—")}</TableCell>
                  <TableCell className="text-xs max-w-[320px] truncate">{String(r.details || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
