"use client";

import { useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function QuotationsPage() {
  const { auth } = useUser();
  const [quotes, setQuotes] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "20",
    unit_price: "2800",
    discount_pct: "0",
    valid_days: "14",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: q }, { data: c }, { data: p }] = await Promise.all([
      supabase
        .from("quotations")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("id,name").eq("is_active", true),
      supabase.from("products").select("id,name").eq("is_active", true),
    ]);
    setQuotes(q ?? []);
    setCustomers(c ?? []);
    setProducts(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
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

    const { data: quote, error } = await supabase
      .from("quotations")
      .insert({
        company_id: auth.profile.company_id,
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
        delivery_terms: "Ex-works Hope Design factory",
        sales_rep_id: auth.profile.id,
        created_by: auth.profile.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("quotation_lines").insert({
      quotation_id: quote.id,
      product_id: form.product_id || null,
      description: product?.name || "Product",
      quantity: qty,
      unit: "carton",
      unit_price: price,
      discount_pct: disc,
      tax_rate: 18,
    });
    toast.success(`Quotation ${num} issued`);
    setOpen(false);
    load();
  };

  const convertToOrder = async (quoteId: string) => {
    if (!auth) return;
    const supabase = createClient();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const { data: lines } = await supabase
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", quoteId);
    const orderNumber = `SO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { data: order, error } = await supabase
      .from("sales_orders")
      .insert({
        company_id: auth.profile.company_id,
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
        created_by: auth.profile.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (lines?.length) {
      await supabase.from("sales_order_lines").insert(
        lines.map((l) => ({
          order_id: order.id,
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        }))
      );
    }
    await supabase
      .from("quotations")
      .update({ status: "converted", converted_order_id: order.id })
      .eq("id", quoteId);
    toast.success(`Converted to ${orderNumber}`);
    load();
  };

  if (loading) return <LoadingState />;

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
                      {q.status !== "converted" && (
                        <Button
                          size="sm"
                          onClick={() => convertToOrder(String(q.id))}
                        >
                          Convert to order
                        </Button>
                      )}
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
