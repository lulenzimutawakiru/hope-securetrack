"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv } from "@/lib/documents";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { agingBucket } from "@/lib/billing";

export default function BillingReportsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    invoices: 0,
    billed: 0,
    collected: 0,
    openAr: 0,
    tax: 0,
    overdue: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: inv }, { data: pays }] = await Promise.all([
        supabase.from("invoices").select("status,total_amount,amount_paid,tax_amount,due_date").limit(5000),
        supabase.from("invoice_payments").select("amount").limit(5000),
      ]);
      const invoices = inv || [];
      const open = invoices.filter((i) => !["paid", "void", "cancelled"].includes(String(i.status)));
      setSummary({
        invoices: invoices.length,
        billed: invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0),
        collected: (pays || []).reduce((s, p) => s + Number(p.amount || 0), 0),
        openAr: open.reduce((s, i) => s + Number(i.total_amount) - Number(i.amount_paid || 0), 0),
        tax: invoices.reduce((s, i) => s + Number(i.tax_amount || 0), 0),
        overdue: open.filter((i) => {
          const b = agingBucket(i.due_date as string | null, String(i.status));
          return b !== "current" && b !== "paid";
        }).length,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const exportInvoices = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number,invoice_type,status,invoice_date,due_date,currency,subtotal,tax_amount,total_amount,amount_paid,customers(name)")
        .order("invoice_date", { ascending: false })
        .limit(5000);
      downloadCsv(
        "invoice-register.csv",
        ["Number", "Type", "Status", "Date", "Due", "Customer", "Currency", "Subtotal", "Tax", "Total", "Paid"],
        (data || []).map((r) => [
          r.invoice_number,
          r.invoice_type,
          r.status,
          r.invoice_date,
          r.due_date,
          (r.customers as { name?: string } | null)?.name,
          r.currency,
          r.subtotal,
          r.tax_amount,
          r.total_amount,
          r.amount_paid,
        ])
      );
      toast.success("Invoice register exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportPayments = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoice_payments")
        .select("payment_date,amount,method,reference,receipt_number,invoices(invoice_number)")
        .order("payment_date", { ascending: false })
        .limit(5000);
      downloadCsv(
        "payment-register.csv",
        ["Date", "Invoice", "Method", "Reference", "Receipt", "Amount"],
        (data || []).map((r) => [
          r.payment_date,
          (r.invoices as { invoice_number?: string } | null)?.invoice_number,
          r.method,
          r.reference,
          r.receipt_number,
          r.amount,
        ])
      );
      toast.success("Payments exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportTax = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number,invoice_date,subtotal,tax_amount,total_amount,tax_breakdown,status,customers(name)")
        .not("status", "in", '("void","cancelled","draft")')
        .limit(5000);
      downloadCsv(
        "tax-report.csv",
        ["Invoice", "Date", "Customer", "Taxable", "Tax", "Total", "Status"],
        (data || []).map((r) => [
          r.invoice_number,
          r.invoice_date,
          (r.customers as { name?: string } | null)?.name,
          Number(r.subtotal),
          r.tax_amount,
          r.total_amount,
          r.status,
        ])
      );
      toast.success("Tax report exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportProfitability = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number,invoice_date,subtotal,tax_amount,total_amount,amount_paid,discount_amount,currency,status,customers(name)")
        .not("status", "in", '("void","cancelled")')
        .limit(5000);
      downloadCsv(
        "profitability-report.csv",
        ["Invoice", "Date", "Customer", "Subtotal", "Discount", "Tax", "Total", "Collected", "Open", "Status"],
        (data || []).map((r) => {
          const total = Number(r.total_amount || 0);
          const paid = Number(r.amount_paid || 0);
          return [
            r.invoice_number,
            r.invoice_date,
            (r.customers as { name?: string } | null)?.name,
            r.subtotal,
            r.discount_amount,
            r.tax_amount,
            total,
            paid,
            total - paid,
            r.status,
          ];
        })
      );
      toast.success("Profitability / collection report exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportAging = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number,due_date,status,total_amount,amount_paid,currency,customers(name)")
        .not("status", "in", '("paid","void","cancelled")')
        .limit(5000);
      downloadCsv(
        "aging-report.csv",
        ["Invoice", "Customer", "Due", "Bucket", "Balance", "Status"],
        (data || []).map((r) => {
          const bal = Number(r.total_amount) - Number(r.amount_paid || 0);
          return [
            r.invoice_number,
            (r.customers as { name?: string } | null)?.name,
            r.due_date,
            agingBucket(r.due_date as string | null, String(r.status)),
            bal,
            r.status,
          ];
        })
      );
      toast.success("Aging report exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading) return <LoadingState message="Loading billing reports…" />;

  return (
    <div>
      <PageHeader
        title="Billing Reports"
        description="Sales register · collections · tax · aging · revenue"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-2xl font-bold">{summary.invoices}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Billed</p><p className="text-2xl font-bold">{formatNumber(Math.round(summary.billed))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-2xl font-bold">{formatNumber(Math.round(summary.collected))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Open AR</p><p className="text-2xl font-bold">{formatNumber(Math.round(summary.openAr))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Tax</p><p className="text-2xl font-bold">{formatNumber(Math.round(summary.tax))}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Overdue invoices</p><p className="text-2xl font-bold">{summary.overdue}</p></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Invoice register", desc: "All invoices with customer & tax", action: exportInvoices },
          { title: "Payment / collections", desc: "Receipts by method", action: exportPayments },
          { title: "Tax report", desc: "VAT / tax collected on posted invoices", action: exportTax },
          { title: "Aging report", desc: "Open AR by bucket (current … 90+)", action: exportAging },
          { title: "Profitability / collection", desc: "Billed vs collected vs open by invoice", action: exportProfitability },
        ].map((r) => (
          <Card key={r.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-teal-700" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{r.desc}</p>
              <Button size="sm" variant="outline" onClick={r.action}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
