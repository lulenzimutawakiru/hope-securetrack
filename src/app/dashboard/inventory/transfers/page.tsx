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
import { formatDate } from "@/lib/utils";
import { apiPost } from "@/lib/api-client";
import { toast } from "sonner";

export default function TransfersPage() {
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
    if (
      !form.from_warehouse_id ||
      !form.to_warehouse_id ||
      form.from_warehouse_id === form.to_warehouse_id
    ) {
      toast.error("Select different from/to warehouses");
      return;
    }
    try {
      const res = await apiPost<{ transfer?: { transfer_number?: string } }>(
        "/api/inventory/transfers",
        {
          from_warehouse_id: form.from_warehouse_id,
          to_warehouse_id: form.to_warehouse_id,
          product_id: form.product_id,
          quantity: Number(form.qty || 0),
          batch_number: form.batch_number || null,
          reason: form.reason || null,
        }
      );
      if (!res.ok) throw new Error(res.error);
      toast.success(
        `Transfer ${res.data?.transfer?.transfer_number ?? ""} shipped`
      );
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const receiveTransfer = async (id: string) => {
    try {
      const res = await apiPost(
        `/api/inventory/transfers/${encodeURIComponent(id)}/receive`
      );
      if (!res.ok) throw new Error(res.error);
      toast.success("Transfer received into destination warehouse");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
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
