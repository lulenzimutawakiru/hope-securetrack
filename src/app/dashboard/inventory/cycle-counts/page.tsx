"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { useEntityAll, fetchAllPages } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";

const EM = "—";

export default function CycleCountsPage() {
  const { auth } = useUser();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [whId, setWhId] = useState("");
  const [notes, setNotes] = useState("Scheduled cycle count");

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Count lines load per selected count via an equality
  // filter; product names resolve from the RLS-bound browser client
  // (products.view vs the inventory.view gate here).
  const countsQ = useEntityAll<Record<string, unknown>>("cycle_counts", {
    sort: "created_at",
    order: "desc",
    max: 50,
  });
  const warehousesQ = useEntityAll<{
    id: string;
    name: string;
    is_active: boolean;
  }>("warehouses", { select: "id,name,is_active", sort: "name" });
  const linesQ = useEntityAll<Record<string, unknown>>(
    "cycle_count_lines",
    {
      filters: { cycle_count_id: selected ?? undefined },
      sort: "created_at",
      max: 500,
    },
    { enabled: !!selected }
  );
  const productsQ = useQuery({
    queryKey: ["cycle-counts", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
      }>;
    },
  });

  const counts = countsQ.data ?? [];
  const lines = linesQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const products = productsQ.data ?? [];
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const productLabel = (id: string | null | undefined) => {
    const p = productsMap.get(id ?? "");
    return p ? `${p.product_code} ${p.name}` : EM;
  };
  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;
  const loading =
    countsQ.isPending || warehousesQ.isPending || productsQ.isPending;

  const invalidate = (...entities: string[]) => {
    for (const entity of entities) {
      queryClient.invalidateQueries({ queryKey: entityKeys.entity(entity) });
    }
  };

  const createCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !whId) return;
    const num = `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const crudRes7 = await crudCreate("cycle_counts", {
      count_number: num,
      warehouse_id: whId,
      status: "counting",
      notes,
    });
    if (!crudRes7.ok) {
      toast.error(crudRes7.error ?? "Failed");
      return;
    }
    const cc = crudRes7.data as Record<string, unknown>;

    // Seed lines from the current on-hand balances (read via the hardened
    // CRUD surface, tenant/company-scoped server-side).
    let bals: Array<Record<string, unknown>> = [];
    try {
      bals = await fetchAllPages<Record<string, unknown>>("stock_balances", {
        filters: { warehouse_id: whId },
        select: "product_id,bin_id,batch_number,quantity_on_hand",
        pageSize: 50,
        max: 50,
      });
    } catch {
      toast.error("Failed to load system quantities");
      return;
    }

    for (const b of bals) {
      const crudRes6 = await crudCreate("cycle_count_lines", {
        cycle_count_id: cc.id,
        product_id: b.product_id,
        bin_id: b.bin_id,
        batch_number: b.batch_number,
        system_qty: b.quantity_on_hand,
      });
      if (!crudRes6.ok) {
        toast.error(crudRes6.error ?? "Failed to add count line");
        break;
      }
    }

    toast.success(`Cycle count ${num} started`);
    setOpen(false);
    setSelected(String(cc.id));
    invalidate("cycle_counts", "cycle_count_lines");
  };

  const saveCount = async (lineId: string, counted: number) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const system = Number(line.system_qty || 0);
    const variance = counted - system;
    const crudRes5 = await crudUpdate("cycle_count_lines", lineId, {
      counted_qty: counted,
      variance,
      counted_by: auth?.profile?.id,
      counted_at: new Date().toISOString(),
    });
    if (!crudRes5.ok) toast.error(crudRes5.error);
    else {
      toast.success(
        variance === 0 ? "Count matches" : `Variance ${variance > 0 ? "+" : ""}${variance}`
      );
      invalidate("cycle_count_lines");
    }
  };

  const completeCount = async (id: string) => {
    // Post variances as adjustments for non-zero lines. Variance lines are
    // read through the CRUD surface and filtered client-side (the engine
    // only supports equality filters).
    let varLines: Array<Record<string, unknown>> = [];
    try {
      const all = await fetchAllPages<Record<string, unknown>>(
        "cycle_count_lines",
        { filters: { cycle_count_id: id }, max: 500 }
      );
      varLines = all.filter(
        (l) => l.variance != null && Number(l.variance) !== 0
      );
    } catch {
      toast.error("Failed to load count lines");
      return;
    }

    const cc = counts.find((c) => c.id === id);
    if (varLines.length && cc) {
      const adjNum = `ADJ-CC-${String(Date.now()).slice(-6)}`;
      const crudRes4 = await crudCreate("stock_adjustments", {
        adjustment_number: adjNum,
        warehouse_id: cc.warehouse_id,
        adjustment_type: "cycle_count",
        status: "posted",
        reason: `Cycle count ${String(cc.count_number)} variances`,
        approved_by: auth?.profile?.id,
        approved_at: new Date().toISOString(),
      });
      if (!crudRes4.ok) throw new Error(crudRes4.error);
      const adj = crudRes4.data as Record<string, unknown>;

      if (adj) {
        for (const vl of varLines) {
          const crudRes3 = await crudCreate("stock_adjustment_lines", {
            adjustment_id: adj.id,
            product_id: vl.product_id,
            batch_number: vl.batch_number,
            bin_id: vl.bin_id,
            qty_before: vl.system_qty,
            qty_after: vl.counted_qty,
            qty_delta: vl.variance,
          });
          if (!crudRes3.ok)
            throw new Error(
              crudRes3.error ?? "Failed to create adjustment line"
            );
          if (vl.product_id && cc.warehouse_id) {
            let bal: Record<string, unknown> | undefined;
            try {
              const bals = await fetchAllPages<Record<string, unknown>>(
                "stock_balances",
                {
                  filters: {
                    product_id: vl.product_id,
                    warehouse_id: cc.warehouse_id,
                  },
                  select: "id,quantity_on_hand,unit_cost",
                  pageSize: 1,
                  max: 1,
                }
              );
              bal = bals[0];
            } catch {
              /* balance lookup is best-effort */
            }
            if (bal) {
              const newQty = Number(vl.counted_qty);
              await crudUpdate("stock_balances", String(bal.id), {
                quantity_on_hand: newQty,
                total_value: newQty * Number(bal.unit_cost || 0),
              });
            }
          }
        }
      }
    }

    const crudRes = await crudUpdate("cycle_counts", id, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (!crudRes.ok) toast.error(crudRes.error);

    toast.success("Cycle count completed; variances posted as adjustments");
    invalidate(
      "cycle_counts",
      "cycle_count_lines",
      "stock_adjustments",
      "stock_adjustment_lines",
      "stock_balances"
    );
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Cycle Counts & Stocktaking"
        description="Full · cycle · scheduled counts · shortages · surpluses · shrinkage"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New count
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start cycle count</DialogTitle>
                </DialogHeader>
                <form onSubmit={createCount} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Warehouse</Label>
                    <Select value={whId} onValueChange={setWhId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Warehouse" />
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
                    <Label>Notes</Label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Load system quantities</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {counts.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No cycle counts"
              description="Start a scheduled or surprise count"
            />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Count #</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counts.map((c) => (
                    <TableRow
                      key={String(c.id)}
                      className="cursor-pointer"
                      onClick={() => setSelected(String(c.id))}
                    >
                      <TableCell className="font-mono text-sm">
                        {String(c.count_number)}
                      </TableCell>
                      <TableCell>{warehouseName(c.warehouse_id as string)}</TableCell>
                      <TableCell>
                        {c.count_date ? formatDate(String(c.count_date)) : EM}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(c.status)} />
                      </TableCell>
                      <TableCell>
                        {["open", "counting"].includes(String(c.status)) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              completeCount(String(c.id));
                            }}
                          >
                            Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-3">
            {selected ? "Count lines (enter physical qty)" : "Select a count"}
          </h3>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              System qty vs counted qty → variance / shrinkage.
            </p>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {lines.map((l) => (
                <div key={String(l.id)} className="rounded border p-3 space-y-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <div>
                      <div className="font-medium">
                        {productLabel(l.product_id as string)}
                      </div>
                      <div className="text-muted-foreground">
                        System: {formatNumber(Number(l.system_qty))}
                        {l.variance != null && (
                          <span
                            className={
                              Number(l.variance) === 0
                                ? " text-green-700"
                                : " text-red-600"
                            }
                          >
                            {" "}
                            · Variance: {formatNumber(Number(l.variance))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {l.counted_qty == null && (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        saveCount(String(l.id), Number(fd.get("qty")));
                      }}
                    >
                      <Input
                        name="qty"
                        type="number"
                        step="any"
                        placeholder="Counted qty"
                        className="h-8"
                        required
                      />
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
