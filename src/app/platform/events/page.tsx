"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listDomainEvents, type DomainEvent } from "@/lib/platform";
import { RefreshCw } from "lucide-react";

export default function PlatformEventsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DomainEvent[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listDomainEvents({ limit: 200 }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(
    (r) =>
      !q.trim() ||
      r.event_type.toLowerCase().includes(q.toLowerCase()) ||
      (r.source_module || "").toLowerCase().includes(q.toLowerCase())
  );

  if (loading) return <LoadingState message="Loading event stream…" />;

  return (
    <div>
      <PageHeader
        title="Domain event stream"
        description="Event-driven architecture — every business action emits an event"
        actions={
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />
      <Input
        className="max-w-sm mb-4"
        placeholder="Filter events…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Aggregate</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.event_type}</TableCell>
                <TableCell className="text-xs">{r.source_module || "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.aggregate_type || "—"}
                  {r.aggregate_id ? ` · ${String(r.aggregate_id).slice(0, 8)}…` : ""}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{r.severity || "info"}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                  No events. Use emitEvent() from modules after CRUD actions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
