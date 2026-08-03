"use client";

import { useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { apiPost } from "@/lib/api-client";
import { useEntityAll } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";
import { toast } from "sonner";

const EM = "—";

export default function TransfersPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_warehouse_id: "",
    to_warehouse_id: "",
    product_id: "",
    qty: "1",
    batch_number: "",
    reason: "",
  });

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Warehouse names resolve join-free from the reference
  // set; the product picker stays on the RLS-bound browser client
  // (products.view vs the inventory.view warehouse roles).
  const transfersQ = useEntityAll<Record<string, unknown>>("stock_transfers", {
    sort: "created_at",
    order: "desc",
    max: 100,
  });
  const warehousesQ = useEntityAll<{
    id: string;
    name: string;
    is_active: boolean;
  }>("warehouses", { select: "id,name,is_active", sort: "name" });
  const productsQ = useQuery({
    queryKey: ["stock-transfers", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code")
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        product_code: string;
      }>;
    },
  });

  const rows = transfersQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  // Form selects list active warehouses only; row names resolve from the
  // full set so transfers to deactivated sites still display their names.
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const products = productsQ.data ?? [];
  const loading =
    transfersQ.isPending || warehousesQ.isPending || productsQ.isPending;

  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;

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
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("stock_transfers"),
      });
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
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("stock_transfers"),
      });
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
                        {activeWarehouses.map((w) => (
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
                        {activeWarehouses.map((w) => (
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
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.transfer_number)}
                    </TableCell>
                    <TableCell>{warehouseName(r.from_warehouse_id as string)}</TableCell>
                    <TableCell>{warehouseName(r.to_warehouse_id as string)}</TableCell>
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
