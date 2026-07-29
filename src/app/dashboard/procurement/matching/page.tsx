"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { listMatchLogs } from "@/lib/srm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SrmMatchingPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMatchLogs()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading three-way match…" />;

  const matched = rows.filter((r) => r.match_status === "matched").length;
  const exceptions = rows.filter((r) => r.match_status === "exception" || r.match_status === "partial").length;

  return (
    <div>
      <PageHeader
        title="Three-Way Invoice Matching"
        description="PO + GRN + Supplier Invoice · variance · partial payments · tax withholding ready"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement/orders">Purchase orders</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/inventory/grn">GRN</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance">Finance AP</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Match logs" value={String(rows.length)} icon={Scale} />
        <StatCard title="Matched" value={String(matched)} />
        <StatCard title="Exceptions / partial" value={String(exceptions)} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">PO amount</TableHead>
              <TableHead className="text-right">GRN amount</TableHead>
              <TableHead className="text-right">Invoice amount</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Matched</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No match logs yet — seed appears after migration 00045
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell><StatusBadge status={String(r.match_status)} /></TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.po_amount || 0))}</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.grn_amount || 0))}</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.invoice_amount || 0))}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Number(r.variance || 0))}
                  </TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">{String(r.notes || "—")}</TableCell>
                  <TableCell className="text-xs">
                    {r.matched_at ? new Date(String(r.matched_at)).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
