"use client";

import { useEffect, useState } from "react";
import { FileStack } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime } from "@/lib/utils";

export default function AuditFilesPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("eal_file_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading file audit…" />;

  return (
    <div>
      <PageHeader
        title="File & Document Audit"
        description="Upload · download · print · share · delete · restore · version history"
      />

      {rows.length === 0 ? (
        <EmptyState title="No file events" description="Document actions are logged via logFileAudit()." icon={FileStack} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Module</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-sm">{String(r.username || "—")}</TableCell>
                  <TableCell>
                    <p className="text-sm">{String(r.file_name)}</p>
                    <p className="text-xs text-muted-foreground">{String(r.file_type || "")}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.action)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">v{String(r.version_no ?? 1)}</TableCell>
                  <TableCell className="text-xs uppercase">{String(r.module || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
