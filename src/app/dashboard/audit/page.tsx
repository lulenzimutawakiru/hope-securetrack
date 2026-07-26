"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/types/database";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as AuditLog[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable record of system actions (append-only)"
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit logs"
          description="Actions across the platform will be recorded here"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(l.created_at)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{l.user_email ?? "System"}</p>
                      {l.user_role && (
                        <p className="text-xs text-muted-foreground">{l.user_role}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{l.module}</TableCell>
                  <TableCell className="text-sm">{l.entity_type ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.entity_reference ?? "—"}
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
