"use client";

import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { crudCreate } from "@/lib/api/crud-client";
import { toast } from "sonner";
import { VEHICLE_TYPES } from "@/lib/dispatch";

export default function DispatchFleetPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    registration: "",
    make: "",
    model: "",
    vehicle_type: "truck",
    capacity_kg: "5000",
    fuel_type: "diesel",
    gps_tracker_id: "",
    assigned_driver_name: "",
  });

  const load = async () => {
    const { data } = await createClient()
      .from("fleet_vehicles")
      .select("*")
      .order("registration");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crudCreate("fleet_vehicles", {
      registration: form.registration.toUpperCase(),
      make: form.make,
      model: form.model,
      vehicle_type: form.vehicle_type,
      capacity_kg: Number(form.capacity_kg) || 0,
      fuel_type: form.fuel_type,
      gps_tracker_id: form.gps_tracker_id || null,
      assigned_driver_name: form.assigned_driver_name || null,
      status: "available",
      is_active: true,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Vehicle registered");
      setOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading fleet…" />;

  return (
    <div>
      <PageHeader
        title="Fleet Management"
        description="Trucks · vans · motorcycles · GPS · insurance · capacity"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Vehicle</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Register vehicle</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Registration</Label>
                      <Input required value={form.registration} onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={form.vehicle_type} onValueChange={(v) => setForm((f) => ({ ...f, vehicle_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VEHICLE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Make</Label>
                      <Input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Capacity kg</Label>
                      <Input type="number" value={form.capacity_kg} onChange={(e) => setForm((f) => ({ ...f, capacity_kg: e.target.value }))} />
                    </div>
                    <div>
                      <Label>GPS tracker</Label>
                      <Input value={form.gps_tracker_id} onChange={(e) => setForm((f) => ({ ...f, gps_tracker_id: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Driver name</Label>
                    <Input value={form.assigned_driver_name} onChange={(e) => setForm((f) => ({ ...f, assigned_driver_name: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No vehicles" description="Register fleet or apply logistics seed." icon={Truck} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>GPS</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs font-medium">{String(r.registration)}</TableCell>
                  <TableCell className="text-sm">{String(r.make || "")} {String(r.model || "")}</TableCell>
                  <TableCell className="capitalize text-xs">{String(r.vehicle_type)}</TableCell>
                  <TableCell className="text-xs">{String(r.capacity_kg ?? "—")} kg</TableCell>
                  <TableCell className="text-xs">{String(r.assigned_driver_name || "—")}</TableCell>
                  <TableCell className="font-mono text-[10px]">{String(r.gps_tracker_id || "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
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
