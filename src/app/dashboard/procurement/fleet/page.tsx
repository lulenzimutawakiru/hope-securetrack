"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function FleetPage() {
  const { auth } = useUser();
  const [vehicles, setVehicles] = useState<Array<Record<string, unknown>>>([]);
  const [fuel, setFuel] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    registration: "",
    make: "",
    model: "",
    vehicle_type: "truck",
    assigned_driver_name: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: f }] = await Promise.all([
      supabase.from("fleet_vehicles").select("*").order("registration"),
      supabase
        .from("fleet_fuel_logs")
        .select("*, fleet_vehicles(registration)")
        .order("log_date", { ascending: false })
        .limit(20),
    ]);
    setVehicles(data ?? []);
    setFuel(f ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("fleet_vehicles").insert({
      company_id: auth.profile.company_id,
      registration: form.registration,
      make: form.make || null,
      model: form.model || null,
      vehicle_type: form.vehicle_type,
      assigned_driver_name: form.assigned_driver_name || null,
      status: "available",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Vehicle registered");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  const available = vehicles.filter((v) => v.status === "available").length;
  const inUse = vehicles.filter((v) => v.status === "in_use").length;
  const maint = vehicles.filter((v) => v.status === "maintenance").length;
  const fuelCost = fuel.reduce((s, f) => s + Number(f.cost || 0), 0);

  return (
    <div>
      <PageHeader
        title="Fleet Management"
        description="Vehicles · drivers · fuel · maintenance · insurance · road licenses"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/dispatch">Dispatch</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add vehicle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register vehicle</DialogTitle>
                </DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Registration</Label>
                    <Input
                      value={form.registration}
                      onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Make</Label>
                      <Input
                        value={form.make}
                        onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Model</Label>
                      <Input
                        value={form.model}
                        onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Driver</Label>
                    <Input
                      value={form.assigned_driver_name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, assigned_driver_name: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Fleet size" value={formatNumber(vehicles.length)} icon={Truck} />
        <StatCard title="Available" value={formatNumber(available)} />
        <StatCard title="In use" value={formatNumber(inUse)} />
        <StatCard title="Recent fuel (UGX)" value={formatNumber(Math.round(fuelCost))} />
      </div>

      {vehicles.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles" description="Register fleet assets" />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Odometer</TableHead>
                <TableHead>Insurance</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={String(v.id)}>
                  <TableCell className="font-mono font-medium">
                    {String(v.registration)}
                  </TableCell>
                  <TableCell>
                    {String(v.make ?? "")} {String(v.model ?? "")}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(v.vehicle_type).replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{String(v.assigned_driver_name ?? "—")}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(v.current_odometer || 0))} km
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.insurance_expiry ? formatDate(String(v.insurance_expiry)) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.road_license_expiry
                      ? formatDate(String(v.road_license_expiry))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(v.status)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {maint > 0 && (
        <p className="text-sm text-amber-700 mb-4">
          {maint} vehicle(s) currently in maintenance.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent fuel logs</CardTitle>
        </CardHeader>
        <CardContent>
          {fuel.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fuel records</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Station</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fuel.map((f) => {
                  const veh = f.fleet_vehicles as { registration?: string } | null;
                  return (
                    <TableRow key={String(f.id)}>
                      <TableCell>
                        {f.log_date ? formatDate(String(f.log_date)) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {veh?.registration ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(f.litres))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Math.round(Number(f.cost)))}
                      </TableCell>
                      <TableCell>{String(f.station ?? "—")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
