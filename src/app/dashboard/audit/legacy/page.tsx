"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

/** Original audit_logs table viewer (immutable append-only) */
export default function LegacyAuditPage() {
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setLogs((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Legacy Audit Logs"
        description="Original audit_logs table (append-only, immutable triggers)"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/audit/events">Enterprise trail</Link>
          </Button>
        }
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit logs"
          description="Actions across the platform will be recorded here"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
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
                <TableRow key={String(l.id)}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(String(l.created_at))}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{String(l.user_email ?? "System")}</p>
                      {l.user_role ? (
                        <p className="text-xs text-muted-foreground">{String(l.user_role)}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{String(l.action)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{String(l.module)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(l.entity_type || "—")}</TableCell>
                  <TableCell className="text-xs font-mono">{String(l.entity_reference || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
