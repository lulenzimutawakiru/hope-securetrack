"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";

export default function ArPage() {
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [receipts, setReceipts] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: inv }, { data: rcp }] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, customers(name)")
          .order("invoice_date", { ascending: false })
          .limit(100),
        supabase
          .from("ar_receipts")
          .select("*, customers(name)")
          .order("receipt_date", { ascending: false })
          .limit(50),
      ]);
      setInvoices(inv ?? []);
      setReceipts(rcp ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState />;

  const outstanding = invoices
    .filter((i) => !["paid", "void", "cancelled"].includes(String(i.status)))
    .reduce(
      (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)),
      0
    );
  const overdue = invoices.filter((i) => {
    if (["paid", "void"].includes(String(i.status))) return false;
    if (!i.due_date) return false;
    return new Date(String(i.due_date)) < new Date();
  }).length;

  return (
    <div>
      <PageHeader
        title="Accounts Receivable"
        description="Customer invoices · receipts · credit notes · aging · collections"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/invoices">Legacy invoices</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/billing">Enterprise Billing</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Open AR" value={formatNumber(Math.round(outstanding))} icon={FileText} />
        <StatCard title="Invoices" value={formatNumber(invoices.length)} />
        <StatCard title="Overdue count" value={formatNumber(overdue)} />
      </div>

      <h3 className="font-medium mb-2">Customer invoices</h3>
      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No AR invoices"
          description="Issue invoices from Sales → Invoices"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => {
                const cust = i.customers as { name?: string } | null;
                const bal = Number(i.total_amount) - Number(i.amount_paid);
                return (
                  <TableRow key={String(i.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(i.invoice_number)}
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell>
                      {i.invoice_date ? formatDate(String(i.invoice_date)) : "—"}
                    </TableCell>
                    <TableCell>
                      {i.due_date ? formatDate(String(i.due_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(i.total_amount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(i.amount_paid))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(bal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(i.status)} />
                    </TableCell>
                    <TableCell>
                      <DocumentActions
                        showLabel={false}
                        size="sm"
                        variant="ghost"
                        doc={(): BusinessDocument => ({
                          title: `Invoice ${i.invoice_number}`,
                          docType: "Tax Invoice / AR",
                          number: String(i.invoice_number),
                          date: i.invoice_date ? String(i.invoice_date) : undefined,
                          dueDate: i.due_date ? String(i.due_date) : undefined,
                          status: String(i.status),
                          currency: String(i.currency || "UGX"),
                          billToName: cust?.name ?? "Customer",
                          total: Number(i.total_amount),
                          amountPaid: Number(i.amount_paid),
                          balance: bal,
                          subtotal: Number(i.subtotal || 0),
                          tax: Number(i.tax_amount || 0),
                        })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Receipts register</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No AR receipts yet — payments post from Invoices module
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => {
                const cust = r.customers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.receipt_number)}
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.receipt_date
                        ? formatDate(String(r.receipt_date))
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.amount))}
                    </TableCell>
                    <TableCell className="capitalize">
                      {String(r.payment_method || "—").replace(/_/g, " ")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
