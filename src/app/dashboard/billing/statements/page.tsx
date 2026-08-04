"use client";

import { useEffect, useState } from "react";
import { FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { buildInvoiceHtml, printInvoiceHtml } from "@/lib/billing";

/**
 * Customer account statement — invoices, payments, running balance.
 */
export default function StatementsPage() {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("customers")
        .select("id,name,code")
        .eq("is_active", true)
        .order("name");
      setCustomers(data ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const loadStatement = async (id: string) => {
    setCustomerId(id);
    if (!id) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const [{ data: inv }, { data: pays }] = await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", id)
          .not("status", "in", '("void","cancelled")')
          .order("invoice_date"),
        supabase
          .from("invoice_payments")
          .select("*, invoices!inner(customer_id,invoice_number)")
          .eq("invoices.customer_id", id)
          .order("payment_date"),
      ]);
      setInvoices(inv ?? []);
      setPayments((pays as unknown as Array<Record<string, unknown>>) ?? []);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const cust = customers.find((c) => c.id === customerId);
    downloadCsv(
      `statement-${cust?.code || "customer"}.csv`,
      ["Date", "Type", "Reference", "Debit", "Credit", "Balance"],
      buildLedger().map((r) => [r.date, r.type, r.ref, r.debit, r.credit, r.balance])
    );
    toast.success("Statement exported");
  };

  const buildLedger = () => {
    type Row = { date: string; type: string; ref: string; debit: number; credit: number; balance: number };
    const rows: Array<{ date: string; type: string; ref: string; debit: number; credit: number }> = [];
    invoices.forEach((i) => {
      rows.push({
        date: String(i.invoice_date),
        type: String(i.invoice_type || "invoice"),
        ref: String(i.invoice_number),
        debit: Number(i.total_amount),
        credit: 0,
      });
    });
    payments.forEach((p) => {
      rows.push({
        date: String(p.payment_date),
        type: "payment",
        ref: String(p.receipt_number || p.reference || ""),
        debit: 0,
        credit: Number(p.amount),
      });
    });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    }) as Row[];
  };

  const printStatement = () => {
    const cust = customers.find((c) => c.id === customerId);
    const ledger = buildLedger();
    const lines = ledger.map((r) => ({
      description: `${r.type.toUpperCase()} ${r.ref}`,
      quantity: 1,
      unit_price: r.debit || r.credit,
      tax_rate: 0,
      line_total: r.debit - r.credit,
    }));
    const bal = ledger.length ? ledger[ledger.length - 1].balance : 0;
    const html = buildInvoiceHtml({
      title: "CUSTOMER STATEMENT",
      invoice_number: `STMT-${cust?.code || "CUST"}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      customer_name: cust?.name,
      currency: "UGX",
      lines,
      total_amount: bal,
      balance_due: bal,
      notes: "Account statement of invoices and payments.",
    });
    printInvoiceHtml(html);
  };

  if (loading) return <LoadingState message="Loading statements…" />;

  const ledger = customerId ? buildLedger() : [];
  const closing = ledger.length ? ledger[ledger.length - 1].balance : 0;

  return (
    <div>
      <PageHeader
        title="Customer Statements"
        description="Account ledger · invoices · payments · running balance · PDF/CSV"
        actions={
          customerId ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
              <Button size="sm" onClick={printStatement}>
                <FileText className="h-4 w-4 mr-1" /> Print / PDF
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="max-w-md mb-6">
        <Label>Customer</Label>
        <Select value={customerId || "_none"} onValueChange={(v) => loadStatement(v === "_none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— Select —</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {busy && <LoadingState message="Building statement…" />}

      {customerId && !busy && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-2xl font-bold">{invoices.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Payments</p><p className="text-2xl font-bold">{payments.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Closing balance</p><p className="text-2xl font-bold">{formatNumber(Math.round(closing))}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Ledger</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(r.date)}</TableCell>
                      <TableCell className="text-xs">{r.type}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                      <TableCell className="text-xs">{r.debit ? formatNumber(r.debit) : ""}</TableCell>
                      <TableCell className="text-xs">{r.credit ? formatNumber(r.credit) : ""}</TableCell>
                      <TableCell className="text-xs font-medium">{formatNumber(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
