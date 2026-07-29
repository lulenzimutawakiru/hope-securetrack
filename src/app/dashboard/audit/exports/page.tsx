"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { logExport } from "@/lib/audit";

export default function AuditExportsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("eal_exports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const demo = async () => {
    if (!companyId) return;
    try {
      await logExport({
        company_id: companyId,
        user_id: userId,
        username: (auth?.profile as { email?: string } | undefined)?.email,
        export_format: "csv",
        module: "audit",
        entity_type: "eal_events",
        record_count: 250,
        contains_sensitive: true,
        destination: "download",
      });
      toast.success("Export event logged");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading export monitor…" />;

  return (
    <div>
      <PageHeader
        title="Data Export Monitoring"
        description="Excel · PDF · CSV · API · email · large / sensitive / after-hours alerts"
        actions={
          <Button size="sm" variant="outline" onClick={demo}>
            <Plus className="h-4 w-4 mr-1" /> Log sample export
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No exports" description="Exports from ERP modules are monitored here." icon={Download} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Sensitive</TableHead>
                <TableHead>After hours</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-sm">{String(r.username || "—")}</TableCell>
                  <TableCell className="uppercase text-xs font-mono">{String(r.export_format)}</TableCell>
                  <TableCell className="text-xs">{String(r.module || "—")}</TableCell>
                  <TableCell>{String(r.record_count ?? 0)}</TableCell>
                  <TableCell>
                    {r.contains_sensitive ? (
                      <Badge variant="destructive" className="text-[10px]">Yes</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.after_hours ? (
                      <Badge variant="default" className="text-[10px]">Yes</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{String(r.risk_score ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
