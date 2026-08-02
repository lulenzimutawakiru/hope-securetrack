"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Plus, Printer, Check, Send, CreditCard, Trash2, Eye, Sparkles,
  Copy, RotateCcw, Ban, Mail,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import {
  INVOICE_TYPES,
  PAYMENT_METHODS,
  createInvoice,
  createInvoiceFromSalesOrder,
  approveInvoice,
  recordPayment,
  buildInvoiceHtml,
  printInvoiceHtml,
  computeInvoiceTotals,
  duplicateInvoice,
  reverseInvoice,
  cancelInvoice,
  bulkApproveInvoices,
  emailInvoiceNotice,
  checkCredit,
  type BillLineInput,
} from "@/lib/billing";

type Inv = {
  id: string;
  invoice_number: string;
  invoice_type?: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  amount_paid: number;
  balance_due?: number;
  withholding_tax?: number;
  shipping_amount?: number;
  notes: string | null;
  bank_details?: string | null;
  terms_conditions?: string | null;
  payment_terms_label?: string | null;
  po_number?: string | null;
  qr_public_id?: string | null;
  tax_breakdown?: unknown;
  customer_id: string | null;
  customers?: {
    name: string;
    billing_address?: string;
    tax_id?: string;
    vat_number?: string;
    email?: string;
  } | null;
};

export default function BillingInvoicesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Inv[]>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; customer_id: string | null; status: string }>>([]);
  const [taxCodes, setTaxCodes] = useState<Array<{ tax_code: string; name: string; rate: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Inv | null>(null);
  const [lines, setLines] = useState<Array<{ id?: string; description: string | null; quantity: number; unit: string | null; unit_price: number; tax_rate: number; discount_pct?: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    customer_id: "",
    invoice_type: "tax",
    currency: "UGX",
    payment_terms_days: "30",
    po_number: "",
    notes: "",
    from_order: "",
    shipping_amount: "0",
    withholding_rate: "0",
  });
  const [lineForm, setLineForm] = useState<BillLineInput[]>([
    { description: "", quantity: 1, unit: "ea", unit_price: 0, tax_code: "VAT18", tax_rate: 18, discount_pct: 0 },
  ]);
  const [payForm, setPayForm] = useState({
    invoice_id: "",
    amount: "",
    method: "bank_transfer",
    reference: "",
    msisdn: "",
    cheque_number: "",
    cheque_bank: "",
    pos_terminal_id: "",
    wallet_provider: "",
    bank_name: "",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    const supabase = createClient();
    const [{ data: inv }, { data: cust }, { data: so }, { data: tax }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, customers(name,billing_address,tax_id,vat_number,email)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("customers").select("*").eq("is_active", true).order("name").limit(300),
      supabase
        .from("sales_orders")
        .select("id,order_number,customer_id,status")
        .in("status", ["confirmed", "dispatched", "completed", "invoiced"])
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("bill_tax_codes").select("tax_code,name,rate").eq("is_active", true),
    ]);
    setRows((inv as Inv[]) ?? []);
    setCustomers(cust ?? []);
    setOrders(so ?? []);
    setTaxCodes(tax ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const previewTotals = useMemo(
    () =>
      computeInvoiceTotals(lineForm, {
        shipping_amount: Number(form.shipping_amount) || 0,
        withholding_rate: Number(form.withholding_rate) || 0,
        taxCodes: taxCodes.map((t) => ({
          tax_code: t.tax_code,
          name: t.name,
          tax_type: "vat",
          rate: t.rate,
        })),
      }),
    [lineForm, form.shipping_amount, form.withholding_rate, taxCodes]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (form.from_order) {
        await createInvoiceFromSalesOrder(
          supabase,
          auth.profile.company_id,
          form.from_order,
          auth.profile.id
        );
        toast.success("Invoice created from sales order");
      } else {
        if (!form.customer_id) throw new Error("Select a customer");
        const validLines = lineForm.filter((l) => l.description.trim());
        if (!validLines.length) throw new Error("Add at least one line");
        const credit = await checkCredit(
          supabase,
          auth.profile.company_id,
          form.customer_id,
          previewTotals.total_amount
        );
        if (!credit.allowed) {
          throw new Error(
            `Credit blocked: ${credit.reasons.join("; ") || "limit exceeded"}`
          );
        }
        if (credit.warning) toast.message(credit.warning);
        const cust = customers.find((c) => c.id === form.customer_id) as Record<string, unknown> | undefined;
        await createInvoice(supabase, {
          company_id: auth.profile.company_id,
          customer_id: form.customer_id,
          invoice_type: form.invoice_type,
          currency: form.currency,
          payment_terms_days: Number(form.payment_terms_days) || 30,
          po_number: form.po_number || undefined,
          notes: form.notes || undefined,
          billing_address: String(cust?.billing_address || ""),
          delivery_address: String(cust?.shipping_address || ""),
          customer_tax_id: String(cust?.tax_id || ""),
          customer_vat_number: String(cust?.vat_number || ""),
          shipping_amount: Number(form.shipping_amount) || 0,
          withholding_rate: Number(form.withholding_rate) || 0,
          lines: validLines,
          created_by: auth.profile.id,
          status: "draft",
        });
        toast.success("Invoice created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    try {
      const supabase = createClient();
      await approveInvoice(supabase, id, auth?.profile?.id);
      toast.success("Invoice approved / issued");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const markSent = async (inv: Inv) => {
    try {
      const supabase = createClient();
      const crudRes3 = await crudUpdate("invoices", inv.id, {
          sent_at: new Date().toISOString(),
          sent_via: "email",
          updated_at: new Date().toISOString(),
        });
      const crudRes2 = await crudCreate("bill_delivery_logs", {
        company_id: auth?.profile?.company_id,
        invoice_id: inv.id,
        channel: "email",
        recipient: inv.customers?.email || "customer",
        status: "sent",
      });
      toast.success("Marked as delivered to customer");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const printInv = async (inv: Inv) => {
    try {
      const supabase = createClient();
      const { data: ls } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", inv.id)
        .order("sort_order");
      const html = buildInvoiceHtml({
        invoice_number: inv.invoice_number,
        invoice_type: inv.invoice_type,
        status: inv.status,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        currency: inv.currency,
        customer_name: inv.customers?.name,
        customer_address: inv.customers?.billing_address,
        customer_tax_id: inv.customers?.tax_id,
        customer_vat: inv.customers?.vat_number,
        payment_terms_label: inv.payment_terms_label,
        po_number: inv.po_number,
        lines: (ls || []).map((l) => ({
          description: l.description || "",
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount_pct: l.discount_pct,
          line_total:
            Number(l.quantity) *
            Number(l.unit_price) *
            (1 - Number(l.discount_pct || 0) / 100) *
            (1 + Number(l.tax_rate || 0) / 100),
        })),
        subtotal: inv.subtotal,
        discount_amount: inv.discount_amount,
        tax_amount: inv.tax_amount,
        withholding_tax: inv.withholding_tax,
        shipping_amount: inv.shipping_amount,
        total_amount: inv.total_amount,
        amount_paid: inv.amount_paid,
        balance_due:
          inv.balance_due ??
          Number(inv.total_amount) - Number(inv.amount_paid || 0),
        tax_breakdown: (inv.tax_breakdown as never) || [],
        notes: inv.notes,
        bank_details: inv.bank_details,
        terms_conditions: inv.terms_conditions,
        qr_public_id: inv.qr_public_id,
      });
      printInvoiceHtml(html);
      toast.success("Print dialog opened");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const openPay = (inv: Inv) => {
    setPayForm({
      invoice_id: inv.id,
      amount: String(
        Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid || 0))
      ),
      method: "bank_transfer",
      reference: "",
      msisdn: "",
      cheque_number: "",
      cheque_bank: "",
      pos_terminal_id: "",
      wallet_provider: "",
      bank_name: "",
    });
    setPayOpen(true);
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await recordPayment(supabase, {
        company_id: auth.profile.company_id,
        invoice_id: payForm.invoice_id,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
        mobile_money_msisdn: payForm.msisdn || undefined,
        recorded_by: auth.profile.id,
        cheque_number: payForm.cheque_number || undefined,
        cheque_bank: payForm.cheque_bank || undefined,
        pos_terminal_id: payForm.pos_terminal_id || undefined,
        wallet_provider: payForm.wallet_provider || undefined,
        bank_name: payForm.bank_name || undefined,
      });
      toast.success("Payment recorded");
      setPayOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const view = async (inv: Inv) => {
    const supabase = createClient();
    const { data: ls } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id);
    setSelected(inv);
    setLines(ls ?? []);
    setViewOpen(true);
  };

  const voidInv = async (id: string) => {
    if (!confirm("Void this invoice?")) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("invoices", id, {
        status: "void",
        voided_at: new Date().toISOString(),
        void_reason: "Voided from billing console",
        updated_at: new Date().toISOString(),
      });
    toast.success("Invoice voided");
    await load();
  };

  const dup = async (id: string) => {
    try {
      const supabase = createClient();
      const inv = await duplicateInvoice(supabase, id, auth?.profile?.id);
      toast.success(`Duplicated as ${inv.invoice_number}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const reverse = async (id: string) => {
    if (!confirm("Create credit note reversal for this invoice?")) return;
    try {
      const supabase = createClient();
      const inv = await reverseInvoice(supabase, id, auth?.profile?.id);
      toast.success(`Reversal credit ${inv.invoice_number} created`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reverse failed");
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this invoice?")) return;
    try {
      const supabase = createClient();
      await cancelInvoice(supabase, id, "Cancelled from console");
      toast.success("Invoice cancelled");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const emailInv = async (inv: Inv) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      await emailInvoiceNotice(supabase, {
        company_id: auth.profile.company_id,
        invoice_id: inv.id,
        customer_id: inv.customer_id,
        recipient: inv.customers?.email || "customer",
        invoice_number: inv.invoice_number,
        total: inv.total_amount,
        currency: inv.currency,
        due_date: inv.due_date,
      });
      toast.success("Invoice email queued/sent");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Email failed");
    }
  };

  const bulkApprove = async () => {
    if (!selectedIds.length) return;
    try {
      const supabase = createClient();
      await bulkApproveInvoices(supabase, selectedIds, auth?.profile?.id);
      toast.success(`Approved ${selectedIds.length} invoices`);
      setSelectedIds([]);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk approve failed");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.invoice_number.toLowerCase().includes(s) ||
      (r.customers?.name || "").toLowerCase().includes(s) ||
      (r.invoice_type || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading invoices…" />;

  const openAr = rows
    .filter((r) => !["paid", "void", "cancelled"].includes(r.status))
    .reduce((s, r) => s + (Number(r.total_amount) - Number(r.amount_paid || 0)), 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Standard · tax · proforma · export · commercial — full AR lifecycle · CRUD+"
        actions={
          <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={bulkApprove}>
                <Check className="h-4 w-4 mr-1" /> Approve {selectedIds.length}
              </Button>
            )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create invoice</DialogTitle>
              </DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>From sales order (optional)</Label>
                  <Select
                    value={form.from_order || "_none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, from_order: v === "_none" ? "" : v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Manual entry —</SelectItem>
                      {orders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!form.from_order && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Customer *</Label>
                        <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={String(c.id)} value={String(c.id)}>
                                {String(c.code)} · {String(c.name)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={form.invoice_type} onValueChange={(v) => setForm((f) => ({ ...f, invoice_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INVOICE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Currency</Label>
                        <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["UGX", "USD", "KES", "EUR", "GBP"].map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Terms (days)</Label>
                        <Input value={form.payment_terms_days} onChange={(e) => setForm((f) => ({ ...f, payment_terms_days: e.target.value }))} />
                      </div>
                      <div>
                        <Label>PO number</Label>
                        <Input value={form.po_number} onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Lines</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setLineForm((ls) => [
                              ...ls,
                              { description: "", quantity: 1, unit: "ea", unit_price: 0, tax_code: "VAT18", tax_rate: 18, discount_pct: 0 },
                            ])
                          }
                        >
                          Add line
                        </Button>
                      </div>
                      {lineForm.map((l, i) => (
                        <div key={i} className="grid grid-cols-12 gap-1 items-end">
                          <div className="col-span-4">
                            <Input
                              placeholder="Description"
                              value={l.description}
                              onChange={(e) =>
                                setLineForm((ls) =>
                                  ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                                )
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              placeholder="Qty"
                              value={l.quantity}
                              onChange={(e) =>
                                setLineForm((ls) =>
                                  ls.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x))
                                )
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              placeholder="Price"
                              value={l.unit_price}
                              onChange={(e) =>
                                setLineForm((ls) =>
                                  ls.map((x, j) => (j === i ? { ...x, unit_price: Number(e.target.value) } : x))
                                )
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Select
                              value={l.tax_code || "VAT18"}
                              onValueChange={(v) => {
                                const tc = taxCodes.find((t) => t.tax_code === v);
                                setLineForm((ls) =>
                                  ls.map((x, j) =>
                                    j === i
                                      ? { ...x, tax_code: v, tax_rate: tc?.rate ?? 18 }
                                      : x
                                  )
                                );
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(taxCodes.length ? taxCodes : [{ tax_code: "VAT18", name: "VAT 18%", rate: 18 }]).map((t) => (
                                  <SelectItem key={t.tax_code} value={t.tax_code}>{t.tax_code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              placeholder="Disc %"
                              value={l.discount_pct || 0}
                              onChange={(e) =>
                                setLineForm((ls) =>
                                  ls.map((x, j) => (j === i ? { ...x, discount_pct: Number(e.target.value) } : x))
                                )
                              }
                            />
                          </div>
                        </div>
                      ))}
                      <div className="text-sm text-right text-muted-foreground space-y-0.5">
                        <div>Subtotal: {formatNumber(previewTotals.subtotal)}</div>
                        <div>Tax: {formatNumber(previewTotals.tax_amount)}</div>
                        <div className="font-semibold text-foreground">
                          Total: {formatNumber(previewTotals.total_amount)} {form.currency}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Shipping</Label>
                        <Input value={form.shipping_amount} onChange={(e) => setForm((f) => ({ ...f, shipping_amount: e.target.value }))} />
                      </div>
                      <div>
                        <Label>WHT rate %</Label>
                        <Input value={form.withholding_rate} onChange={(e) => setForm((f) => ({ ...f, withholding_rate: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Creating…" : "Create draft"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Invoices" value={String(rows.length)} icon={FileText} />
        <StatCard title="Open AR" value={formatNumber(Math.round(openAr))} icon={CreditCard} />
        <StatCard title="Paid" value={String(rows.filter((r) => r.status === "paid").length)} icon={Check} />
        <StatCard title="Draft" value={String(rows.filter((r) => r.status === "draft").length)} icon={Sparkles} />
      </div>

      <Input className="max-w-md mb-4" placeholder="Search invoice #, customer, type…" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState title="No invoices" description="Create a manual invoice or generate from a sales order." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => {
                const bal = Number(inv.balance_due ?? Number(inv.total_amount) - Number(inv.amount_paid || 0));
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        aria-label={`Select ${inv.invoice_number}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.customers?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{inv.invoice_type || "standard"}</TableCell>
                    <TableCell className="text-xs">{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-xs">{inv.due_date ? formatDate(inv.due_date) : "—"}</TableCell>
                    <TableCell className="text-xs">{inv.currency} {formatNumber(inv.total_amount)}</TableCell>
                    <TableCell className="text-xs font-medium">{formatNumber(bal)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" title="View" onClick={() => view(inv)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="Print" onClick={() => printInv(inv)}><Printer className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="Duplicate" onClick={() => dup(inv.id)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" title="Email" onClick={() => emailInv(inv)}><Mail className="h-3.5 w-3.5" /></Button>
                      {inv.status === "draft" && (
                        <Button size="sm" variant="outline" title="Approve" onClick={() => approve(inv.id)}><Check className="h-3.5 w-3.5" /></Button>
                      )}
                      {["issued", "partially_paid", "overdue"].includes(inv.status) && (
                        <>
                          <Button size="sm" variant="outline" title="Mark sent" onClick={() => markSent(inv)}><Send className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" title="Collect payment" onClick={() => openPay(inv)}><CreditCard className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="outline" title="Reverse" onClick={() => reverse(inv.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                      {["draft", "issued"].includes(inv.status) && Number(inv.amount_paid || 0) === 0 && (
                        <Button size="sm" variant="ghost" title="Cancel" onClick={() => cancel(inv.id)}><Ban className="h-3.5 w-3.5" /></Button>
                      )}
                      {!["paid", "void", "cancelled"].includes(inv.status) && (
                        <Button size="sm" variant="ghost" title="Void" onClick={() => voidInv(inv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <form onSubmit={pay} className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            {(payForm.method.includes("momo") || payForm.method.includes("airtel") || payForm.method === "mobile_money") && (
              <div>
                <Label>Mobile Money number</Label>
                <Input value={payForm.msisdn} onChange={(e) => setPayForm((f) => ({ ...f, msisdn: e.target.value }))} placeholder="2567…" />
              </div>
            )}
            {payForm.method === "cheque" && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cheque #</Label><Input value={payForm.cheque_number} onChange={(e) => setPayForm((f) => ({ ...f, cheque_number: e.target.value }))} /></div>
                <div><Label>Bank</Label><Input value={payForm.cheque_bank} onChange={(e) => setPayForm((f) => ({ ...f, cheque_bank: e.target.value }))} /></div>
              </div>
            )}
            {payForm.method === "pos" && (
              <div><Label>POS terminal</Label><Input value={payForm.pos_terminal_id} onChange={(e) => setPayForm((f) => ({ ...f, pos_terminal_id: e.target.value }))} /></div>
            )}
            {payForm.method === "wallet" && (
              <div><Label>Wallet provider</Label><Input value={payForm.wallet_provider} onChange={(e) => setPayForm((f) => ({ ...f, wallet_provider: e.target.value }))} /></div>
            )}
            {payForm.method === "bank_transfer" && (
              <div><Label>Bank name</Label><Input value={payForm.bank_name} onChange={(e) => setPayForm((f) => ({ ...f, bank_name: e.target.value }))} /></div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Post payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p><strong>Customer:</strong> {selected.customers?.name}</p>
              <p><strong>Status:</strong> {selected.status}</p>
              <p><strong>Total:</strong> {selected.currency} {formatNumber(selected.total_amount)}</p>
              <p><strong>Paid:</strong> {formatNumber(selected.amount_paid)}</p>
              <div className="border rounded p-2 max-h-40 overflow-y-auto">
                {lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span>{l.description}</span>
                    <span>{l.quantity} × {formatNumber(l.unit_price)}</span>
                  </div>
                ))}
              </div>
              <Button size="sm" onClick={() => printInv(selected)}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
