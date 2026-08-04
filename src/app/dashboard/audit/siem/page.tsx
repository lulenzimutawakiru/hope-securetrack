"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";
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
import { toggleSiemConnector, flushSiemOutbox } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";

export default function AuditSiemPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { count }] = await Promise.all([
      sb.from("eal_siem_connectors").select("*").order("name"),
      sb.from("eal_siem_outbox").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPending(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    if (!companyId) return;
    try {
      await toggleSiemConnector({
        company_id: companyId,
        id,
        enabled: !enabled,
        actor_id: userId,
      });
      toast.success(!enabled ? "Connector enabled" : "Connector disabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const flush = async () => {
    if (!companyId) return;
    try {
      const r = await flushSiemOutbox(companyId);
      toast.success(`Flushed ${r.sent} event(s) to SIEM outbox`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Flush failed");
    }
  };

  if (loading) return <LoadingState message="Loading SIEM connectors…" />;

  return (
    <div>
      <PageHeader
        title="SIEM Integrations"
        description="Splunk · Microsoft Sentinel · IBM QRadar · Elastic · webhook · REST outbox"
        actions={
          <Button size="sm" onClick={flush}>
            Flush outbox ({pending})
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No connectors" description="Apply migration 00040." icon={Network} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Min severity</TableHead>
                <TableHead>Last push</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.connector_code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                  <TableCell className="capitalize text-xs">{String(r.provider)}</TableCell>
                  <TableCell className="text-xs">{String(r.min_severity)}</TableCell>
                  <TableCell className="text-xs">
                    {r.last_push_at ? formatDateTime(String(r.last_push_at)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.enabled ? "default" : "outline"} className="text-[10px]">
                      {r.enabled ? "On" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggle(String(r.id), !!r.enabled)}>
                      {r.enabled ? "Disable" : "Enable"}
                    </Button>
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
