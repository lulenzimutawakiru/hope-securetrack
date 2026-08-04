"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileBarChart, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type ReportKey =
  | "coa"
  | "journals"
  | "ar"
  | "ap"
  | "bank"
  | "assets"
  | "budget";

export default function FinanceReportsPage() {
  const [report, setReport] = useState<ReportKey>("coa");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let data: Array<Record<string, unknown>> | null = null;

      if (report === "coa") {
        const res = await supabase
          .from("chart_of_accounts")
          .select("account_code, account_name, account_type, normal_balance, reporting_group")
          .is("deleted_at", null)
          .order("account_code");
        data = res.data;
      } else if (report === "journals") {
        const res = await supabase
          .from("gl_journals")
          .select("journal_number, journal_type, journal_date, total_debit, total_credit, status")
          .is("deleted_at", null)
          .order("journal_date", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "ar") {
        const res = await supabase
          .from("invoices")
          .select("invoice_number, invoice_date, total_amount, amount_paid, status, customers(name)")
          .order("invoice_date", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "ap") {
        const res = await supabase
          .from("ap_invoices")
          .select("invoice_number, invoice_date, total_amount, amount_paid, status, suppliers(name)")
          .is("deleted_at", null)
          .order("invoice_date", { ascending: false });
        data = res.data;
      } else if (report === "bank") {
        const res = await supabase
          .from("bank_accounts")
          .select("account_code, account_name, bank_name, account_type, current_balance")
          .is("deleted_at", null);
        data = res.data;
      } else if (report === "assets") {
        const res = await supabase
          .from("fixed_assets")
          .select("asset_code, asset_name, acquisition_cost, book_value, status")
          .is("deleted_at", null);
        data = res.data;
      } else {
        const res = await supabase
          .from("budgets")
          .select("budget_code, name, budget_type, total_amount, status")
          .is("deleted_at", null);
        data = res.data;
      }

      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [report]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
    downloadCsv(
      `finance-${report}-${new Date().toISOString().slice(0, 10)}.csv`,
      keys,
      rows.map((r) => keys.map((k) => r[k] as string | number | null))
    );
    toast.success("CSV exported");
  };

  const cards: { key: ReportKey; title: string; desc: string }[] = [
    { key: "coa", title: "Chart of Accounts", desc: "Account register" },
    { key: "journals", title: "Journal Register", desc: "GL postings" },
    { key: "ar", title: "AR Aging / Invoices", desc: "Customer balances" },
    { key: "ap", title: "AP Register", desc: "Supplier invoices" },
    { key: "bank", title: "Cash Position", desc: "Bank balances" },
    { key: "assets", title: "Fixed Asset Register", desc: "NBV & cost" },
    { key: "budget", title: "Budget Report", desc: "Approved budgets" },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Reports"
        description="Trial balance foundation · AR/AP · bank · assets · budgets · CSV export"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((c) => (
          <Card
            key={c.key}
            className={`cursor-pointer ${report === c.key ? "border-hope-teal ring-1 ring-hope-teal/30" : ""}`}
            onClick={() => setReport(c.key)}
          >
            <CardHeader className="pb-1 flex flex-row items-center gap-2 space-y-0">
              <FileBarChart className="h-4 w-4 text-hope-teal" />
              <CardTitle className="text-sm">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{c.desc}</CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {report === "coa" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Group</TableHead>
                  </>
                )}
                {report === "journals" && (
                  <>
                    <TableHead>Journal</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "ar" && (
                  <>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "ap" && (
                  <>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "bank" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </>
                )}
                {report === "assets" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">NBV</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "budget" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => {
                  const cust = r.customers as { name?: string } | null;
                  const sup = r.suppliers as { name?: string } | null;
                  return (
                    <TableRow key={i}>
                      {report === "coa" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.account_code)}
                          </TableCell>
                          <TableCell>{String(r.account_name)}</TableCell>
                          <TableCell className="capitalize">
                            {String(r.account_type).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>{String(r.reporting_group ?? "—")}</TableCell>
                        </>
                      )}
                      {report === "journals" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.journal_number)}
                          </TableCell>
                          <TableCell>
                            {r.journal_date
                              ? formatDate(String(r.journal_date))
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.total_debit))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.total_credit))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "ar" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.invoice_number)}
                          </TableCell>
                          <TableCell>{cust?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.total_amount))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Number(r.total_amount) - Number(r.amount_paid)
                            )}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "ap" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.invoice_number)}
                          </TableCell>
                          <TableCell>{sup?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.total_amount))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Number(r.total_amount) - Number(r.amount_paid)
                            )}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "bank" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.account_code)}
                          </TableCell>
                          <TableCell>{String(r.account_name)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.current_balance))}
                          </TableCell>
                        </>
                      )}
                      {report === "assets" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.asset_code)}
                          </TableCell>
                          <TableCell>{String(r.asset_name)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.acquisition_cost))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.book_value))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "budget" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.budget_code)}
                          </TableCell>
                          <TableCell>{String(r.name)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.total_amount))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
