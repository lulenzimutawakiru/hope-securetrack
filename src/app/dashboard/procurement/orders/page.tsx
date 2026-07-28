"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Trash2 } from "lucide-react";
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
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";

export default function PurchaseOrdersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; product_code: string; standard_cost: number }>
  >([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    warehouse_id: "",
    product_id: "",
    quantity: "1",
    unit_price: "",
    expected_date: "",
    notes: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: sup }, { data: prod }, { data: wh }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, suppliers(name, code), warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("suppliers").select("id,name,code").eq("is_active", true).order("name"),
      supabase
        .from("products")
        .select("id,name,product_code,standard_cost")
        .eq("is_active", true)
        .order("name")
        .limit(200),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
    ]);
    setRows(data ?? []);
    setSuppliers(sup ?? []);
    setProducts((prod as typeof products) ?? []);
    setWarehouses(wh ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.supplier_id || !form.product_id) {
      toast.error("Supplier and product required");
      return;
    }
    const p = products.find((x) => x.id === form.product_id);
    const qty = Number(form.quantity);
    const price = Number(form.unit_price || p?.standard_cost || 0);
    const subtotal = qty * price;
    const tax = subtotal * 0.18;
    const supabase = createClient();
    const num = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: auth.profile.company_id,
        po_number: num,
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id || null,
        order_date: new Date().toISOString().slice(0, 10),
        expected_date: form.expected_date || null,
        currency: "UGX",
        subtotal,
        tax_amount: tax,
        total_amount: subtotal + tax,
        status: "approved",
        po_type: "standard",
        payment_terms: "Net 30",
        notes: form.notes || null,
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
        created_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (error || !po) {
      toast.error(error?.message ?? "Failed");
      return;
    }

    await supabase.from("purchase_order_lines").insert({
      po_id: po.id,
      company_id: auth.profile.company_id,
      line_number: 1,
      product_id: form.product_id,
      description: p?.name ?? "Item",
      quantity: qty,
      uom: "EA",
      unit_price: price,
      tax_rate: 18,
      line_total: subtotal,
    });

    toast.success(`PO ${num} created`);
    setOpen(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
    const { error } = await supabase.from("purchase_orders").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`PO ${status}`);
      load();
    }
  };

  const cancelPo = async (id: string, number: string) => {
    if (!confirm(`Cancel purchase order ${number}?`)) return;
    await setStatus(id, "cancelled");
  };

  const deletePo = async (id: string, number: string, status: string) => {
    if (!["draft", "cancelled"].includes(status)) {
      toast.error("Only draft or cancelled POs can be deleted");
      return;
    }
    if (!confirm(`Permanently delete ${number}?`)) return;
    const supabase = createClient();
    await supabase.from("purchase_order_lines").delete().eq("po_id", id);
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("PO deleted");
      load();
    }
  };

  const buildPoDoc = async (r: Record<string, unknown>): Promise<BusinessDocument> => {
    const supabase = createClient();
    const { data: lines } = await supabase
      .from("purchase_order_lines")
      .select("*")
      .eq("po_id", r.id as string);
    const sup = r.suppliers as { name?: string; code?: string } | null;
    return {
      title: `Purchase Order ${r.po_number}`,
      docType: "Purchase Order",
      number: String(r.po_number),
      date: r.order_date ? String(r.order_date) : undefined,
      dueDate: r.expected_date ? String(r.expected_date) : undefined,
      status: String(r.status),
      currency: String(r.currency || "UGX"),
      billToLabel: "Supplier",
      billToName: sup ? `${sup.code} — ${sup.name}` : "Supplier",
      meta: [
        { label: "PO type", value: String(r.po_type || "standard") },
        { label: "Payment terms", value: String(r.payment_terms || "Net 30") },
      ],
      lines: (lines ?? []).map((l) => ({
        description: String(l.description || "Item"),
        quantity: Number(l.quantity),
        unit: String(l.uom || "EA"),
        unit_price: Number(l.unit_price),
        amount: Number(l.line_total || Number(l.quantity) * Number(l.unit_price)),
      })),
      subtotal: Number(r.subtotal || 0),
      tax: Number(r.tax_amount || 0),
      total: Number(r.total_amount || 0),
      notes: r.notes ? String(r.notes) : undefined,
      footerNote: "Please acknowledge this purchase order. Hope Design Group Ltd.",
    };
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Secure POs · sequential numbering · UUID · approval history · supplier acknowledgement"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New PO
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create purchase order</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Supplier</Label>
                    <Select
                      value={form.supplier_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Warehouse (ship to)</Label>
                    <Select
                      value={form.warehouse_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => {
                        const p = products.find((x) => x.id === v);
                        setForm((f) => ({
                          ...f,
                          product_id: v,
                          unit_price: String(p?.standard_cost ?? ""),
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code} — {p.name}
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
                        min="0.0001"
                        step="any"
                        value={form.quantity}
                        onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.unit_price}
                        onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Expected</Label>
                      <Input
                        type="date"
                        value={form.expected_date}
                        onChange={(e) => setForm((f) => ({ ...f, expected_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create & approve</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No purchase orders" description="Create a PO from approved PR or RFQ award" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const sup = r.suppliers as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.po_number)}
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {String(r.public_uuid ?? "").slice(0, 8)}…
                      </div>
                    </TableCell>
                    <TableCell>
                      {sup?.code} — {sup?.name}
                    </TableCell>
                    <TableCell>
                      {r.order_date ? formatDate(String(r.order_date)) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.expected_date ? formatDate(String(r.expected_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(Math.round(Number(r.total_amount)))}
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {String(r.po_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <DocumentActions
                          showLabel={false}
                          size="sm"
                          variant="ghost"
                          doc={() => buildPoDoc(r)}
                        />
                        {r.status === "approved" && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "sent")}>
                            Send
                          </Button>
                        )}
                        {r.status === "sent" && (
                          <Button size="sm" onClick={() => setStatus(String(r.id), "acknowledged")}>
                            Ack
                          </Button>
                        )}
                        {!["cancelled", "received", "closed"].includes(String(r.status)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelPo(String(r.id), String(r.po_number))}
                          >
                            Cancel
                          </Button>
                        )}
                        {["draft", "cancelled"].includes(String(r.status)) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              deletePo(String(r.id), String(r.po_number), String(r.status))
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
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
