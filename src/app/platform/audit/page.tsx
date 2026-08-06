"use client";

/**
 * Audit Log Explorer - immutable audit trail across admin actions, tenant
 * changes, billing, security, and configuration events.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ScrollText,
  Search,
  RefreshCw,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogsResult } from "@/lib/platform/admin-console";

export default function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditLogsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [limit, setLimit] = useState(200);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (search.trim()) params.set("search", search.trim());
      if (action !== "all") params.set("action", action);
      const res = await fetch(`/api/platform/audit?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load audit logs");
      }
      setData(json.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [search, action, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log Explorer"
        description="Immutable platform audit trail - admin actions, tenant changes, billing, and security events"
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
                placeholder="Search user, action, module, tenant, IP..."
                className="pl-9"
                aria-label="Search audit logs"
              />
            </div>
            <Select value={action} onValueChange={(v) => setAction(v)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(data?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {loading ? (
            <div className="py-8">
              <LoadingState message="Loading audit records..." />
            </div>
          ) : data && data.records.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit records match"
              description="Try clearing the search or selecting a different action."
              className="mt-4"
            />
          ) : data ? (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((r) => (
                    <TableRow key={`${r.source}-${r.id}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{r.user_email || "system"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">{r.module || "—"}</TableCell>
                      <TableCell className="max-w-44 truncate text-muted-foreground">
                        {r.entity_reference || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.tenant_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.ip_address || "—"}</TableCell>
                      <TableCell>
                        {r.source === "tenant_audit" ? (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <ShieldCheck className="h-3 w-3" /> tenant_audit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <FileText className="h-3 w-3" /> audit_logs
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {formatCount(data.total)} record(s) match · showing {data.records.length}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Audit records are append-only. This explorer is read-only and restricted to
        Security, Compliance, and Platform Owner roles.
      </p>
    </div>
  );
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-KE").format(n);
}