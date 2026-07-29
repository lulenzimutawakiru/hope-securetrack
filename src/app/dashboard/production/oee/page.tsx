"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Plus } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { calculateOee, lossAnalysis, oeeGrade, recordOeeSnapshot } from "@/lib/mes";

type Snap = {
  id: string;
  snapshot_date: string;
  shift: string | null;
  availability_pct: number;
  performance_pct: number;
  quality_pct: number;
  oee_pct: number;
  good_qty: number;
  scrap_qty: number;
  downtime_minutes: number;
  machine_id: string | null;
  production_machines?: { name?: string; machine_code?: string } | null;
};

export default function OeePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Snap[]>([]);
  const [machines, setMachines] = useState<Array<{ id: string; name?: string; machine_code?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    machine_id: "",
    shift: "morning",
    planned_minutes: "480",
    run_minutes: "400",
    downtime_minutes: "80",
    good_qty: "900",
    scrap_qty: "20",
    ideal_cycle_sec: "30",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const preview = useMemo(
    () =>
      calculateOee({
        plannedMinutes: Number(form.planned_minutes) || 0,
        runMinutes: Number(form.run_minutes) || 0,
        downtimeMinutes: Number(form.downtime_minutes) || 0,
        goodQty: Number(form.good_qty) || 0,
        scrapQty: Number(form.scrap_qty) || 0,
        idealCycleSec: Number(form.ideal_cycle_sec) || 60,
      }),
    [form]
  );

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: mac }] = await Promise.all([
      supabase
        .from("mes_oee_snapshots")
        .select("*, production_machines(name,machine_code)")
        .order("snapshot_date", { ascending: false })
        .limit(100),
      supabase.from("production_machines").select("id,name,machine_code").limit(100),
    ]);
    setRows((data as Snap[]) || []);
    setMachines((mac as typeof machines) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      const { oee } = await recordOeeSnapshot({
        company_id: companyId,
        machine_id: form.machine_id || null,
        shift: form.shift,
        planned_minutes: Number(form.planned_minutes) || 0,
        run_minutes: Number(form.run_minutes) || 0,
        downtime_minutes: Number(form.downtime_minutes) || 0,
        good_qty: Number(form.good_qty) || 0,
        scrap_qty: Number(form.scrap_qty) || 0,
        ideal_cycle_sec: Number(form.ideal_cycle_sec) || 60,
      });
      toast.success(`OEE recorded: ${oee.oee}% (${oeeGrade(oee.oee).label})`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading OEE…" />;

  const avg =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.oee_pct || 0), 0) / rows.length
      : 0;
  const avgA =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.availability_pct || 0), 0) / rows.length
      : 0;
  const avgP =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.performance_pct || 0), 0) / rows.length
      : 0;
  const avgQ =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.quality_pct || 0), 0) / rows.length
      : 0;

  const ranking = [...rows]
    .sort((a, b) => Number(b.oee_pct) - Number(a.oee_pct))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Overall Equipment Effectiveness"
        description="OEE = Availability × Performance × Quality"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record OEE</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>OEE snapshot</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Machine</Label>
                    <Select value={form.machine_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, machine_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Plant average</SelectItem>
                        {machines.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.machine_code || m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Planned min</Label>
                      <Input type="number" value={form.planned_minutes} onChange={(e) => setForm((f) => ({ ...f, planned_minutes: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Run min</Label>
                      <Input type="number" value={form.run_minutes} onChange={(e) => setForm((f) => ({ ...f, run_minutes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Downtime min</Label>
                      <Input type="number" value={form.downtime_minutes} onChange={(e) => setForm((f) => ({ ...f, downtime_minutes: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Ideal cycle sec</Label>
                      <Input type="number" value={form.ideal_cycle_sec} onChange={(e) => setForm((f) => ({ ...f, ideal_cycle_sec: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Good qty</Label>
                      <Input type="number" value={form.good_qty} onChange={(e) => setForm((f) => ({ ...f, good_qty: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Scrap qty</Label>
                      <Input type="number" value={form.scrap_qty} onChange={(e) => setForm((f) => ({ ...f, scrap_qty: e.target.value }))} />
                    </div>
                  </div>
                  <Card>
                    <CardContent className="pt-4 grid grid-cols-4 gap-2 text-center text-sm">
                      <div><div className="text-muted-foreground text-xs">A</div><div className="font-semibold">{preview.availability}%</div></div>
                      <div><div className="text-muted-foreground text-xs">P</div><div className="font-semibold">{preview.performance}%</div></div>
                      <div><div className="text-muted-foreground text-xs">Q</div><div className="font-semibold">{preview.quality}%</div></div>
                      <div><div className="text-muted-foreground text-xs">OEE</div><div className="font-semibold text-primary">{preview.oee}%</div></div>
                    </CardContent>
                  </Card>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Save snapshot</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Avg OEE %" value={formatNumber(avg)} icon={Gauge} />
        <StatCard title="Availability %" value={formatNumber(avgA)} icon={Gauge} />
        <StatCard title="Performance %" value={formatNumber(avgP)} icon={Gauge} />
        <StatCard title="Quality %" value={formatNumber(avgQ)} icon={Gauge} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base">Machine ranking</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((r, i) => (
              <div key={r.id} className="flex justify-between text-sm border-b pb-1.5">
                <span>#{i + 1} {r.production_machines?.machine_code || r.production_machines?.name || "Plant"}</span>
                <span className="font-medium">{formatNumber(r.oee_pct)}%</span>
              </div>
            ))}
            {ranking.length === 0 && <p className="text-sm text-muted-foreground">No snapshots yet.</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Loss analysis (latest form preview)</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const loss = lossAnalysis({
                plannedMinutes: Number(form.planned_minutes) || 0,
                runMinutes: Number(form.run_minutes) || 0,
                downtimeMinutes: Number(form.downtime_minutes) || 0,
                goodQty: Number(form.good_qty) || 0,
                scrapQty: Number(form.scrap_qty) || 0,
                idealCycleSec: Number(form.ideal_cycle_sec) || 60,
              });
              return (
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">Availability loss</div>
                    <div className="text-lg font-semibold">{formatNumber(loss.availabilityLossMin)} min</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">Performance loss</div>
                    <div className="text-lg font-semibold">{formatNumber(loss.performanceLossMin)} min</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">Quality loss</div>
                    <div className="text-lg font-semibold">{formatNumber(loss.qualityLossUnits)} units</div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No OEE snapshots" description="Record shift OEE for each machine." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead className="text-right">A%</TableHead>
                <TableHead className="text-right">P%</TableHead>
                <TableHead className="text-right">Q%</TableHead>
                <TableHead className="text-right">OEE%</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{formatDate(r.snapshot_date)}</TableCell>
                  <TableCell className="text-sm">
                    {r.production_machines?.machine_code || r.production_machines?.name || "—"}
                  </TableCell>
                  <TableCell className="capitalize text-sm">{r.shift || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.availability_pct)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.performance_pct)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.quality_pct)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatNumber(r.oee_pct)}</TableCell>
                  <TableCell className="text-xs">{oeeGrade(Number(r.oee_pct)).label}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
