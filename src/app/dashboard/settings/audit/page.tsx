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
import { downloadCsv } from "@/lib/documents";

export default function ConfigAuditPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("config_change_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const exportCsv = () => {
    downloadCsv(
      "config-audit.csv",
      ["When", "Entity", "Action", "Field", "Old", "New", "Reason"],
      rows.map((r) => [
        r.created_at ? new Date(String(r.created_at)).toISOString() : "",
        String(r.entity_type ?? ""),
        String(r.action ?? ""),
        String(r.field_name ?? ""),
        String(r.old_value ?? ""),
        String(r.new_value ?? ""),
        String(r.reason ?? ""),
      ])
    );
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Configuration Audit Log"
        description="Immutable trail of settings changes · user · field · before/after"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/audit">System audit</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No configuration changes"
          description="Edits from the Settings center will appear here"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old</TableHead>
                <TableHead>New</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.created_at
                      ? new Date(String(r.created_at)).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {String(r.entity_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {String(r.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{String(r.field_name ?? "—")}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate text-muted-foreground">
                    {String(r.old_value ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">
                    {String(r.new_value ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                    {String(r.reason ?? "—")}
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
