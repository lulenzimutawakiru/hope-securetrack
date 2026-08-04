"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDateTime } from "@/lib/utils";

export default function AuditApiPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await createClient()
        .from("eal_api_calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading API audit…" />;

  return (
    <div>
      <PageHeader
        title="API Audit"
        description="Requests · responses · OAuth · webhooks · rate limits · integration failures"
      />

      {rows.length === 0 ? (
        <EmptyState title="No API calls logged" description="Instrument APIs with logApiCall()." icon={Globe} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ms</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Rate limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(String(r.created_at))}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.method)}</TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate">{String(r.path)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={Number(r.status_code) >= 400 ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {String(r.status_code ?? "—")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(r.duration_ms ?? "—")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.ip_address || "—")}</TableCell>
                  <TableCell>
                    {r.rate_limited ? (
                      <Badge variant="destructive" className="text-[10px]">Limited</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">OK</span>
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
