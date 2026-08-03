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
import { buildInvoiceHtml, printInvoiceHtml } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Customer portal — token-based, loads via public API (service role server-side).
 * Payments create intents only; real settlement is webhook/sandbox.
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
  const [sandbox, setSandbox] = useState(false);
  const [disputeSubject, setDisputeSubject] = useState("");
  const [disputeBody, setDisputeBody] = useState("");
  const [disputeInvoice, setDisputeInvoice] = useState("");
  const [tab, setTab] = useState<"invoices" | "payments" | "contracts" | "dispute">("invoices");
  const [paying, setPaying] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/public/portal?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setPortalUser(null);
        setLoading(false);
        return;
      }
      setPortalUser(json.portal_user as Record<string, unknown>);
      setInvoices((json.invoices as Array<Record<string, unknown>>) || []);
      setPayments((json.payments as Array<Record<string, unknown>>) || []);
      setContracts((json.contracts as Array<Record<string, unknown>>) || []);
      setSandbox(Boolean(json.payment_sandbox));
    } catch {
      setPortalUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const printInv = (inv: Record<string, unknown>) => {
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
      lines: [],
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
    const balance = Number(inv.total_amount) - Number(inv.amount_paid || 0);
    if (balance <= 0) {
      toast.message("Invoice already paid");
      return;
    }
    setPaying(String(inv.id));
    try {
      const res = await fetch("/api/public/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_intent",
          token,
          invoice_id: inv.id,
          gateway_code: gateway,
          // Only server honors this when PAYMENT_SANDBOX=true
          complete_sandbox: sandbox,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Payment failed");

      if (json.completed_sandbox) {
        toast.success(`Sandbox payment completed via ${gateway}`);
        await load();
      } else {
        toast.message(
          json.message ||
            "Payment intent created. Complete checkout via mobile money / card — not auto-settled."
        );
        if (json.intent?.payment_link) {
          // Optional: open payment link
          window.open(String(json.intent.payment_link), "_blank", "noopener,noreferrer");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(null);
    }
  };

  const submitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalUser || !disputeSubject) return;
    try {
      const res = await fetch("/api/public/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispute",
          token,
          subject: disputeSubject,
          description: disputeBody,
          invoice_id: disputeInvoice || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed");
      toast.success("Dispute submitted");
      setDisputeSubject("");
      setDisputeBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading customer portal…" />;

  if (!portalUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-medium">Invalid or disabled portal link</p>
            <p className="text-sm text-muted-foreground">
              Contact SecureTrack ERP finance for a new access link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openInvoices = invoices.filter(
    (i) => !["paid", "cancelled"].includes(String(i.status))
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Customer portal</p>
            <h1 className="text-lg font-semibold">SecureTrack ERP Billing</h1>
          </div>
          {sandbox && (
            <span className="text-[10px] rounded bg-amber-100 text-amber-900 px-2 py-1 font-medium">
              PAYMENT_SANDBOX
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["invoices", "payments", "contracts", "dispute"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>

        {tab === "invoices" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const bal = Number(inv.total_amount) - Number(inv.amount_paid || 0);
                    return (
                      <TableRow key={String(inv.id)}>
                        <TableCell className="font-mono text-xs">{String(inv.invoice_number)}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(inv.invoice_date))}</TableCell>
                        <TableCell>
                          <StatusBadge status={String(inv.status)} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {String(inv.currency)} {formatNumber(bal)}
                        </TableCell>
                        <TableCell className="space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => printInv(inv)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {bal > 0 && (
                            <Button
                              size="sm"
                              disabled={paying === String(inv.id)}
                              onClick={() => payOnline(inv)}
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              {sandbox ? "Sandbox pay" : "Pay"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                        No invoices
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {openInvoices.length > 0 && !sandbox && (
                <p className="text-xs text-muted-foreground mt-3">
                  Production payments create a gateway intent only. Settlement requires a verified
                  webhook (`BILLING_WEBHOOK_SECRET`).
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "payments" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={String(p.id)}>
                      <TableCell className="text-xs">{formatDate(String(p.payment_date))}</TableCell>
                      <TableCell className="text-xs">{formatNumber(Number(p.amount))}</TableCell>
                      <TableCell className="text-xs">{String(p.method)}</TableCell>
                      <TableCell className="font-mono text-xs">{String(p.reference || "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {tab === "contracts" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contracts</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {contracts.length === 0
                ? "No contracts on file."
                : contracts.map((c) => (
                    <div key={String(c.id)} className="border-b py-2">
                      {String(c.contract_number || c.title)} · {String(c.status)}
                    </div>
                  ))}
            </CardContent>
          </Card>
        )}

        {tab === "dispute" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Open a dispute</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitDispute} className="space-y-3 max-w-md">
                <div>
                  <Label>Subject</Label>
                  <Input
                    required
                    value={disputeSubject}
                    onChange={(e) => setDisputeSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Invoice ID (optional)</Label>
                  <Input
                    value={disputeInvoice}
                    onChange={(e) => setDisputeInvoice(e.target.value)}
                    placeholder="UUID"
                  />
                </div>
                <div>
                  <Label>Details</Label>
                  <Input
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
