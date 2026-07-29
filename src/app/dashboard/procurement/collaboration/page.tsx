"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Handshake } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listDemandForecasts,
  createDemandForecast,
  listCapacityConfirmations,
  listDeliverySlots,
  reserveDeliverySlot,
  listCollabDocuments,
  listSuppliers,
} from "@/lib/srm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SrmCollaborationPage() {
  const { auth } = useUser();
  const [forecasts, setForecasts] = useState<Array<Record<string, unknown>>>([]);
  const [capacity, setCapacity] = useState<Array<Record<string, unknown>>>([]);
  const [slots, setSlots] = useState<Array<Record<string, unknown>>>([]);
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    material_name: "Bleached hardwood pulp",
    material_code: "PULP-BHW",
    forecast_qty: "30000",
  });

  const load = async () => {
    try {
      const [f, c, s, d, sup] = await Promise.all([
        listDemandForecasts(),
        listCapacityConfirmations(),
        listDeliverySlots(),
        listCollabDocuments(),
        listSuppliers({ limit: 80 }),
      ]);
      setForecasts(f);
      setCapacity(c);
      setSlots(s);
      setDocs(d);
      const strategic = sup.filter(
        (x) => x.is_strategic_collaborator || x.supplier_class === "strategic" || x.supplier_class === "preferred"
      );
      setSuppliers(strategic.length ? strategic : sup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.supplier_id) return;
    const now = new Date();
    try {
      await createDemandForecast({
        company_id: auth.profile.company_id,
        supplier_id: form.supplier_id,
        period_year: now.getFullYear(),
        period_month: now.getMonth() + 1,
        material_code: form.material_code,
        material_name: form.material_name,
        forecast_qty: parseFloat(form.forecast_qty) || 0,
        created_by: auth.user.id,
      });
      toast.success("Demand forecast shared with supplier");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading strategic collaboration…" />;

  return (
    <div>
      <PageHeader
        title="Strategic Supplier Collaboration"
        description="Demand forecast · capacity · delivery slots · engineering docs · CPFR"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Share forecast</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Share demand forecast</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Strategic supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(suppliers.length ? suppliers : []).map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Material code</Label>
                        <Input value={form.material_code} onChange={(e) => setForm({ ...form, material_code: e.target.value })} />
                      </div>
                      <div>
                        <Label>Qty</Label>
                        <Input value={form.forecast_qty} onChange={(e) => setForm({ ...form, forecast_qty: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Material name</Label>
                      <Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Share</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> Forecasts</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{forecasts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Capacity plans</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{capacity.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Delivery slots</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{slots.length}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="forecast">
        <TabsList>
          <TabsTrigger value="forecast">Demand forecasts</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="slots">Delivery slots</TabsTrigger>
          <TabsTrigger value="docs">Engineering docs</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((f) => (
                  <TableRow key={String(f.id)}>
                    <TableCell className="text-sm">{String(f.period_year)}/{String(f.period_month)}</TableCell>
                    <TableCell className="text-sm">{(f.suppliers as { name?: string } | null)?.name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {String(f.material_name || f.material_code || "—")}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(f.forecast_qty || 0))} {String(f.uom || "")}</TableCell>
                    <TableCell className="text-right">
                      {f.confirmed_qty != null ? formatNumber(Number(f.confirmed_qty)) : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={String(f.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capacity.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="text-sm">{(c.suppliers as { name?: string } | null)?.name || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {c.period_start ? String(c.period_start).slice(0, 10) : ""} → {c.period_end ? String(c.period_end).slice(0, 10) : ""}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(c.capacity_units || 0))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(c.committed_units || 0))}</TableCell>
                    <TableCell><StatusBadge status={String(c.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="slots" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((s) => (
                  <TableRow key={String(s.id)}>
                    <TableCell className="text-sm">{s.slot_date ? String(s.slot_date).slice(0, 10) : "—"}</TableCell>
                    <TableCell className="text-xs">{String(s.slot_window)}</TableCell>
                    <TableCell className="text-sm">{(s.suppliers as { name?: string } | null)?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{String(s.warehouse_name || "—")}</TableCell>
                    <TableCell><Badge className="text-[10px]">{String(s.status)}</Badge></TableCell>
                    <TableCell>
                      {s.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            reserveDeliverySlot(String(s.id), "Reserved via collab portal", "reserved")
                              .then(() => {
                                toast.success("Slot reserved");
                                load();
                              })
                          }
                        >
                          Reserve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={String(d.id)}>
                    <TableCell className="font-medium text-sm">{String(d.title)}</TableCell>
                    <TableCell className="capitalize text-xs">{String(d.doc_type)}</TableCell>
                    <TableCell className="text-sm">{(d.suppliers as { name?: string } | null)?.name || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{String(d.visibility)}</Badge></TableCell>
                    <TableCell>v{String(d.version || 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
