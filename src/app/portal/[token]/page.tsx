"use client";

import { useEffect, useState, use } from "react";
import {
  FileText, CreditCard, Download, AlertCircle, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import {
  buildInvoiceHtml,
  printInvoiceHtml,
  createPaymentIntent,
  completePaymentIntent,
} from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Customer portal — view invoices, pay online, history, disputes, statements.
 * Access via /portal/{access_token}
 */
export default function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [portalUser, setPortalUser] = useState<Record<string, unknown> | null>(null);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [contracts, setContracts] = useState<Array<Record<string, unknown>>>([]);
  const [disputeSubject, setDisputeSubject] = useState("");
  const [disputeBody, setDisputeBody] = useState("");
  const [disputeInvoice, setDisputeInvoice] = useState("");
  const [tab, setTab] = useState<"invoices" | "payments" | "contracts" | "dispute">("invoices");

  const load = async () => {
    const supabase = createClient();
    const { data: user } = await supabase
      .from("bill_portal_users")
      .select("*, customers(*)")
      .eq("access_token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) {
      setPortalUser(null);
      setLoading(false);
      return;
    }
    setPortalUser(user);
    await supabase
      .from("bill_portal_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    const customerId = user.customer_id;
    const [{ data: inv }, { data: pays }, { data: ctr }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .not("status", "eq", "void")
        .order("invoice_date", { ascending: false })
        .limit(100),
      supabase
        .from("invoice_payments")
        .select("*, invoices!inner(invoice_number,customer_id)")
        .eq("invoices.customer_id", customerId)
        .order("payment_date", { ascending: false })
        .limit(50),
      supabase
        .from("bill_contracts")
        .select("*")
        .eq("customer_id", customerId)
        .is("deleted_at", null),
    ]);
    setInvoices(inv ?? []);
    setPayments((pays as unknown as Array<Record<string, unknown>>) ?? []);
    setContracts(ctr ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [token]);

  const downloadInvoice = async (inv: Record<string, unknown>) => {
    const supabase = createClient();
    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id);
    const cust = portalUser?.customers as Record<string, unknown> | undefined;
    const html = buildInvoiceHtml({
      invoice_number: String(inv.invoice_number),
      invoice_type: String(inv.invoice_type || "tax"),
      status: String(inv.status),
      invoice_date: String(inv.invoice_date),
      due_date: inv.due_date as string,
      currency: String(inv.currency || "UGX"),
      customer_name: String(cust?.name || ""),
      customer_address: String(cust?.billing_address || ""),
      lines: (lines || []).map((l) => ({
        description: l.description || "",
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
      })),
      subtotal: Number(inv.subtotal),
      tax_amount: Number(inv.tax_amount),
      total_amount: Number(inv.total_amount),
      amount_paid: Number(inv.amount_paid),
      balance_due: Number(inv.total_amount) - Number(inv.amount_paid || 0),
      bank_details: inv.bank_details as string,
      terms_conditions: inv.terms_conditions as string,
      qr_public_id: inv.qr_public_id as string,
    });
    printInvoiceHtml(html);
  };

  const payOnline = async (inv: Record<string, unknown>, gateway = "MTN") => {
    if (!portalUser) return;
    try {
      const supabase = createClient();
      const balance =
        Number(inv.total_amount) - Number(inv.amount_paid || 0);
      if (balance <= 0) {
        toast.message("Invoice already paid");
        return;
      }
      const intent = await createPaymentIntent(supabase, {
        company_id: String(portalUser.company_id),
        invoice_id: String(inv.id),
        customer_id: String(portalUser.customer_id),
        amount: balance,
        currency: String(inv.currency || "UGX"),
        gateway_code: gateway,
      });
      // Demo: complete immediately for MoMo-style sandbox
      await completePaymentIntent(supabase, String(intent.external_ref));
      toast.success(`Payment completed via ${gateway}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    }
  };

  const submitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalUser || !disputeSubject) return;
    try {
      const supabase = createClient();
      const num = `DSP-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("bill_portal_disputes").insert({
        company_id: portalUser.company_id,
        customer_id: portalUser.customer_id,
        invoice_id: disputeInvoice || null,
        dispute_number: num,
        subject: disputeSubject,
        description: disputeBody,
        status: "open",
      });
      if (error) throw error;
      toast.success("Dispute submitted");
      setDisputeSubject("");
      setDisputeBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Opening customer portal…" />;

  if (!portalUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Invalid portal link
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This access token is invalid or disabled. Contact Hope Design Group finance.
          </CardContent>
        </Card>
      </div>
    );
  }

  const cust = portalUser.customers as { name?: string } | null;
  const openAr = invoices
    .filter((i) => !["paid", "cancelled"].includes(String(i.status)))
    .reduce(
      (s, i) => s + Number(i.total_amount) - Number(i.amount_paid || 0),
      0
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-teal-700 font-semibold tracking-wide">HOPE DESIGN GROUP LTD</p>
            <h1 className="text-lg font-bold">Customer Portal</h1>
            <p className="text-sm text-muted-foreground">{cust?.name || String(portalUser.full_name || "")}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold text-teal-800">{formatNumber(Math.round(openAr))} UGX</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              ["invoices", "Invoices"],
              ["payments", "Payments"],
              ["contracts", "Contracts"],
              ["dispute", "Dispute"],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              size="sm"
              variant={tab === k ? "default" : "outline"}
              onClick={() => setTab(k)}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === "invoices" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Your invoices
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const bal =
                      Number(inv.total_amount) - Number(inv.amount_paid || 0);
                    return (
                      <TableRow key={String(inv.id)}>
                        <TableCell className="font-mono text-xs">{String(inv.invoice_number)}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(inv.invoice_date))}</TableCell>
                        <TableCell className="text-xs">
                          {inv.due_date ? formatDate(String(inv.due_date)) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{formatNumber(Number(inv.total_amount))}</TableCell>
                        <TableCell className="text-xs font-medium">{formatNumber(bal)}</TableCell>
                        <TableCell><StatusBadge status={String(inv.status)} /></TableCell>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="outline" onClick={() => downloadInvoice(inv)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {bal > 0 && (
                            <>
                              <Button size="sm" onClick={() => payOnline(inv, "MTN")}>
                                <CreditCard className="h-3.5 w-3.5 mr-1" /> MTN
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => payOnline(inv, "AIRTEL")}>
                                Airtel
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Payment history
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={String(p.id)}>
                      <TableCell className="text-xs">{formatDate(String(p.payment_date))}</TableCell>
                      <TableCell className="font-mono text-xs">{String(p.receipt_number || "—")}</TableCell>
                      <TableCell className="text-xs">{String(p.method)}</TableCell>
                      <TableCell className="text-xs">{formatNumber(Number(p.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "contracts" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Contracts</CardTitle></CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active contracts.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {contracts.map((c) => (
                    <li key={String(c.id)} className="border rounded p-3">
                      <div className="font-medium">{String(c.title)}</div>
                      <div className="text-xs text-muted-foreground font-mono">{String(c.contract_number)}</div>
                      <div className="text-xs mt-1">
                        Value {formatNumber(Number(c.total_value))} · {String(c.status)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "dispute" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Submit dispute</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitDispute} className="space-y-3 max-w-md">
                <div>
                  <Label>Invoice (optional)</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={disputeInvoice}
                    onChange={(e) => setDisputeInvoice(e.target.value)}
                  >
                    <option value="">— General —</option>
                    {invoices.map((i) => (
                      <option key={String(i.id)} value={String(i.id)}>
                        {String(i.invoice_number)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input required value={disputeSubject} onChange={(e) => setDisputeSubject(e.target.value)} />
                </div>
                <div>
                  <Label>Details</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disputeBody}
                    onChange={(e) => setDisputeBody(e.target.value)}
                  />
                </div>
                <Button type="submit">Submit dispute</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
