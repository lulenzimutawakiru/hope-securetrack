"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Play, Copy, Trash2, PackageCheck, Factory, Search,
} from "lucide-react";
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
import {
  PO_TYPES,
  createProductionOrder,
  releaseProductionOrder,
  duplicateProductionOrder,
  softDeleteProductionOrder,
  runMrpForOrder,
} from "@/lib/mes";

type Order = {
  id: string;
  order_number: string;
  order_type: string;
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  quantity_planned: number;
  quantity_completed: number;
  quantity_scrap: number;
  batch_number: string | null;
  status: string;
  planned_start: string | null;
  planned_finish: string | null;
  total_cost: number;
  unit_cost: number;
  priority: number;
  shift: string | null;
};

export default function ProductionOrdersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Order[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; name: string }>>([]);
  const [boms, setBoms] = useState<Array<{ id: string; bom_code?: string; name?: string; product_id?: string }>>([]);
  const [routings, setRoutings] = useState<Array<{ id: string; routing_code: string; name: string; product_id?: string }>>([]);
  const [machines, setMachines] = useState<Array<{ id: string; name?: string; machine_code?: string }>>([]);
  const [workCenters, setWorkCenters] = useState<Array<{ id: string; center_code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    product_id: "",
    quantity_planned: "100",
    order_type: "manufacturing",
    bom_id: "",
    routing_id: "",
    machine_id: "",
    work_center_id: "",
    planned_start: new Date().toISOString().slice(0, 16),
    planned_finish: "",
    shift: "morning",
    priority: "5",
    notes: "",
    uom: "REAM",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from("mes_production_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (filter !== "all") query = query.eq("status", filter);

    const [{ data }, { data: prods }, { data: bomData }, { data: rt }, { data: mac }, { data: wc }] =
      await Promise.all([
        query,
        supabase.from("products").select("id,product_code,name").eq("is_active", true).order("name").limit(500),
        supabase.from("bom_headers").select("id,bom_code,name,product_id").is("deleted_at", null).limit(200),
        supabase.from("mes_routings").select("id,routing_code,name,product_id").is("deleted_at", null).limit(200),
        supabase.from("production_machines").select("id,name,machine_code").limit(100),
        supabase.from("mes_work_centers").select("id,center_code,name").eq("is_active", true).limit(100),
      ]);

    setRows((data as Order[]) || []);
    setProducts((prods as typeof products) || []);
    setBoms((bomData as typeof boms) || []);
    setRoutings((rt as typeof routings) || []);
    setMachines((mac as typeof machines) || []);
    setWorkCenters((wc as typeof workCenters) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.order_number?.toLowerCase().includes(s) ||
        r.product_name?.toLowerCase().includes(s) ||
        r.batch_number?.toLowerCase().includes(s) ||
        r.product_code?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const inProg = rows.filter((r) => r.status === "in_progress").length;
    const planned = rows.filter((r) => r.status === "planned" || r.status === "released").length;
    const done = rows.filter((r) => r.status === "completed" || r.status === "closed").length;
    const qty = rows.reduce((s, r) => s + Number(r.quantity_completed || 0), 0);
    return { inProg, planned, done, qty };
  }, [rows]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error("No company context");
      return;
    }
    const product = products.find((p) => p.id === form.product_id);
    if (!product) {
      toast.error("Select a product");
      return;
    }
    setSaving(true);
    try {
      await createProductionOrder({
        company_id: companyId,
        product_id: product.id,
        product_code: product.product_code,
        product_name: product.name,
        quantity_planned: Number(form.quantity_planned) || 0,
        uom: form.uom,
        order_type: form.order_type,
        bom_id: form.bom_id || null,
        routing_id: form.routing_id || null,
        machine_id: form.machine_id || null,
        work_center_id: form.work_center_id || null,
        planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
        planned_finish: form.planned_finish ? new Date(form.planned_finish).toISOString() : null,
        shift: form.shift,
        priority: Number(form.priority) || 5,
        notes: form.notes || null,
        created_by: auth?.user?.id,
      });
      toast.success("Production order created with work orders & material plan");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const onRelease = async (id: string) => {
    try {
      await releaseProductionOrder(id);
      toast.success("Order released to shop floor");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Release failed");
    }
  };

  const onDuplicate = async (id: string) => {
    if (!companyId) return;
    try {
      await duplicateProductionOrder(id, companyId);
      toast.success("Order duplicated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Cancel and archive this production order?")) return;
    try {
      await softDeleteProductionOrder(id);
      toast.success("Order cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onMrp = async (id: string) => {
    if (!companyId) return;
    try {
      const result = await runMrpForOrder({ company_id: companyId, production_order_id: id });
      toast.success(`MRP complete: ${result.suggestions.length} shortage(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "MRP failed");
    }
  };

  if (loading) return <LoadingState message="Loading production orders…" />;

  return (
    <div>
      <PageHeader
        title="Production Orders"
        description="Manufacturing · rework · trial · planned orders with BOM & routing"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create production order</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product</Label>
                    <Select
                      value={form.product_id}
                      onValueChange={(v) => {
                        const productBoms = boms.filter((b) => b.product_id === v);
                        const productRts = routings.filter((r) => r.product_id === v);
                        setForm((f) => ({
                          ...f,
                          product_id: v,
                          bom_id: productBoms[0]?.id || f.bom_id,
                          routing_id: productRts[0]?.id || f.routing_id,
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.quantity_planned}
                        onChange={(e) => setForm((f) => ({ ...f, quantity_planned: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label>UoM</Label>
                      <Input value={form.uom} onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Order type</Label>
                      <Select value={form.order_type} onValueChange={(v) => setForm((f) => ({ ...f, order_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PO_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority (1=high)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={form.priority}
                        onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>BOM</Label>
                    <Select value={form.bom_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, bom_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {boms.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bom_code || b.name || b.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Routing</Label>
                    <Select value={form.routing_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, routing_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {routings.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.routing_code} — {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Work center</Label>
                      <Select value={form.work_center_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, work_center_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {workCenters.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.center_code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Machine</Label>
                      <Select value={form.machine_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, machine_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {machines.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.machine_code || m.name || m.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Planned start</Label>
                      <Input
                        type="datetime-local"
                        value={form.planned_start}
                        onChange={(e) => setForm((f) => ({ ...f, planned_start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Shift</Label>
                      <Select value={form.shift} onValueChange={(v) => setForm((f) => ({ ...f, shift: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="night">Night</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create order"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Open / planned" value={String(stats.planned)} icon={PackageCheck} />
        <StatCard title="In progress" value={String(stats.inProg)} icon={Factory} />
        <StatCard title="Completed" value={String(stats.done)} icon={PackageCheck} />
        <StatCard title="Units completed" value={formatNumber(stats.qty)} icon={Factory} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search orders, batch, product…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["planned", "released", "in_progress", "paused", "qc", "completed", "cancelled", "closed"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No production orders" description="Create a manufacturing order to start shop floor execution." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Done</TableHead>
                <TableHead className="text-right">Scrap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{r.order_number}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.order_type} · P{r.priority}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.product_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.product_code}</div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{r.batch_number || "—"}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.quantity_planned)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.quantity_completed)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.quantity_scrap)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs">{r.planned_start ? formatDate(r.planned_start) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(r.status === "planned" || r.status === "released") && (
                        <Button size="icon" variant="ghost" title="Release" onClick={() => onRelease(r.id)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Run MRP" onClick={() => onMrp(r.id)}>
                        <PackageCheck className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Duplicate" onClick={() => onDuplicate(r.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Cancel" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
