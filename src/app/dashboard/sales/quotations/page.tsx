"use client";

import { useState } from "react";
import { FileSignature, Plus } from "lucide-react";
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
import { useUser } from "@/hooks/use-user";
import { crudCreate, crudDelete, crudUpdate } from "@/lib/api/crud-client";
import { useEntityAll } from "@/hooks/use-entity-all";
import { apiGet } from "@/lib/api-client";
import { DocumentActions } from "@/components/documents/document-actions";
import type { BusinessDocument } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function QuotationsPage() {
  const { auth } = useUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "20",
    unit_price: "2800",
    discount_pct: "0",
    valid_days: "14",
  });

  // Reads flow through the hardened CRUD API (server-derived tenant/company).
  const {
    data: quotesData,
    isPending,
    refetch: refetchQuotes,
  } = useEntityAll<Record<string, unknown>>("quotations", {
    max: 100,
    sort: "created_at",
    order: "desc",
    select: "*, customers(name, email, phone, address)",
  });
  const { data: customersData } = useEntityAll<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  }>(
    "customers",
    { max: 500, sort: "name", filters: { is_active: true } }
  );
  const { data: productsData } = useEntityAll<{ id: string; name: string }>(
    "products",
    { max: 500, sort: "name", filters: { is_active: true } }
  );

  const quotes = quotesData ?? [];
  const customers = customersData ?? [];
  const products = productsData ?? [];

  const buildQuoteDoc = async (
    q: Record<string, unknown>
  ): Promise<BusinessDocument> => {
    const cust = q.customers as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
    } | null;
    const linesRes = await apiGet<{ data: Array<Record<string, unknown>> }>(
      `/api/v2/crud/quotation_lines?filters=${encodeURIComponent(
        JSON.stringify({ quotation_id: String(q.id) })
      )}`
    );
    const lines = (linesRes.ok ? linesRes.data.data : []).map((l) => ({
      description: String(l.description || ""),
      quantity: Number(l.quantity || 0),
      unit: l.unit ? String(l.unit) : undefined,
      unit_price: Number(l.unit_price || 0),
      amount: Number(
        l.line_total ?? Number(l.quantity || 0) * Number(l.unit_price || 0)
      ),
    }));
    return {
      title: `Quotation ${String(q.quote_number)}`,
      docType: "Quotation",
      number: String(q.quote_number),
      date: q.quote_date ? formatDate(String(q.quote_date)) : undefined,
      dueDate: q.valid_until ? formatDate(String(q.valid_until)) : undefined,
      status: String(q.status || "sent"),
      currency: String(q.currency || "UGX"),
      billToLabel: "Quotation to",
      billToName: cust?.name || "Customer",
      billToMeta: [cust?.address, cust?.email, cust?.phone].filter(
        (v): v is string => Boolean(v)
      ),
      meta: [
        { label: "Version", value: String(q.version || "1") },
        { label: "Payment terms", value: String(q.payment_terms || "") },
        { label: "Delivery terms", value: String(q.delivery_terms || "") },
      ].filter((m) => m.value),
      lines,
      subtotal: Number(q.subtotal || 0),
      tax: Number(q.tax_amount || 0),
      total: Number(q.total_amount || 0),
      notes: q.notes
        ? String(q.notes)
        : q.terms_conditions
          ? String(q.terms_conditions)
          : undefined,
      footerNote: "Thank you for your business",
    };
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const qty = parseInt(form.quantity, 10);
    const price = parseFloat(form.unit_price);
    const disc = parseFloat(form.discount_pct) || 0;
    const line = qty * price * (1 - disc / 100);
    const tax = line * 0.18;
    const total = line + tax;
    const valid = new Date();
    valid.setDate(valid.getDate() + parseInt(form.valid_days, 10));
    const num = `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const product = products.find((p) => p.id === form.product_id);

    const quoteRes = await crudCreate("quotations", {
      quote_number: num,
      version: 1,
      customer_id: form.customer_id,
      status: "sent",
      quote_date: new Date().toISOString().slice(0, 10),
      valid_until: valid.toISOString().slice(0, 10),
      currency: "UGX",
      subtotal: line,
      tax_amount: tax,
      discount_amount: qty * price * (disc / 100),
      total_amount: total,
      payment_terms: "Net 30",
      delivery_terms: "Ex-works SecureTrack ERP factory",
      sales_rep_id: auth.profile.id,
    });
    if (!quoteRes.ok) {
      toast.error(quoteRes.error);
      return;
    }
    const quoteId = (quoteRes.data as { id: string }).id;
    const lineRes = await crudCreate("quotation_lines", {
      quotation_id: quoteId,
      product_id: form.product_id || null,
      description: product?.name || "Product",
      quantity: qty,
      unit: "carton",
      unit_price: price,
      discount_pct: disc,
      tax_rate: 18,
    });
    if (!lineRes.ok) {
      await crudDelete("quotations", quoteId);
      toast.error(lineRes.error);
      return;
    }
    toast.success(`Quotation ${num} issued`);
    setOpen(false);
    refetchQuotes();
  };

  const convertToOrder = async (quoteId: string) => {
    if (!auth) return;
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const linesRes = await apiGet<{
      data: Array<Record<string, unknown>>;
    }>(
      `/api/v2/crud/quotation_lines?filters=${encodeURIComponent(
        JSON.stringify({ quotation_id: quoteId })
      )}`
    );
    const lines = linesRes.ok ? linesRes.data.data : [];
    const orderNumber = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const orderRes = await crudCreate("sales_orders", {
      order_number: orderNumber,
      customer_id: quote.customer_id,
      quotation_id: quoteId,
      status: "confirmed",
      order_type: "standard",
      order_date: new Date().toISOString().slice(0, 10),
      subtotal: quote.subtotal,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      currency: "UGX",
      credit_approved: true,
      sales_rep_id: auth.profile.id,
    });
    if (!orderRes.ok) {
      toast.error(orderRes.error);
      return;
    }
    const orderId = (orderRes.data as { id: string }).id;
    if (lines?.length) {
      for (const l of lines) {
        const lineRes = await crudCreate("sales_order_lines", {
          order_id: orderId,
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        });
        if (!lineRes.ok) {
          await crudDelete("sales_orders", orderId);
          toast.error(lineRes.error);
          return;
        }
      }
    }
    await crudUpdate("quotations", quoteId, {
      status: "converted",
      converted_order_id: orderId,
    });
    toast.success(`Converted to ${orderNumber}`);
    refetchQuotes();
  };

  if (isPending) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Branded quotes · validity · tax · discounts · convert to sales order"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New quotation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create quotation</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select
                      value={form.customer_id}
                      onValueChange={(v) => setForm({ ...form, customer_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => setForm({ ...form, product_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        value={form.quantity}
                        onChange={(e) =>
                          setForm({ ...form, quantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        value={form.unit_price}
                        onChange={(e) =>
                          setForm({ ...form, unit_price: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Disc %</Label>
                      <Input
                        type="number"
                        value={form.discount_pct}
                        onChange={(e) =>
                          setForm({ ...form, discount_pct: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={!form.customer_id || !form.product_id}
                  >
                    Issue quote
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {quotes.length === 0 ? (
        <EmptyState icon={FileSignature} title="No quotations" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const cust = q.customers as { name: string } | null;
                return (
                  <TableRow key={String(q.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(q.quote_number)}
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        v{String(q.version)}
                      </span>
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(String(q.quote_date))}</TableCell>
                    <TableCell>
                      {q.valid_until ? formatDate(String(q.valid_until)) : "—"}
                    </TableCell>
                    <TableCell>
                      UGX {formatNumber(Number(q.total_amount || 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(q.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <DocumentActions doc={() => buildQuoteDoc(q)} />
                        {q.status !== "converted" && (
                          <Button
                            size="sm"
                            onClick={() => convertToOrder(String(q.id))}
                          >
                            Convert to order
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
