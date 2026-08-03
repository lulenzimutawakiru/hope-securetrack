"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { useEntityAll, fetchAllPages } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";

const EM = "—";

export default function GrnPage() {
  const { auth } = useUser();
  const queryClient = useQueryClient();
  const [selectedGrn, setSelectedGrn] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: "",
    supplier_name: "",
    purchase_order_ref: "",
    delivery_note_ref: "",
    product_id: "",
    qty_received: "1",
    batch_number: "",
    unit_cost: "",
    notes: "",
  });

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. GRN lines load per selected receipt via an equality
  // filter; product names resolve from the RLS-bound browser client
  // (products.view vs the inventory.view gate here).
  const grnsQ = useEntityAll<Record<string, unknown>>("goods_receipts", {
    sort: "created_at",
    order: "desc",
    max: 100,
  });
  const linesQ = useEntityAll<Record<string, unknown>>(
    "goods_receipt_lines",
    {
      filters: { grn_id: selectedGrn ?? undefined },
      sort: "line_number",
      max: 500,
    },
    { enabled: !!selectedGrn }
  );
  const warehousesQ = useEntityAll<{
    id: string;
    name: string;
    code: string | null;
    is_active: boolean;
  }>("warehouses", { select: "id,name,code,is_active", sort: "name" });
  const productsQ = useQuery({
    queryKey: ["grn", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code,standard_cost")
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
        standard_cost: number;
      }>;
    },
  });

  const rows = grnsQ.data ?? [];
  const lines = linesQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  // Form selects list active warehouses only; row names resolve from the
  // full set so receipts against deactivated sites still display.
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const products = productsQ.data ?? [];
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const loading =
    grnsQ.isPending || warehousesQ.isPending || productsQ.isPending;

  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;
  const warehouseLabel = (id: string | null | undefined) => {
    const w = warehouses.find((x) => x.id === id);
    return w ? (w.code ? `${w.code} · ${w.name}` : w.name) : EM;
  };

  const invalidate = (...entities: string[]) => {
    for (const entity of entities) {
      queryClient.invalidateQueries({ queryKey: entityKeys.entity(entity) });
    }
  };

  const createGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile) return;
    if (!form.warehouse_id || !form.product_id) {
      toast.error("Warehouse and product required");
      return;
    }
    const grnNumber = `GRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const product = products.find((p) => p.id === form.product_id);
    const unitCost = Number(form.unit_cost || product?.standard_cost || 0);
    const qty = Number(form.qty_received || 0);

    const crudRes2 = await crudCreate("goods_receipts", {
      company_id: auth.profile.company_id,
      grn_number: grnNumber,
      warehouse_id: form.warehouse_id,
      supplier_name: form.supplier_name || null,
      purchase_order_ref: form.purchase_order_ref || null,
      delivery_note_ref: form.delivery_note_ref || null,
      status: "pending_inspection",
      notes: form.notes || null,
      received_by: auth.profile.id,
      created_by: auth.profile.id,
    });
    if (!crudRes2.ok) {
      toast.error(crudRes2.error ?? "Failed to create GRN");
      return;
    }
    const grn = crudRes2.data as Record<string, unknown>;

    const crudRes = await crudCreate("goods_receipt_lines", {
      grn_id: grn.id,
      company_id: auth.profile.company_id,
      line_number: 1,
      product_id: form.product_id,
      item_description: product?.name ?? "Item",
      batch_number: form.batch_number || null,
      qty_received: qty,
      qty_ordered: qty,
      unit_cost: unitCost,
      qc_status: "pending",
    });

    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`Created ${grnNumber}`);
      setOpen(false);
      invalidate("goods_receipts", "goods_receipt_lines");
    }
  };

  const acceptLine = async (lineId: string, qty: number) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_grn_line", {
      p_line_id: lineId,
      p_qty_accepted: qty,
      p_bin_id: null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Stock accepted into warehouse");
      invalidate("goods_receipts", "goods_receipt_lines");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Goods Received Notes"
        description="Supplier delivery · batch capture · QC · stock update on acceptance"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New GRN
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create goods receipt</DialogTitle>
                </DialogHeader>
                <form onSubmit={createGrn} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Warehouse</Label>
                    <Select
                      value={form.warehouse_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeWarehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Supplier</Label>
                    <Input
                      value={form.supplier_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, supplier_name: e.target.value }))
                      }
                      placeholder="Supplier name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>PO ref</Label>
                      <Input
                        value={form.purchase_order_ref}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, purchase_order_ref: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Delivery note</Label>
                      <Input
                        value={form.delivery_note_ref}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, delivery_note_ref: e.target.value }))
                        }
                      />
                    </div>
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
                          unit_cost: String(p?.standard_cost ?? ""),
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
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
                      <Label>Qty received</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.qty_received}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, qty_received: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Batch</Label>
                      <Input
                        value={form.batch_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, batch_number: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit cost</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={form.unit_cost}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, unit_cost: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create GRN</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No goods receipts"
          description="Record inbound deliveries from suppliers"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  return (
                    <TableRow
                      key={String(r.id)}
                      className="cursor-pointer"
                      onClick={() => setSelectedGrn(String(r.id))}
                    >
                      <TableCell className="font-mono text-sm">
                        {String(r.grn_number)}
                      </TableCell>
                      <TableCell>
                        {warehouseName(r.warehouse_id as string)}
                      </TableCell>
                      <TableCell>{String(r.supplier_name ?? EM)}</TableCell>
                      <TableCell>
                        {r.receipt_date ? formatDate(String(r.receipt_date)) : EM}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(r.status)} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DocumentActions
                          showLabel={false}
                          size="sm"
                          variant="ghost"
                          doc={async (): Promise<BusinessDocument> => {
                            const glines = await fetchAllPages<
                              Record<string, unknown>
                            >("goods_receipt_lines", {
                              filters: { grn_id: String(r.id) },
                            });
                            return {
                              title: `GRN ${r.grn_number}`,
                              docType: "Goods Received Note",
                              number: String(r.grn_number),
                              date: r.receipt_date
                                ? String(r.receipt_date)
                                : undefined,
                              status: String(r.status),
                              billToLabel: "Supplier",
                              billToName: String(r.supplier_name ?? EM),
                              meta: [
                                {
                                  label: "Warehouse",
                                  value: warehouseLabel(
                                    r.warehouse_id as string
                                  ),
                                },
                                {
                                  label: "PO ref",
                                  value: String(r.purchase_order_ref ?? EM),
                                },
                              ],
                              lines: glines.map((l) => ({
                                description: String(l.item_description),
                                quantity: Number(l.qty_received),
                                unit: String(l.uom || "EA"),
                                unit_price: Number(l.unit_cost || 0),
                                amount:
                                  Number(l.qty_received) *
                                  Number(l.unit_cost || 0),
                              })),
                              notes: r.notes ? String(r.notes) : undefined,
                              footerNote:
                                "Goods received subject to quality inspection. Hope Design Group Ltd.",
                            };
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="font-medium mb-3">
              {selectedGrn ? "GRN lines · QC acceptance" : "Select a GRN"}
            </h3>
            {!selectedGrn ? (
              <p className="text-sm text-muted-foreground">
                Click a GRN to inspect lines and accept into stock.
              </p>
            ) : lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines</p>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => {
                  const prod = productsMap.get(String(l.product_id));
                  const qty =
                    Number(l.qty_received || 0) - Number(l.qty_damaged || 0);
                  return (
                    <div key={String(l.id)} className="rounded border p-3 space-y-2">
                      <div className="flex justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {prod
                              ? `${prod.product_code} ${prod.name}`
                              : String(l.item_description)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Batch {String(l.batch_number ?? EM)} · Received{" "}
                            {formatNumber(Number(l.qty_received))} · Cost{" "}
                            {formatNumber(Number(l.unit_cost))}
                          </div>
                        </div>
                        <StatusBadge status={String(l.qc_status)} />
                      </div>
                      {l.qc_status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => acceptLine(String(l.id), qty)}
                        >
                          Accept {formatNumber(qty)} into stock
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
