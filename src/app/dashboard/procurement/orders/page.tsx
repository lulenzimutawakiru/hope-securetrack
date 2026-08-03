"use client";

import { useState } from "react";
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
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";
import { apiPost, apiDelete, apiGet } from "@/lib/api-client";
import { crudUpdate } from "@/lib/api/crud-client";
import { useEntityAll } from "@/hooks/use-entity-all";

export default function PurchaseOrdersPage() {
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

  // Reads flow through the hardened CRUD API (server-derived tenant/company).
  const {
    data: rowsData,
    isPending,
    refetch: refetchOrders,
  } = useEntityAll<Record<string, unknown>>("purchase_orders", {
    max: 100,
    sort: "created_at",
    order: "desc",
    select: "*, suppliers(name, code), warehouses(name)",
  });
  const { data: suppliersData } = useEntityAll<{
    id: string;
    name: string;
    code: string;
  }>("suppliers", {
    max: 500,
    sort: "name",
    filters: { is_active: true },
  });
  const { data: productsData } = useEntityAll<{
    id: string;
    name: string;
    product_code: string;
    standard_cost: number;
  }>("products", {
    max: 200,
    sort: "name",
    select: "id,name,product_code,standard_cost",
    filters: { is_active: true },
  });
  const { data: warehousesData } = useEntityAll<{
    id: string;
    name: string;
  }>("warehouses", {
    max: 500,
    filters: { is_active: true },
  });

  const rows = rowsData ?? [];
  const suppliers = suppliersData ?? [];
  const products = productsData ?? [];
  const warehouses = warehousesData ?? [];

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.product_id) {
      toast.error("Supplier and product required");
      return;
    }
    try {
      const p = products.find((x) => x.id === form.product_id);
      const res = await apiPost<{ po?: { po_number?: string } }>("/api/procurement/orders", {
        supplier_id: form.supplier_id,
        warehouse_id: form.warehouse_id || null,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
        lines: [
          {
            product_id: form.product_id,
            quantity: Number(form.quantity),
            unit_price: Number(form.unit_price || p?.standard_cost || 0),
            description: p?.name ?? "Item",
            uom: "EA",
            tax_rate: 18,
          },
        ],
      });
      if (!res.ok) throw new Error(res.error);
      toast.success(`PO ${res.data?.po?.po_number ?? ""} created`);
      setOpen(false);
      refetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "sent") patch.sent_at = new Date().toISOString();
      if (status === "acknowledged") patch.acknowledged_at = new Date().toISOString();
      const res = await crudUpdate("purchase_orders", id, patch);
      if (!res.ok) throw new Error(res.error);
      toast.success(`PO ${status}`);
      refetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
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
    try {
      const res = await apiDelete(`/api/procurement/orders/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("PO deleted");
      refetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const buildPoDoc = async (r: Record<string, unknown>): Promise<BusinessDocument> => {
    const linesRes = await apiGet<{ data: Array<Record<string, unknown>> }>(
      `/api/v2/crud/purchase_order_lines?filters=${encodeURIComponent(
        JSON.stringify({ po_id: r.id })
      )}`
    );
    const lines = linesRes.ok ? linesRes.data.data : [];
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
      footerNote: "Please acknowledge this purchase order. SecureTrack ERP.",
    };
  };

  if (isPending) return <LoadingState />;

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
