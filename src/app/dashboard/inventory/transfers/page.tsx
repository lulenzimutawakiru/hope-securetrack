"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function TransfersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; product_code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_warehouse_id: "",
    to_warehouse_id: "",
    product_id: "",
    qty: "1",
    batch_number: "",
    reason: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: wh }, { data: prod }] = await Promise.all([
      supabase
        .from("stock_transfers")
        .select(
          "*, from_wh:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_wh:warehouses!stock_transfers_to_warehouse_id_fkey(name)"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("warehouses").select("id,name").eq("is_active", true),
      supabase
        .from("products")
        .select("id,name,product_code")
        .eq("is_active", true)
        .order("name")
        .limit(200),
    ]);
    setRows(data ?? []);
    setWarehouses(wh ?? []);
    setProducts(prod ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (
      !form.from_warehouse_id ||
      !form.to_warehouse_id ||
      form.from_warehouse_id === form.to_warehouse_id
    ) {
      toast.error("Select different from/to warehouses");
      return;
    }
    const supabase = createClient();
    const num = `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const product = products.find((p) => p.id === form.product_id);
    const qty = Number(form.qty || 0);

    const { data: tr, error } = await supabase
      .from("stock_transfers")
      .insert({
        company_id: auth.profile.company_id,
        transfer_number: num,
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
        status: "in_transit",
        reason: form.reason || null,
        shipped_at: new Date().toISOString(),
        shipped_by: auth.profile.id,
        created_by: auth.profile.id,
      })
      .select("id")
      .single();

    if (error || !tr) {
      toast.error(error?.message ?? "Failed");
      return;
    }

    if (form.product_id) {
      await supabase.from("stock_transfer_lines").insert({
        transfer_id: tr.id,
        company_id: auth.profile.company_id,
        product_id: form.product_id,
        item_description: product?.name,
        batch_number: form.batch_number || null,
        qty_sent: qty,
      });

      // Decrement source balance if exists
      const { data: bal } = await supabase
        .from("stock_balances")
        .select("id, quantity_on_hand, unit_cost, total_value")
        .eq("product_id", form.product_id)
        .eq("warehouse_id", form.from_warehouse_id)
        .gt("quantity_on_hand", 0)
        .limit(1)
        .maybeSingle();

      if (bal && Number(bal.quantity_on_hand) >= qty) {
        const newQty = Number(bal.quantity_on_hand) - qty;
        await supabase
          .from("stock_balances")
          .update({
            quantity_on_hand: newQty,
            total_value: newQty * Number(bal.unit_cost || 0),
            last_movement_at: new Date().toISOString(),
          })
          .eq("id", bal.id);
      }

      await supabase.from("inventory_movements").insert({
        company_id: auth.profile.company_id,
        movement_type: "warehouse_transfer",
        item_type: "product",
        product_id: form.product_id,
        batch_number: form.batch_number || null,
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
        quantity: Math.round(qty),
        qty_decimal: qty,
        document_type: "transfer",
        document_id: tr.id,
        reference_number: num,
        performed_by: auth.profile.id,
        notes: form.reason || "Inter-warehouse transfer",
      });
    }

    toast.success(`Transfer ${num} shipped`);
    setOpen(false);
    load();
  };

  const receiveTransfer = async (id: string) => {
    if (!auth) return;
    const supabase = createClient();
    const { data: tr } = await supabase
      .from("stock_transfers")
      .select("*")
      .eq("id", id)
      .single();
    if (!tr) return;

    const { data: tlines } = await supabase
      .from("stock_transfer_lines")
      .select("*")
      .eq("transfer_id", id);

    for (const line of tlines ?? []) {
      if (!line.product_id) continue;
      const qty = Number(line.qty_sent || 0);
      const cost = Number(line.unit_cost || 0);
      await supabase.from("stock_balances").insert({
        company_id: auth.profile.company_id,
        product_id: line.product_id,
        warehouse_id: tr.to_warehouse_id,
        batch_number: line.batch_number,
        quantity_on_hand: qty,
        unit_cost: cost,
        total_value: qty * cost,
        last_movement_at: new Date().toISOString(),
      });
      await supabase
        .from("stock_transfer_lines")
        .update({ qty_received: qty })
        .eq("id", line.id);
    }

    await supabase
      .from("stock_transfers")
      .update({
        status: "received",
        received_at: new Date().toISOString(),
        received_by: auth.profile.id,
      })
      .eq("id", id);

    toast.success("Transfer received into destination warehouse");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        description="Move inventory between warehouses, factories, and distribution centres"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New transfer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inter-warehouse transfer</DialogTitle>
                </DialogHeader>
                <form onSubmit={createTransfer} className="space-y-3">
                  <div className="space-y-1">
                    <Label>From warehouse</Label>
                    <Select
                      value={form.from_warehouse_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, from_warehouse_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Source" />
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
                    <Label>To warehouse</Label>
                    <Select
                      value={form.to_warehouse_id}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, to_warehouse_id: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Destination" />
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.qty}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, qty: e.target.value }))
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
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reason: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Ship transfer</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="No transfers"
          description="Move stock between warehouses and DCs"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer #</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const fromWh = r.from_wh as { name?: string } | null;
                const toWh = r.to_wh as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.transfer_number)}
                    </TableCell>
                    <TableCell>{fromWh?.name ?? "—"}</TableCell>
                    <TableCell>{toWh?.name ?? "—"}</TableCell>
                    <TableCell>
                      {r.transfer_date
                        ? formatDate(String(r.transfer_date))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell>
                      {r.status === "in_transit" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => receiveTransfer(String(r.id))}
                        >
                          Receive
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
