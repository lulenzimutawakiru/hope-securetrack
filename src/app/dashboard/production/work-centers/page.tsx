"use client";

import { useEffect, useState } from "react";
import { Plus, Activity } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type WC = {
  id: string;
  center_code: string;
  name: string;
  location_name: string | null;
  capacity_per_hour: number;
  availability_pct: number;
  cost_rate_per_hour: number;
  efficiency_pct: number;
  shift_pattern: string;
  status: string;
  is_active: boolean;
};

export default function WorkCentersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<WC[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    center_code: "",
    name: "",
    location_name: "",
    capacity_per_hour: "100",
    availability_pct: "100",
    cost_rate_per_hour: "50000",
    efficiency_pct: "90",
    shift_pattern: "3x8",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("mes_work_centers")
      .select("*")
      .order("center_code");
    setRows((data as WC[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("No company");
    setSaving(true);
    try {
      const { error } = await createClient().from("mes_work_centers").insert({
        company_id: companyId,
        center_code: form.center_code,
        name: form.name,
        location_name: form.location_name || null,
        capacity_per_hour: Number(form.capacity_per_hour) || 0,
        availability_pct: Number(form.availability_pct) || 100,
        cost_rate_per_hour: Number(form.cost_rate_per_hour) || 0,
        efficiency_pct: Number(form.efficiency_pct) || 90,
        shift_pattern: form.shift_pattern,
        status: "available",
        is_active: true,
      });
      if (error) throw error;
      toast.success("Work center created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading work centers…" />;

  const active = rows.filter((r) => r.is_active).length;
  const avgEff =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.efficiency_pct || 0), 0) / rows.length
      : 0;

  return (
    <div>
      <PageHeader
        title="Work Centers"
        description="Capacity · availability · cost rate · shift patterns"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add center</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>New work center</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.center_code} onChange={(e) => setForm((f) => ({ ...f, center_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Capacity / hour</Label>
                      <Input type="number" value={form.capacity_per_hour} onChange={(e) => setForm((f) => ({ ...f, capacity_per_hour: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Availability %</Label>
                      <Input type="number" value={form.availability_pct} onChange={(e) => setForm((f) => ({ ...f, availability_pct: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Cost rate / hour</Label>
                      <Input type="number" value={form.cost_rate_per_hour} onChange={(e) => setForm((f) => ({ ...f, cost_rate_per_hour: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Efficiency %</Label>
                      <Input type="number" value={form.efficiency_pct} onChange={(e) => setForm((f) => ({ ...f, efficiency_pct: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Shift pattern</Label>
                    <Input value={form.shift_pattern} onChange={(e) => setForm((f) => ({ ...f, shift_pattern: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Work centers" value={String(rows.length)} icon={Activity} />
        <StatCard title="Active" value={String(active)} icon={Activity} />
        <StatCard title="Avg efficiency %" value={formatNumber(avgEff)} icon={Activity} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No work centers" description="Add cutting, packaging, QC and formation centers." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Capacity/h</TableHead>
                <TableHead className="text-right">Eff %</TableHead>
                <TableHead className="text-right">Rate/h</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.center_code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.location_name || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.capacity_per_hour)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.efficiency_pct)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.cost_rate_per_hour)}</TableCell>
                  <TableCell>{r.shift_pattern}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
