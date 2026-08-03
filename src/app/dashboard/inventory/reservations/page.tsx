"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Plus } from "lucide-react";
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
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useEntityAll } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";
import { toast } from "sonner";

const EM = "—";
const PURPOSES = ["sales_order", "production", "project", "department", "other"];

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: "1",
    purpose: "sales_order",
    reference_number: "",
    notes: "",
  });

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Product names resolve from the RLS-bound browser
  // client (products.view vs the inventory.view gate here); warehouses come
  // from the CRUD surface. Reserve/release keep the RPC engine, which is
  // tenant-scoped and writes audit rows.
  const rowsQ = useEntityAll<Record<string, unknown>>("stock_reservations", {
    sort: "created_at",
    order: "desc",
    max: 100,
  });
  const approvalsQ = useEntityAll<Record<string, unknown>>(
    "inventory_approvals",
    {
      filters: { document_type: "reservation" },
      sort: "created_at",
      order: "desc",
      max: 30,
    }
  );
  const warehousesQ = useEntityAll<{
    id: string;
    name: string;
    is_active: boolean;
  }>("warehouses", { select: "id,name,is_active", sort: "name" });
  const productsQ = useQuery({
    queryKey: ["reservations", "products-reference"],
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

  const rows = rowsQ.data ?? [];
  const approvals = approvalsQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const products = productsQ.data ?? [];
  const productsMap = new Map(products.map((p) => [p.id, p]));
  const productLabel = (id: string | null | undefined) => {
    const p = productsMap.get(id ?? "");
    return p ? `${p.product_code} ${EM} ${p.name}` : EM;
  };
  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;
  const loading =
    rowsQ.isPending ||
    approvalsQ.isPending ||
    warehousesQ.isPending ||
    productsQ.isPending;

  const invalidateReservations = () =>
    queryClient.invalidateQueries({
      queryKey: entityKeys.entity("stock_reservations"),
    });
  const invalidateApprovals = () =>
    queryClient.invalidateQueries({
      queryKey: entityKeys.entity("inventory_approvals"),
    });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.rpc("reserve_stock", {
      p_product_id: form.product_id,
      p_warehouse_id: form.warehouse_id,
      p_quantity: Number(form.quantity),
      p_purpose: form.purpose,
      p_reference_number: form.reference_number || null,
      p_notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Stock reserved");
      setOpen(false);
      invalidateReservations();
      invalidateApprovals();
    }
  };

  const release = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("release_reservation", {
      p_reservation_id: id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Reservation released");
      invalidateReservations();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Stock Reservations"
        description="Reserve for sales orders · production · projects · departments · auto-release on fulfill/cancel"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Reserve
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reserve inventory</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code} {EM} {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Warehouse</Label>
                    <Select
                      value={form.warehouse_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, warehouse_id: v }))}
                    >
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Quantity</Label>
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
                      <Label>Purpose</Label>
                      <Select
                        value={form.purpose}
                        onValueChange={(v) => setForm((f) => ({ ...f, purpose: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PURPOSES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Reference #</Label>
                    <Input
                      value={form.reference_number}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, reference_number: e.target.value }))
                      }
                      placeholder="SO / MO / Project"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Reserve stock</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={BookmarkPlus}
          title="No reservations"
          description="Reserve stock against sales or production demand"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.reservation_number)}
                    {r.reference_number ? (
                      <div className="text-xs text-muted-foreground">
                        Ref {String(r.reference_number)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{productLabel(r.product_id as string)}</TableCell>
                  <TableCell>{warehouseName(r.warehouse_id as string)}</TableCell>
                  <TableCell className="capitalize">
                    {String(r.purpose).replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.quantity))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.created_at ? formatDateTime(String(r.created_at)) : EM}
                  </TableCell>
                  <TableCell>
                    {r.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => release(String(r.id))}>
                        Release
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Approval history</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">
                  No approval events yet
                </TableCell>
              </TableRow>
            ) : (
              approvals.map((a) => (
                <TableRow key={String(a.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(a.document_number ?? EM)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(a.action)} />
                  </TableCell>
                  <TableCell className="text-sm">{String(a.comments ?? EM)}</TableCell>
                  <TableCell className="text-sm">
                    {a.created_at ? formatDateTime(String(a.created_at)) : EM}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
