"use client";

import { useEffect, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CycleCountsPage() {
  const { auth } = useUser();
  const [counts, setCounts] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [whId, setWhId] = useState("");
  const [notes, setNotes] = useState("Scheduled cycle count");

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: wh }] = await Promise.all([
      supabase
        .from("cycle_counts")
        .select("*, warehouses(name)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
    ]);
    setCounts(data ?? []);
    setWarehouses(wh ?? []);
    setLoading(false);
  };

  const loadLines = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("cycle_count_lines")
      .select("*, products(name, product_code)")
      .eq("cycle_count_id", id)
      .order("created_at");
    setLines(data ?? []);
    setSelected(id);
  };

  useEffect(() => {
    load();
  }, []);

  const createCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !whId) return;
    const supabase = createClient();
    const num = `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { data: cc, error } = await supabase
      .from("cycle_counts")
      .insert({
        company_id: auth.profile.company_id,
        count_number: num,
        warehouse_id: whId,
        status: "counting",
        notes,
        created_by: auth.profile.id,
      })
      .select("id")
      .single();
    if (error || !cc) {
      toast.error(error?.message ?? "Failed");
      return;
    }

    const { data: bals } = await supabase
      .from("stock_balances")
      .select("product_id, bin_id, batch_number, quantity_on_hand")
      .eq("warehouse_id", whId)
      .limit(50);

    if (bals?.length) {
      await supabase.from("cycle_count_lines").insert(
        bals.map((b) => ({
          cycle_count_id: cc.id,
          company_id: auth.profile.company_id,
          product_id: b.product_id,
          bin_id: b.bin_id,
          batch_number: b.batch_number,
          system_qty: b.quantity_on_hand,
        }))
      );
    }

    toast.success(`Cycle count ${num} started`);
    setOpen(false);
    load();
    loadLines(cc.id);
  };

  const saveCount = async (lineId: string, counted: number) => {
    if (!auth) return;
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const system = Number(line.system_qty || 0);
    const variance = counted - system;
    const supabase = createClient();
    const { error } = await supabase
      .from("cycle_count_lines")
      .update({
        counted_qty: counted,
        variance,
        counted_by: auth.profile.id,
        counted_at: new Date().toISOString(),
      })
      .eq("id", lineId);
    if (error) toast.error(error.message);
    else {
      toast.success(variance === 0 ? "Count matches" : `Variance ${variance > 0 ? "+" : ""}${variance}`);
      if (selected) loadLines(selected);
    }
  };

  const completeCount = async (id: string) => {
    if (!auth) return;
    const supabase = createClient();
    // Post variances as adjustments for non-zero lines
    const { data: varLines } = await supabase
      .from("cycle_count_lines")
      .select("*")
      .eq("cycle_count_id", id)
      .not("variance", "is", null)
      .neq("variance", 0);

    const cc = counts.find((c) => c.id === id);
    if (varLines?.length && cc) {
      const adjNum = `ADJ-CC-${String(Date.now()).slice(-6)}`;
      const { data: adj } = await supabase
        .from("stock_adjustments")
        .insert({
          company_id: auth.profile.company_id,
          adjustment_number: adjNum,
          warehouse_id: cc.warehouse_id,
          adjustment_type: "cycle_count",
          status: "posted",
          reason: `Cycle count ${String(cc.count_number)} variances`,
          approved_by: auth.profile.id,
          approved_at: new Date().toISOString(),
          created_by: auth.profile.id,
        })
        .select("id")
        .single();

      if (adj) {
        for (const vl of varLines) {
          await supabase.from("stock_adjustment_lines").insert({
            adjustment_id: adj.id,
            company_id: auth.profile.company_id,
            product_id: vl.product_id,
            batch_number: vl.batch_number,
            bin_id: vl.bin_id,
            qty_before: vl.system_qty,
            qty_after: vl.counted_qty,
            qty_delta: vl.variance,
          });
          if (vl.product_id) {
            const { data: bal } = await supabase
              .from("stock_balances")
              .select("id, quantity_on_hand, unit_cost")
              .eq("product_id", vl.product_id)
              .eq("warehouse_id", cc.warehouse_id as string)
              .limit(1)
              .maybeSingle();
            if (bal) {
              const newQty = Number(vl.counted_qty);
              await supabase
                .from("stock_balances")
                .update({
                  quantity_on_hand: newQty,
                  total_value: newQty * Number(bal.unit_cost || 0),
                })
                .eq("id", bal.id);
            }
          }
        }
      }
    }

    await supabase
      .from("cycle_counts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    toast.success("Cycle count completed; variances posted");
    load();
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
                        {warehouses.map((w) => (
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
                  {counts.map((c) => {
                    const wh = c.warehouses as { name?: string } | null;
                    return (
                      <TableRow
                        key={String(c.id)}
                        className="cursor-pointer"
                        onClick={() => loadLines(String(c.id))}
                      >
                        <TableCell className="font-mono text-sm">
                          {String(c.count_number)}
                        </TableCell>
                        <TableCell>{wh?.name ?? "—"}</TableCell>
                        <TableCell>
                          {c.count_date ? formatDate(String(c.count_date)) : "—"}
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
                    );
                  })}
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
              {lines.map((l) => {
                const prod = l.products as { name?: string; product_code?: string } | null;
                return (
                  <div key={String(l.id)} className="rounded border p-3 space-y-2">
                    <div className="flex justify-between gap-2 text-sm">
                      <div>
                        <div className="font-medium">
                          {prod?.product_code} {prod?.name}
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
