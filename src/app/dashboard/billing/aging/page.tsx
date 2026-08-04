"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";
import { agingBucket } from "@/lib/billing";

export default function AgingPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [buckets, setBuckets] = useState<Record<string, number>>({
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("id,invoice_number,due_date,status,total_amount,amount_paid,currency,customers(name)")
        .not("status", "in", '("paid","void","cancelled")')
        .order("due_date")
        .limit(1000);
      const list = data ?? [];
      setRows(list);
      const b: Record<string, number> = {
        current: 0,
        "1-30": 0,
        "31-60": 0,
        "61-90": 0,
        "90+": 0,
      };
      list.forEach((i) => {
        const bal = Number(i.total_amount) - Number(i.amount_paid || 0);
        const bucket = agingBucket(i.due_date as string | null, String(i.status));
        if (bucket !== "paid" && b[bucket] != null) b[bucket] += bal;
      });
      setBuckets(b);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AR aging…" />;

  const total = Object.values(buckets).reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title="Accounts Receivable Aging"
        description="Current · 1-30 · 31-60 · 61-90 · 90+ collections view"
      />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        <StatCard title="Total open" value={formatNumber(Math.round(total))} icon={Scale} />
        {Object.entries(buckets).map(([k, v]) => (
          <StatCard key={k} title={k === "current" ? "Current" : `${k} days`} value={formatNumber(Math.round(v))} />
        ))}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Bucket</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const bal = Number(r.total_amount) - Number(r.amount_paid || 0);
              const bucket = agingBucket(r.due_date as string | null, String(r.status));
              return (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.invoice_number)}</TableCell>
                  <TableCell>{(r.customers as { name?: string } | null)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{r.due_date ? formatDate(String(r.due_date)) : "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{bucket}</TableCell>
                  <TableCell className="text-xs">{String(r.currency || "UGX")} {formatNumber(bal)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
