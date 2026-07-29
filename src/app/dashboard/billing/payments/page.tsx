"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";

type Pay = {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
  receipt_number?: string | null;
  status?: string | null;
  gateway?: string | null;
  currency?: string | null;
  mobile_money_msisdn?: string | null;
  invoices?: { invoice_number: string; customers?: { name: string } | null } | null;
};

export default function BillingPaymentsPage() {
  const [rows, setRows] = useState<Pay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoice_payments")
        .select("*, invoices(invoice_number, customers(name))")
        .order("payment_date", { ascending: false })
        .limit(300);
      setRows((data as unknown as Pay[]) ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading payments…" />;

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const momo = rows.filter((r) =>
    String(r.method || r.gateway || "").toLowerCase().includes("momo") ||
    String(r.method || "").includes("airtel") ||
    String(r.method || "") === "mobile_money"
  ).length;

  return (
    <div>
      <PageHeader
        title="Payment Collection"
        description="Cash · bank transfer · MTN MoMo · Airtel Money · card · receipts"
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/billing/invoices">Collect on invoice</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Payments" value={String(rows.length)} icon={CreditCard} />
        <StatCard title="Total collected" value={formatNumber(Math.round(total))} icon={CreditCard} />
        <StatCard title="Mobile money txns" value={String(momo)} icon={CreditCard} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No payments" description="Record payments from the Invoices screen." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatDate(p.payment_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.receipt_number || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.invoices?.invoice_number || "—"}</TableCell>
                  <TableCell>{p.invoices?.customers?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{p.method}{p.mobile_money_msisdn ? ` · ${p.mobile_money_msisdn}` : ""}</TableCell>
                  <TableCell className="text-xs">{p.reference || "—"}</TableCell>
                  <TableCell className="text-xs font-medium">{p.currency || "UGX"} {formatNumber(p.amount)}</TableCell>
                  <TableCell><StatusBadge status={p.status || "completed"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
