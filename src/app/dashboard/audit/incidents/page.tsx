"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Siren } from "lucide-react";
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
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function AuditIncidentsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await createClient()
      .from("eal_incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    if (status === "closed") patch.closed_at = new Date().toISOString();
    const crudRes = await crudUpdate("eal_incidents", id, patch);
    toast.success(`Status → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading incidents…" />;

  return (
    <div>
      <PageHeader
        title="Security Incidents"
        description="Failed logins · privilege escalation · exfiltration · Service Desk integration"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/audit/alerts">From alerts</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/service-desk/tickets">Service Desk</Link>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No incidents"
          description="Escalate a security alert to create an incident investigation."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.incident_number)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium flex items-center gap-1">
                      <Siren className="h-3 w-3" /> {String(r.title)}
                    </p>
                    {r.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-1">{String(r.description)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.severity === "critical" || r.severity === "high" ? "destructive" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(String(r.id), "investigating")}>
                        Investigate
                      </Button>
                    )}
                    {(r.status === "open" || r.status === "investigating" || r.status === "contained") && (
                      <Button size="sm" onClick={() => updateStatus(String(r.id), "resolved")}>
                        Resolve
                      </Button>
                    )}
                    {r.status === "resolved" && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(String(r.id), "closed")}>
                        Close
                      </Button>
                    )}
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
