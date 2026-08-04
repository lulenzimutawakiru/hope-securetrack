"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime } from "@/lib/utils";
import { AUDIT_MODULES, AUDIT_SEVERITIES, formatFieldChanges } from "@/lib/audit";

export default function AuditEventsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [module, setModule] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    let query = createClient()
      .from("eal_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (module !== "all") query = query.eq("module", module);
    if (severity !== "all") query = query.eq("severity", severity);
    const { data } = await query;
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [module, severity]);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.audit_id || "").toLowerCase().includes(s) ||
      String(r.action || "").toLowerCase().includes(s) ||
      String(r.user_email || "").toLowerCase().includes(s) ||
      String(r.full_name || "").toLowerCase().includes(s) ||
      String(r.entity_reference || "").toLowerCase().includes(s) ||
      String(r.ip_address || "").toLowerCase().includes(s) ||
      String(r.event_type || "").toLowerCase().includes(s)
    );
  });

  const sevVariant = (s: string) => {
    if (s === "critical" || s === "high") return "destructive" as const;
    if (s === "medium") return "default" as const;
    return "outline" as const;
  };

  if (loading) return <LoadingState message="Loading audit events…" />;

  return (
    <div>
      <PageHeader
        title="Audit Event Trail"
        description="Immutable · searchable · before/after · correlation IDs · tamper-evident hashes"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/audit">Hub</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="User, IP, module, entity, audit ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {AUDIT_MODULES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            {AUDIT_SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No events" description="Apply migration 00039 or perform ERP actions." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(String(r.created_at))}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(r.audit_id)}</TableCell>
                  <TableCell>
                    <p className="text-sm">{String(r.full_name || r.user_email || "System")}</p>
                    <p className="text-xs text-muted-foreground">{String(r.user_role || "")}</p>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{String(r.action)}</TableCell>
                  <TableCell className="text-xs uppercase">{String(r.module)}</TableCell>
                  <TableCell>
                    <Badge variant={sevVariant(String(r.severity))} className="text-[10px] capitalize">
                      {String(r.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{String(r.risk_score ?? 0)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{String(detail?.audit_id)}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Event</span><p>{String(detail.event_type)}</p></div>
                <div><span className="text-muted-foreground">CRUD</span><p className="capitalize">{String(detail.crud_op || "—")}</p></div>
                <div><span className="text-muted-foreground">IP</span><p className="font-mono text-xs">{String(detail.ip_address || "—")}</p></div>
                <div><span className="text-muted-foreground">Session</span><p className="font-mono text-xs truncate">{String(detail.session_id || "—")}</p></div>
                <div><span className="text-muted-foreground">MFA</span><p>{String(detail.mfa_status || "—")}</p></div>
                <div><span className="text-muted-foreground">Auth</span><p>{String(detail.auth_method || "—")}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Correlation</span><p className="font-mono text-xs">{String(detail.correlation_id || "—")}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Integrity hash</span><p className="font-mono text-[10px] break-all">{String(detail.integrity_hash)}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground">Prev hash</span><p className="font-mono text-[10px] break-all">{String(detail.prev_hash)}</p></div>
              </div>
              {detail.details != null && detail.details !== "" ? (
                <p className="text-muted-foreground">{String(detail.details)}</p>
              ) : null}
              <div>
                <p className="font-medium mb-1">Field changes</p>
                {formatFieldChanges(
                  detail.before_state as Record<string, unknown>,
                  detail.after_state as Record<string, unknown>
                ).map((c) => (
                  <div key={c.field} className="rounded border p-2 mb-1 text-xs">
                    <p className="font-medium">{c.field}</p>
                    <p className="text-muted-foreground">Before: {JSON.stringify(c.before)}</p>
                    <p>After: {JSON.stringify(c.after)}</p>
                  </div>
                ))}
                {formatFieldChanges(
                  detail.before_state as Record<string, unknown>,
                  detail.after_state as Record<string, unknown>
                ).length === 0 && (
                  <p className="text-xs text-muted-foreground">No field-level diff</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
