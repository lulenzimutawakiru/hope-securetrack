"use client";

import { useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { apiPost } from "@/lib/api-client";
import { useEntityAll } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";
import { toast } from "sonner";

const EM = "—";

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
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    warehouse_id: "",
    product_id: "",
    adjustment_type: "correction",
    qty_delta: "0",
    reason: "",
  });

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Adjustment deltas are computed join-free from the
  // line set grouped client-side; the product picker stays on the
  // RLS-bound browser client (products.view vs inventory.view roles).
  const adjustmentsQ = useEntityAll<Record<string, unknown>>(
    "stock_adjustments",
    { sort: "created_at", order: "desc", max: 100 }
  );
  const linesQ = useEntityAll<Record<string, unknown>>(
    "stock_adjustment_lines",
    { sort: "created_at", order: "desc", max: 500 }
  );
  const warehousesQ = useEntityAll<{ id: string; name: string }>("warehouses", {
    select: "id,name",
    sort: "name",
    filters: { is_active: true },
  });
  const productsQ = useQuery({
    queryKey: ["stock-adjustments", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code,average_cost,standard_cost")
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
        average_cost: number;
      }>;
    },
  });

  const rows = adjustmentsQ.data ?? [];
  const adjustmentLines = linesQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const products = productsQ.data ?? [];
  const linesByAdjustment = new Map<string, Array<Record<string, unknown>>>();
  for (const l of adjustmentLines) {
    const key = String(l.adjustment_id ?? "");
    if (!key) continue;
    const arr = linesByAdjustment.get(key);
    if (arr) arr.push(l);
    else linesByAdjustment.set(key, [l]);
  }
  const loading =
    adjustmentsQ.isPending || linesQ.isPending || warehousesQ.isPending || productsQ.isPending;

  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;

  const createAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.warehouse_id || !form.product_id) {
      toast.error("Warehouse and product required");
      return;
    }
    const delta = Number(form.qty_delta);
    if (!delta) {
      toast.error("Quantity delta cannot be zero");
      return;
    }
    try {
      const res = await apiPost<{ adjustment?: { adjustment_number?: string } }>(
        "/api/inventory/adjustments",
        {
          warehouse_id: form.warehouse_id,
          product_id: form.product_id,
          adjustment_type: form.adjustment_type,
          qty_delta: delta,
          reason: form.reason || null,
        }
      );
      if (!res.ok) throw new Error(res.error);
      toast.success(
        `Adjustment ${res.data?.adjustment?.adjustment_number ?? ""} posted`
      );
      setOpen(false);
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("stock_adjustments"),
      });
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("stock_adjustment_lines"),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
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
                const lines = linesByAdjustment.get(String(r.id)) ?? [];
                const delta = lines.reduce(
                  (s, l) => s + Number(l.qty_delta || 0),
                  0
                );
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.adjustment_number)}
                    </TableCell>
                    <TableCell>{warehouseName(r.warehouse_id as string)}</TableCell>
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
