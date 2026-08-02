"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Siren } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { createIncidentFromAlert } from "@/lib/audit";

export default function AuditAlertsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    let q = createClient()
      .from("eal_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const ack = async (id: string) => {
    const crudRes2 = await crudUpdate("eal_alerts", id, { status: "acknowledged", acknowledged_at: new Date().toISOString() });
    toast.success("Acknowledged");
    await load();
  };

  const resolve = async (id: string) => {
    const crudRes = await crudUpdate("eal_alerts", id, {
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      });
    toast.success("Resolved");
    await load();
  };

  const escalate = async (id: string) => {
    if (!companyId) return;
    try {
      const inc = await createIncidentFromAlert({
        company_id: companyId,
        alert_id: id,
        created_by: userId,
      });
      toast.success(`Incident ${inc.incident_number} created`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading security alerts…" />;

  return (
    <div>
      <PageHeader
        title="Security Alerts"
        description="Failed logins · privilege · exports · payroll · night activity · API abuse"
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No alerts" description="AI and rule engine alerts appear here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.alert_number)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.severity === "critical" || r.severity === "high"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px] capitalize"
                    >
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.alert_type)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> {String(r.title)}
                    </p>
                    {r.detail ? (
                      <p className="text-xs text-muted-foreground line-clamp-1">{String(r.detail)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>{String(r.risk_score ?? 0)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDateTime(String(r.created_at))}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "open" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => ack(String(r.id))}>Ack</Button>
                        <Button size="sm" variant="outline" onClick={() => escalate(String(r.id))}>
                          <Siren className="h-3 w-3 mr-1" /> Incident
                        </Button>
                        <Button size="sm" variant="default" onClick={() => resolve(String(r.id))}>
                          Resolve
                        </Button>
                      </>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize ml-1">{String(r.status)}</Badge>
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
