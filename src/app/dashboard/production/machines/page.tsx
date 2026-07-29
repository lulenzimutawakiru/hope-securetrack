"use client";

import { useEffect, useState } from "react";
import { Plus, Cpu, Wrench } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { MACHINE_STATES } from "@/lib/mes";

type Machine = {
  id: string;
  name?: string;
  machine_code?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  status?: string;
  operating_hours?: number;
  energy_kwh?: number;
  efficiency_pct?: number;
  cost_rate_per_hour?: number;
  work_center_id?: string | null;
  installed_at?: string | null;
  warranty_until?: string | null;
};

export default function MachinesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Machine[]>([]);
  const [workCenters, setWorkCenters] = useState<Array<{ id: string; center_code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    machine_code: "",
    name: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    status: "idle",
    efficiency_pct: "85",
    cost_rate_per_hour: "75000",
    work_center_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: wc }] = await Promise.all([
      supabase.from("production_machines").select("*").order("created_at", { ascending: false }),
      supabase.from("mes_work_centers").select("id,center_code").eq("is_active", true),
    ]);
    setRows((data as Machine[]) || []);
    setWorkCenters((wc as typeof workCenters) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await createClient().from("production_machines").insert({
        company_id: companyId || null,
        machine_code: form.machine_code,
        name: form.name,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        status: form.status,
        efficiency_pct: Number(form.efficiency_pct) || 85,
        cost_rate_per_hour: Number(form.cost_rate_per_hour) || 0,
        work_center_id: form.work_center_id || null,
        operating_hours: 0,
        energy_kwh: 0,
      });
      if (error) throw error;
      toast.success("Machine registered");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const { error } = await createClient()
        .from("production_machines")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Status → ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  if (loading) return <LoadingState message="Loading machines…" />;

  const byStatus = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div>
      <PageHeader
        title="Machine Management"
        description="Industrial assets · status · efficiency · energy · maintenance link"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Register machine</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>Register machine</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.machine_code} onChange={(e) => setForm((f) => ({ ...f, machine_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Manufacturer</Label>
                      <Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Serial number</Label>
                    <Input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Efficiency %</Label>
                      <Input type="number" value={form.efficiency_pct} onChange={(e) => setForm((f) => ({ ...f, efficiency_pct: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Cost rate / hour</Label>
                      <Input type="number" value={form.cost_rate_per_hour} onChange={(e) => setForm((f) => ({ ...f, cost_rate_per_hour: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Work center</Label>
                    <Select value={form.work_center_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, work_center_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {workCenters.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.center_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard title="Total" value={String(rows.length)} icon={Cpu} />
        <StatCard title="Running" value={String(byStatus("running"))} icon={Cpu} />
        <StatCard title="Idle" value={String(byStatus("idle"))} icon={Cpu} />
        <StatCard title="Breakdown" value={String(byStatus("breakdown"))} icon={Wrench} />
        <StatCard title="Maintenance" value={String(byStatus("maintenance"))} icon={Wrench} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No machines" description="Register FSS104, FSS300 and other lines." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Eff %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Set status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.machine_code || "—"}</TableCell>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[r.manufacturer, r.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(r.operating_hours || 0)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.efficiency_pct || 0)}</TableCell>
                  <TableCell><StatusBadge status={r.status || "idle"} /></TableCell>
                  <TableCell className="text-right">
                    <Select value={r.status || "idle"} onValueChange={(v) => setStatus(r.id, v)}>
                      <SelectTrigger className="w-[130px] h-8 ml-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MACHINE_STATES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
