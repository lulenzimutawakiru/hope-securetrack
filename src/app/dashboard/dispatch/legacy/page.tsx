"use client";

import { useEffect, useState } from "react";
import { Truck, Plus } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { DocumentActions } from "@/components/documents/document-actions";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { BusinessDocument } from "@/lib/documents";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

interface Dispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatch_date: string;
  vehicle_reg: string | null;
  driver_name: string | null;
  waybill_number: string | null;
  destination_address: string | null;
  delivered_at: string | null;
  customers?: { name: string } | null;
  sales_orders?: { order_number: string } | null;
  distributors?: { name: string } | null;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  distributor_id: string | null;
}

interface Distributor {
  id: string;
  name: string;
  code: string;
}

export default function DispatchPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sales_order_id: "",
    distributor_id: "",
    vehicle_reg: "",
    driver_name: "",
    driver_phone: "",
    waybill_number: "",
    destination_address: "",
    notes: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: so }, { data: dist }] = await Promise.all([
      supabase
        .from("dispatches")
        .select("*, customers(name), sales_orders(order_number), distributors(name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sales_orders")
        .select("id,order_number,customer_id,distributor_id")
        .in("status", ["confirmed", "picking", "invoiced", "dispatched"])
        .order("created_at", { ascending: false }),
      supabase.from("distributors").select("id,name,code").eq("is_active", true),
    ]);
    setRows((data as Dispatch[]) ?? []);
    setOrders((so as SalesOrder[]) ?? []);
    setDistributors((dist as Distributor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const order = orders.find((o) => o.id === form.sales_order_id);
      const num = `DSP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;

      const { data: wh } = await supabase
        .from("warehouses")
        .select("id")
        .eq("company_id", auth.profile.company_id)
        .limit(1)
        .maybeSingle();

      const crudRes3 = await crudCreate("dispatches", {
        company_id: auth.profile.company_id,
        dispatch_number: num,
        sales_order_id: form.sales_order_id || null,
        customer_id: order?.customer_id || null,
        distributor_id: form.distributor_id || order?.distributor_id || null,
        warehouse_id: wh?.id || null,
        status: "ready",
        dispatch_date: new Date().toISOString().slice(0, 10),
        vehicle_reg: form.vehicle_reg || null,
        driver_name: form.driver_name || null,
        driver_phone: form.driver_phone || null,
        waybill_number: form.waybill_number || null,
        destination_address: form.destination_address || null,
        notes: form.notes || null,
        dispatched_by: auth.profile.id,
      });
      if (!crudRes3.ok) throw new Error(crudRes3.error);

      if (form.sales_order_id) {
        await crudUpdate("sales_orders", form.sales_order_id, { status: "dispatched" });
      }

      toast.success(`Dispatch ${num} created`);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    if (status === "in_transit") {
      // also mark related inventory if needed later
    }
    const crudRes = await crudUpdate("dispatches", id, updates);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Dispatch updated");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const inTransit = rows.filter((r) => r.status === "in_transit").length;

  return (
    <div>
      <PageHeader
        title="Dispatch"
        description="Outbound shipments to distributors and customers"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New dispatch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create dispatch note</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Sales order</Label>
                    <Select
                      value={form.sales_order_id}
                      onValueChange={(v) =>
                        setForm({ ...form, sales_order_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional order" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.order_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Distributor</Label>
                    <Select
                      value={form.distributor_id}
                      onValueChange={(v) =>
                        setForm({ ...form, distributor_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select distributor" />
                      </SelectTrigger>
                      <SelectContent>
                        {distributors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Vehicle reg</Label>
                      <Input
                        value={form.vehicle_reg}
                        onChange={(e) =>
                          setForm({ ...form, vehicle_reg: e.target.value })
                        }
                        placeholder="KDA 123A"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Waybill #</Label>
                      <Input
                        value={form.waybill_number}
                        onChange={(e) =>
                          setForm({ ...form, waybill_number: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Driver</Label>
                      <Input
                        value={form.driver_name}
                        onChange={(e) =>
                          setForm({ ...form, driver_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Driver phone</Label>
                      <Input
                        value={form.driver_phone}
                        onChange={(e) =>
                          setForm({ ...form, driver_phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Destination</Label>
                    <Input
                      value={form.destination_address}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          destination_address: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Dispatches" value={formatNumber(rows.length)} icon={Truck} />
        <StatCard title="In transit" value={formatNumber(inTransit)} />
        <StatCard
          title="Delivered"
          value={formatNumber(rows.filter((r) => r.status === "delivered").length)}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Truck} title="No dispatches" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispatch #</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Vehicle / Driver</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">
                    {d.dispatch_number}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.sales_orders?.order_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.distributors?.name ||
                      d.customers?.name ||
                      d.destination_address ||
                      "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{d.vehicle_reg ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.driver_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDate(d.dispatch_date)}
                    {d.delivered_at && (
                      <div className="text-[10px] text-muted-foreground">
                        Del {formatDateTime(d.delivered_at)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DocumentActions
                        showLabel={false}
                        size="sm"
                        variant="ghost"
                        doc={(): BusinessDocument => ({
                          title: `Delivery Note ${d.dispatch_number}`,
                          docType: "Delivery Note / Dispatch",
                          number: d.dispatch_number,
                          date: d.dispatch_date,
                          status: d.status,
                          billToLabel: "Deliver to",
                          billToName:
                            d.distributors?.name ||
                            d.customers?.name ||
                            d.destination_address ||
                            "Destination",
                          billToMeta: [
                            d.destination_address,
                            d.waybill_number
                              ? `Waybill: ${d.waybill_number}`
                              : undefined,
                          ].filter(Boolean) as string[],
                          meta: [
                            {
                              label: "Sales order",
                              value: d.sales_orders?.order_number ?? "—",
                            },
                            {
                              label: "Vehicle",
                              value: d.vehicle_reg ?? "—",
                            },
                            {
                              label: "Driver",
                              value: d.driver_name ?? "—",
                            },
                          ],
                          lines: [
                            {
                              description: `Dispatch of order ${d.sales_orders?.order_number ?? d.dispatch_number}`,
                              quantity: 1,
                              unit: "load",
                              unit_price: 0,
                              amount: 0,
                            },
                          ],
                          notes: "Please sign and retain for proof of delivery.",
                          footerNote:
                            "Proof of delivery · SecureTrack ERP logistics",
                        })}
                      />
                      <Select
                        value={d.status}
                        onValueChange={(v) => setStatus(d.id, v)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "draft",
                            "ready",
                            "in_transit",
                            "delivered",
                            "failed",
                            "cancelled",
                          ].map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
