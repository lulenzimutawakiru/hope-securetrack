"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime } from "@/lib/utils";

export default function IdmAuditPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("idm_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading identity audit…" />;

  return (
    <div>
      <PageHeader
        title="Identity Audit Trail"
        description="Provision · role assign · password reset · suspend · import"
      />

      <div className="mb-6">
        <StatCard title="Events" value={String(rows.length)} icon={FileText} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No identity audit events" description="Actions will appear after provisioning." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.created_at ? formatDateTime(String(r.created_at)) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm capitalize">{String(r.action).replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-sm max-w-[360px] truncate">{String(r.details || "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.target_user_id || "—").slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
