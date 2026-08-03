"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Ban,
  Eye,
  CreditCard,
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
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/client";
import { apiDelete, apiPost } from "@/lib/api-client";
import { crudUpdate } from "@/lib/api/crud-client";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  currency: string;
  notes: string | null;
  customer_id: string | null;
  sales_order_id: string | null;
  customers?: { name: string; email?: string; phone?: string; address?: string } | null;
  sales_orders?: { order_number: string } | null;
}

interface InvoiceLine {
  id?: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  tax_rate: number;
  line_total?: number;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  status: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const load = async () => {
    const supabase = createClient();
    const [{ data: inv }, { data: so }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, customers(name, email, phone, address), sales_orders(order_number)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("sales_orders")
        .select("id,order_number,customer_id,total_amount,subtotal,tax_amount,status")
        .in("status", ["confirmed", "picking", "dispatched", "completed"])
        .order("created_at", { ascending: false }),
    ]);
    setInvoices((inv as Invoice[]) ?? []);
    setOrders((so as SalesOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const loadLines = async (invoiceId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at");
    setLines((data as InvoiceLine[]) ?? []);
  };

  const buildDoc = (inv: Invoice, invLines: InvoiceLine[]): BusinessDocument => {
    const balance = Number(inv.total_amount) - Number(inv.amount_paid);
    return {
      title: `Invoice ${inv.invoice_number}`,
      docType: "Tax Invoice",
      number: inv.invoice_number,
      date: inv.invoice_date,
      dueDate: inv.due_date ?? undefined,
      status: inv.status,
      currency: inv.currency || "UGX",
      billToLabel: "Bill to",
      billToName: inv.customers?.name ?? "Customer",
      billToMeta: [
        inv.customers?.email,
        inv.customers?.phone,
        inv.customers?.address,
      ].filter(Boolean) as string[],
      meta: [
        {
          label: "Sales order",
          value: inv.sales_orders?.order_number ?? "—",
        },
      ],
      lines: invLines.map((l) => ({
        description: l.description || "Item",
        quantity: l.quantity,
        unit: l.unit || "EA",
        unit_price: l.unit_price,
        amount: Number(l.quantity) * Number(l.unit_price),
      })),
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax_amount),
      total: Number(inv.total_amount),
      amountPaid: Number(inv.amount_paid),
      balance,
      notes: inv.notes ?? undefined,
      footerNote:
        "Thank you for your business. Payment due as stated. SecureTrack ERP.",
    };
  };

  const openView = async (inv: Invoice) => {
    setSelected(inv);
    await loadLines(inv.id);
    setViewOpen(true);
  };

  const openEdit = async (inv: Invoice) => {
    setSelected(inv);
    setEditNotes(inv.notes ?? "");
    setEditDue(inv.due_date ?? "");
    setEditStatus(inv.status);
    await loadLines(inv.id);
    setEditOpen(true);
  };

  const createFromOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    setSaving(true);
    try {
      const res = await apiPost("/api/invoices/issue", {
        sales_order_id: orderId,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Invoice issued");
      setOpen(false);
      setOrderId("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      const res = await crudUpdate("invoices", selected.id, {
        notes: editNotes || null,
        due_date: editDue || null,
        status: editStatus,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Invoice updated");
      setEditOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const voidInvoice = async (inv: Invoice) => {
    if (!confirm(`Void invoice ${inv.invoice_number}?`)) return;
    const res = await crudUpdate("invoices", inv.id, { status: "void" });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Invoice voided");
      load();
    }
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (!["draft", "void", "cancelled"].includes(inv.status)) {
      toast.error("Only draft/void invoices can be deleted. Void issued invoices first.");
      return;
    }
    if (!confirm(`Permanently delete ${inv.invoice_number}?`)) return;
    const res = await apiDelete("/api/invoices/" + encodeURIComponent(inv.id));
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Invoice deleted");
      load();
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoiceId) return;
    setSaving(true);
    try {
      const inv = invoices.find((i) => i.id === payInvoiceId);
      if (!inv) throw new Error("Invoice not found");
      const amount = parseFloat(payAmount);
      if (!amount || amount <= 0) throw new Error("Invalid amount");

      const res = await apiPost(
        `/api/invoices/${encodeURIComponent(payInvoiceId)}/pay`,
        {
          amount,
          method: payMethod,
        }
      );
      if (!res.ok) throw new Error(res.error);

      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmount("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const outstanding = invoices
    .filter((i) => !["paid", "void", "cancelled"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0);

  return (
    <div>
      <PageHeader
        title="Invoicing"
        description="Create · view · edit · void · delete · print · download tax invoices & payments"
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={recordPayment}>
                  <DialogHeader>
                    <DialogTitle>Record payment</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Invoice</Label>
                      <Select value={payInvoiceId} onValueChange={setPayInvoiceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {invoices
                            .filter((i) => !["paid", "void"].includes(i.status))
                            .map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.invoice_number} — balance{" "}
                                {formatNumber(
                                  Number(i.total_amount) - Number(i.amount_paid)
                                )}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["bank_transfer", "mpesa", "cash", "cheque", "card"].map(
                            (m) => (
                              <SelectItem key={m} value={m}>
                                {m.replace(/_/g, " ")}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step="any"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !payInvoiceId}>
                      Save payment
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Invoice from order
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createFromOrder}>
                  <DialogHeader>
                    <DialogTitle>Create invoice</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label>Sales order</Label>
                    <Select value={orderId} onValueChange={setOrderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.order_number} —{" "}
                            {formatNumber(Number(o.total_amount))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !orderId}>
                      Issue invoice
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Invoices" value={formatNumber(invoices.length)} icon={FileText} />
        <StatCard
          title="Outstanding"
          value={formatNumber(Math.round(outstanding))}
        />
        <StatCard
          title="Paid"
          value={formatNumber(invoices.filter((i) => i.status === "paid").length)}
        />
      </div>

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Issue an invoice from a confirmed sales order" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">
                    {i.invoice_number}
                  </TableCell>
                  <TableCell>{i.customers?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {i.sales_orders?.order_number ?? "—"}
                  </TableCell>
                  <TableCell>{formatDate(i.invoice_date)}</TableCell>
                  <TableCell className="text-right">
                    {i.currency} {formatNumber(Number(i.total_amount))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(i.amount_paid))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openView(i)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(i)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DocumentActions
                        showLabel={false}
                        size="sm"
                        variant="ghost"
                        doc={async () => {
                          const supabase = createClient();
                          const { data } = await supabase
                            .from("invoice_lines")
                            .select("*")
                            .eq("invoice_id", i.id);
                          return buildDoc(i, (data as InvoiceLine[]) ?? []);
                        }}
                      />
                      {!["void", "paid"].includes(i.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => voidInvoice(i)}
                          title="Void"
                        >
                          <Ban className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      {["draft", "void", "cancelled"].includes(i.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteInvoice(i)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.invoice_number} — {selected?.customers?.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <StatusBadge status={selected.status} />
                <span className="text-sm text-muted-foreground">
                  {formatDate(selected.invoice_date)}
                  {selected.due_date ? ` · Due ${formatDate(selected.due_date)}` : ""}
                </span>
                <div className="ml-auto">
                  <DocumentActions doc={() => buildDoc(selected, lines)} />
                </div>
              </div>
              <div className="rounded border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => (
                      <TableRow key={l.id ?? idx}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(l.quantity))} {l.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(l.unit_price))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(
                            Number(l.quantity) * Number(l.unit_price)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm space-y-1 text-right">
                <div>Subtotal: {formatNumber(Number(selected.subtotal))}</div>
                <div>Tax: {formatNumber(Number(selected.tax_amount))}</div>
                <div className="font-bold text-base">
                  Total: {selected.currency}{" "}
                  {formatNumber(Number(selected.total_amount))}
                </div>
                <div>
                  Paid: {formatNumber(Number(selected.amount_paid))} · Balance:{" "}
                  {formatNumber(
                    Number(selected.total_amount) - Number(selected.amount_paid)
                  )}
                </div>
              </div>
              {selected.notes && (
                <p className="text-sm text-muted-foreground">Notes: {selected.notes}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Edit {selected?.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "draft",
                      "issued",
                      "partially_paid",
                      "paid",
                      "overdue",
                      "void",
                      "cancelled",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={editDue}
                  onChange={(e) => setEditDue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Payment terms, remarks…"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
