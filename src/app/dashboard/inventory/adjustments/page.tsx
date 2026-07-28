"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Plus } from "lucide-react";
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

const ADJ_TYPES = [
  "cycle_count",
  "write_off",
  "damage",
  "theft",
  "found",
  "revaluation",
  "correction",
  "other",
] as const;

export default function AdjustmentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; product_code: string; average_cost: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: "",
    product_id: "",
    adjustment_type: "correction",
    qty_delta: "0",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: wh }, { data: prod }] = await Promise.all([
      supabase
        .from("stock_adjustments")
        .select("*, warehouses(name), stock_adjustment_lines(*)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase
        .from("products")
        .select("id,name,product_code,average_cost,standard_cost")
        .eq("is_active", true)
        .order("name")
        .limit(200),
    ]);
    setRows(data ?? []);
    setWarehouses(wh ?? []);
    setProducts((prod as typeof products) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!form.warehouse_id || !form.product_id) {
      toast.error("Warehouse and product required");
      return;
    }
    const delta = Number(form.qty_delta);
    if (!delta) {
      toast.error("Quantity delta cannot be zero");
      return;
    }

    const supabase = createClient();
    const num = `ADJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const product = products.find((p) => p.id === form.product_id);
    const cost = Number(product?.average_cost || 0);

    const { data: bal } = await supabase
      .from("stock_balances")
      .select("id, quantity_on_hand, unit_cost, total_value")
      .eq("product_id", form.product_id)
      .eq("warehouse_id", form.warehouse_id)
      .limit(1)
      .maybeSingle();

    const qtyBefore = Number(bal?.quantity_on_hand || 0);
    const qtyAfter = qtyBefore + delta;
    if (qtyAfter < 0) {
      toast.error("Adjustment would make stock negative");
      return;
    }

    const { data: adj, error } = await supabase
      .from("stock_adjustments")
      .insert({
        company_id: auth.profile.company_id,
        adjustment_number: num,
        warehouse_id: form.warehouse_id,
        adjustment_type: form.adjustment_type,
        status: "posted",
        reason: form.reason || null,
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
        created_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (error || !adj) {
      toast.error(error?.message ?? "Failed");
      return;
    }

    await supabase.from("stock_adjustment_lines").insert({
      adjustment_id: adj.id,
      company_id: auth.profile.company_id,
      product_id: form.product_id,
      item_description: product?.name,
      qty_before: qtyBefore,
      qty_after: qtyAfter,
      qty_delta: delta,
      unit_cost: cost,
      notes: form.reason || null,
    });

    if (bal) {
      await supabase
        .from("stock_balances")
        .update({
          quantity_on_hand: qtyAfter,
          total_value: qtyAfter * Number(bal.unit_cost || cost),
          last_movement_at: new Date().toISOString(),
        })
        .eq("id", bal.id);
    } else if (delta > 0) {
      await supabase.from("stock_balances").insert({
        company_id: auth.profile.company_id,
        product_id: form.product_id,
        warehouse_id: form.warehouse_id,
        quantity_on_hand: delta,
        unit_cost: cost,
        total_value: delta * cost,
        last_movement_at: new Date().toISOString(),
      });
    }

    await supabase.from("inventory_movements").insert({
      company_id: auth.profile.company_id,
      movement_type: form.adjustment_type,
      item_type: "product",
      product_id: form.product_id,
      to_warehouse_id: delta > 0 ? form.warehouse_id : null,
      from_warehouse_id: delta < 0 ? form.warehouse_id : null,
      quantity: Math.abs(Math.round(delta)),
      qty_decimal: Math.abs(delta),
      unit_cost: cost,
      total_value: Math.abs(delta) * cost,
      document_type: "adjustment",
      document_id: adj.id,
      reference_number: num,
      performed_by: auth.profile.id,
      notes: form.reason || "Stock adjustment",
    });

    toast.success(`Adjustment ${num} posted`);
    setOpen(false);
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Stock Adjustments"
        description="Cycle counts · write-offs · damage · found stock · corrections"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New adjustment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Post stock adjustment</DialogTitle>
                </DialogHeader>
                <form onSubmit={createAdjustment} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Warehouse</Label>
                    <Select
                      value={form.warehouse_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, warehouse_id: v }))
                      }
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
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, product_id: v }))
                      }
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={form.adjustment_type}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, adjustment_type: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADJ_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Qty delta (+/−)</Label>
                      <Input
                        type="number"
                        step="any"
                        value={form.qty_delta}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, qty_delta: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reason: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Post adjustment</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No adjustments"
          description="Post corrections, write-offs, and cycle-count variances"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adj #</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Delta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const wh = r.warehouses as { name?: string } | null;
                const lines = (r.stock_adjustment_lines as Array<{
                  qty_delta?: number;
                }>) ?? [];
                const delta = lines.reduce(
                  (s, l) => s + Number(l.qty_delta || 0),
                  0
                );
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.adjustment_number)}
                    </TableCell>
                    <TableCell>{wh?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize">
                      {String(r.adjustment_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      {r.adjustment_date
                        ? formatDate(String(r.adjustment_date))
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={
                        delta < 0
                          ? "text-red-600 font-medium"
                          : "text-green-700 font-medium"
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {formatNumber(delta)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {String(r.reason ?? "—")}
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
