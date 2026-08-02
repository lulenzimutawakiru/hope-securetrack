"use client";

import { useEffect, useState } from "react";
import { Plus, Calendar } from "lucide-react";
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
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { planMpsLine } from "@/lib/mes";

type Mps = {
  id: string;
  product_id: string | null;
  product_code: string | null;
  period_start: string;
  period_end: string;
  demand_qty: number;
  planned_qty: number;
  available_qty: number;
  status: string;
};

export default function PlanningPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Mps[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    demand_qty: "1000",
    available_qty: "0",
    safety_stock: "50",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: prods }] = await Promise.all([
      supabase.from("mes_mps_lines").select("*").order("period_start", { ascending: false }).limit(200),
      supabase.from("products").select("id,product_code,name").eq("is_active", true).limit(300),
    ]);
    setRows((data as Mps[]) || []);
    setProducts((prods as typeof products) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const product = products.find((p) => p.id === form.product_id);
    const { plannedQty } = planMpsLine({
      demandQty: Number(form.demand_qty) || 0,
      availableQty: Number(form.available_qty) || 0,
      safetyStock: Number(form.safety_stock) || 0,
    });
    setSaving(true);
    try {
      const crudRes2 = await crudCreate("mes_mps_lines", {
        company_id: companyId,
        product_id: form.product_id || null,
        product_code: product?.product_code || null,
        period_start: form.period_start,
        period_end: form.period_end,
        demand_qty: Number(form.demand_qty) || 0,
        planned_qty: plannedQty,
        available_qty: Number(form.available_qty) || 0,
        status: "draft",
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success(`MPS line planned: ${plannedQty} units`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const confirmLine = async (id: string) => {
    const crudRes = await crudUpdate("mes_mps_lines", id, { status: "confirmed" });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("MPS confirmed");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading MPS…" />;

  const totalDemand = rows.reduce((s, r) => s + Number(r.demand_qty || 0), 0);
  const totalPlanned = rows.reduce((s, r) => s + Number(r.planned_qty || 0), 0);

  return (
    <div>
      <PageHeader
        title="Production Planning · MPS"
        description="Master Production Schedule · demand · net requirements · capacity outlook"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> MPS line</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>Add MPS line</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product</Label>
                    <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Period start</Label>
                      <Input type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Period end</Label>
                      <Input type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Demand</Label>
                      <Input type="number" value={form.demand_qty} onChange={(e) => setForm((f) => ({ ...f, demand_qty: e.target.value }))} />
                    </div>
                    <div>
                      <Label>On hand</Label>
                      <Input type="number" value={form.available_qty} onChange={(e) => setForm((f) => ({ ...f, available_qty: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Safety stock</Label>
                      <Input type="number" value={form.safety_stock} onChange={(e) => setForm((f) => ({ ...f, safety_stock: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Plan</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="MPS lines" value={String(rows.length)} icon={Calendar} />
        <StatCard title="Total demand" value={formatNumber(totalDemand)} icon={Calendar} />
        <StatCard title="Total planned" value={formatNumber(totalPlanned)} icon={Calendar} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No MPS lines" description="Plan demand periods for finished goods." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Demand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.product_code || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(r.period_start)} → {formatDate(r.period_end)}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(r.demand_qty)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.available_qty)}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(r.planned_qty)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => confirmLine(r.id)}>Confirm</Button>
                    )}
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
