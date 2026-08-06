"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

export default function KpiEnginePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kpi_code: "",
    name: "",
    category: "financial",
    department: "",
    formula: "",
    unit: "",
    target_value: "",
    actual_value: "",
    frequency: "monthly",
    owner_name: "",
    higher_is_better: true,
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bi_kpis")
      .select("*")
      .is("deleted_at", null)
      .order("category")
      .order("name");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const target = Number(form.target_value) || 0;
    const actual = Number(form.actual_value) || 0;
    const variance = actual - target;
    const variance_pct = target ? (variance / target) * 100 : 0;
    const crudRes2 = await crudCreate("bi_kpis", {
        company_id: auth.profile.company_id,
        kpi_code: form.kpi_code.toUpperCase(),
        name: form.name,
        category: form.category,
        department: form.department || null,
        formula: form.formula || null,
        unit: form.unit || null,
        target_value: target,
        actual_value: actual,
        variance_value: variance,
        variance_pct,
        trend: variance > 0 ? "up" : variance < 0 ? "down" : "stable",
        frequency: form.frequency,
        owner_name: form.owner_name || null,
        higher_is_better: form.higher_is_better,
        is_active: true,
        last_calculated_at: new Date().toISOString(),
      });
    if (!crudRes2.ok) {
      toast.error(crudRes2.error);
      return;
    }
    const data = crudRes2.data as Record<string, unknown>;
    if (data) {
      await crudCreate("bi_kpi_snapshots", {
        company_id: auth.profile.company_id,
        kpi_id: data.id,
        snapshot_date: new Date().toISOString().slice(0, 10),
        actual_value: actual,
        target_value: target,
        variance_value: variance,
      });
    }
    toast.success("KPI created");
    setOpen(false);
    load();
  };

  const snapshot = async (r: Record<string, unknown>) => {
    if (!auth) return;
    const supabase = createClient();
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const { data: existing, error: fetchError } = await supabase
      .from("bi_kpi_snapshots")
      .select("id")
      .eq("kpi_id", String(r.id))
      .eq("snapshot_date", snapshotDate)
      .maybeSingle();
    if (fetchError) {
      toast.error(fetchError.message);
      return;
    }
    const payload = {
      kpi_id: String(r.id),
      snapshot_date: snapshotDate,
      actual_value: r.actual_value,
      target_value: r.target_value,
      variance_value: r.variance_value,
    };
    const crudRes3 = existing
      ? await crudUpdate("bi_kpi_snapshots", String((existing as { id: unknown }).id), payload)
      : await crudCreate("bi_kpi_snapshots", payload);
    if (!crudRes3.ok) toast.error(crudRes3.error);
    else toast.success("Snapshot saved");
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="KPI Engine"
        description="Unlimited KPIs with formula · target · actual · variance · thresholds · history"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  KPI
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>New KPI</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Code</Label>
                      <Input
                        value={form.kpi_code}
                        onChange={(e) => setForm((f) => ({ ...f, kpi_code: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Input
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Formula</Label>
                    <Input
                      value={form.formula}
                      onChange={(e) => setForm((f) => ({ ...f, formula: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label>Target</Label>
                      <Input
                        type="number"
                        value={form.target_value}
                        onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Actual</Label>
                      <Input
                        type="number"
                        value={form.actual_value}
                        onChange={(e) => setForm((f) => ({ ...f, actual_value: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit</Label>
                      <Input
                        value={form.unit}
                        onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Department</Label>
                      <Input
                        value={form.department}
                        onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Owner</Label>
                      <Input
                        value={form.owner_name}
                        onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.higher_is_better}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, higher_is_better: e.target.checked }))
                      }
                    />
                    Higher is better
                  </label>
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
        <EmptyState icon={Target} title="No KPIs" description="Define enterprise KPIs" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const better = r.higher_is_better !== false;
                const varPct = Number(r.variance_pct);
                const good = better ? varPct >= -5 : varPct <= 5;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.kpi_code)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{String(r.name)}</div>
                      <div className="text-[10px] text-muted-foreground font-mono line-clamp-1">
                        {String(r.formula ?? "")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(r.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNumber(Number(r.target_value))} {String(r.unit ?? "")}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNumber(Number(r.actual_value))}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${good ? "text-green-700" : "text-amber-700"}`}
                    >
                      {formatNumber(Number(r.variance_value))} (
                      {formatNumber(varPct)}%)
                    </TableCell>
                    <TableCell className="capitalize text-sm">{String(r.trend)}</TableCell>
                    <TableCell className="text-sm">{String(r.owner_name ?? "—")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => snapshot(r)}>
                        Snapshot
                      </Button>
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
