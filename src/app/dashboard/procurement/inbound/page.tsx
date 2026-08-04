"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ship, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function InboundPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [pos, setPos] = useState<Array<{ id: string; po_number: string; supplier_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    purchase_order_id: "",
    carrier_name: "",
    tracking_number: "",
    mode: "road",
    eta: "",
    freight_cost: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: po }] = await Promise.all([
      supabase
        .from("inbound_shipments")
        .select("*, suppliers(name), purchase_orders(po_number)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("purchase_orders")
        .select("id,po_number,supplier_id")
        .not("status", "in", '("cancelled","closed")')
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setRows(data ?? []);
    setPos(po ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const po = pos.find((p) => p.id === form.purchase_order_id);
    const supabase = createClient();
    const num = `INB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const crudRes2 = await crudCreate("inbound_shipments", {
      company_id: auth.profile.company_id,
      shipment_number: num,
      purchase_order_id: form.purchase_order_id || null,
      supplier_id: po?.supplier_id || null,
      carrier_name: form.carrier_name || null,
      tracking_number: form.tracking_number || null,
      mode: form.mode,
      eta: form.eta || null,
      freight_cost: Number(form.freight_cost || 0),
      status: "in_transit",
      created_by: auth.profile.id,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success(`Shipment ${num} booked`);
      setOpen(false);
      load();
    }
  };

  const markArrived = async (id: string) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("inbound_shipments", id, {
        status: "arrived",
        actual_arrival: new Date().toISOString().slice(0, 10),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Marked arrived — create GRN in Inventory");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Inbound Logistics"
        description="Shipment scheduling · freight · tracking · customs · goods in transit · ETA"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/inventory/grn">GRN</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Book shipment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inbound shipment</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Purchase order</Label>
                    <Select
                      value={form.purchase_order_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, purchase_order_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="PO" />
                      </SelectTrigger>
                      <SelectContent>
                        {pos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.po_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Carrier</Label>
                      <Input
                        value={form.carrier_name}
                        onChange={(e) => setForm((f) => ({ ...f, carrier_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tracking #</Label>
                      <Input
                        value={form.tracking_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, tracking_number: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>ETA</Label>
                      <Input
                        type="date"
                        value={form.eta}
                        onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Freight cost</Label>
                      <Input
                        type="number"
                        value={form.freight_cost}
                        onChange={(e) => setForm((f) => ({ ...f, freight_cost: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Ship} title="No inbound shipments" description="Book freight against open POs" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead className="text-right">Freight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const po = r.purchase_orders as { po_number?: string } | null;
                const sup = r.suppliers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.shipment_number)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {po?.po_number ?? "—"}
                    </TableCell>
                    <TableCell>{sup?.name ?? "—"}</TableCell>
                    <TableCell>{String(r.carrier_name ?? "—")}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(r.tracking_number ?? "—")}
                    </TableCell>
                    <TableCell>
                      {r.eta ? formatDate(String(r.eta)) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Math.round(Number(r.freight_cost || 0)))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell>
                      {["in_transit", "booked", "delayed"].includes(String(r.status)) && (
                        <Button size="sm" variant="outline" onClick={() => markArrived(String(r.id))}>
                          Arrive
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
