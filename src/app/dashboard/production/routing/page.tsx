"use client";

import { useEffect, useState } from "react";
import { Plus, GitBranch } from "lucide-react";
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

type Routing = {
  id: string;
  routing_code: string;
  name: string;
  version: number;
  status: string;
  description: string | null;
  product_id: string | null;
};

type Op = {
  id: string;
  operation_no: number;
  name: string;
  setup_minutes: number;
  run_minutes_per_unit: number;
  wait_minutes: number;
  inspection_required: boolean;
  skills_required: string | null;
  instructions: string | null;
  work_center_id: string | null;
  mes_work_centers?: { name: string; center_code: string } | null;
};

export default function RoutingPage() {
  const { auth } = useUser();
  const [routings, setRoutings] = useState<Routing[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [selected, setSelected] = useState<Routing | null>(null);
  const [workCenters, setWorkCenters] = useState<Array<{ id: string; center_code: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ routing_code: "", name: "", product_id: "", description: "" });
  const [opForm, setOpForm] = useState({
    operation_no: "10",
    name: "",
    work_center_id: "",
    setup_minutes: "15",
    run_minutes_per_unit: "0.5",
    wait_minutes: "0",
    inspection_required: false,
    skills_required: "",
    instructions: "",
    safety_procedures: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: wc }, { data: prods }] = await Promise.all([
      supabase.from("mes_routings").select("*").is("deleted_at", null).order("routing_code"),
      supabase.from("mes_work_centers").select("id,center_code,name").eq("is_active", true),
      supabase.from("products").select("id,product_code,name").eq("is_active", true).limit(300),
    ]);
    setRoutings((data as Routing[]) || []);
    setWorkCenters((wc as typeof workCenters) || []);
    setProducts((prods as typeof products) || []);
    setLoading(false);
  };

  const loadOps = async (routingId: string) => {
    const { data } = await createClient()
      .from("mes_routing_operations")
      .select("*, mes_work_centers(name,center_code)")
      .eq("routing_id", routingId)
      .order("operation_no");
    setOps((data as Op[]) || []);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createRouting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      const { data, error } = await createClient()
        .from("mes_routings")
        .insert({
          company_id: companyId,
          routing_code: form.routing_code,
          name: form.name,
          product_id: form.product_id || null,
          description: form.description || null,
          version: 1,
          status: "active",
        })
        .select("*")
        .single();
      if (error) throw error;
      toast.success("Routing created");
      setOpen(false);
      await load();
      if (data) {
        setSelected(data as Routing);
        setOps([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const addOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !companyId) return;
    setSaving(true);
    try {
      const { error } = await createClient().from("mes_routing_operations").insert({
        company_id: companyId,
        routing_id: selected.id,
        operation_no: Number(opForm.operation_no) || 10,
        name: opForm.name,
        work_center_id: opForm.work_center_id || null,
        setup_minutes: Number(opForm.setup_minutes) || 0,
        run_minutes_per_unit: Number(opForm.run_minutes_per_unit) || 0,
        wait_minutes: Number(opForm.wait_minutes) || 0,
        inspection_required: opForm.inspection_required,
        skills_required: opForm.skills_required || null,
        instructions: opForm.instructions || null,
        safety_procedures: opForm.safety_procedures || null,
      });
      if (error) throw error;
      toast.success("Operation added");
      setOpOpen(false);
      await loadOps(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading routings…" />;

  return (
    <div>
      <PageHeader
        title="Routing Management"
        description="Define operations · work centers · setup & run times · safety"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New routing</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={createRouting}>
                <DialogHeader><DialogTitle>Create routing</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Code</Label>
                    <Input required value={form.routing_code} onChange={(e) => setForm((f) => ({ ...f, routing_code: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Product (optional)</Label>
                    <Select value={form.product_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.product_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Routings" value={String(routings.length)} icon={GitBranch} />
        <StatCard title="Operations (selected)" value={String(ops.length)} icon={GitBranch} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Ver</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routings.map((r) => (
                <TableRow
                  key={r.id}
                  className={`cursor-pointer ${selected?.id === r.id ? "bg-muted/50" : ""}`}
                  onClick={() => { setSelected(r); loadOps(r.id); }}
                >
                  <TableCell className="font-mono text-sm">{r.routing_code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.version}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {routings.length === 0 && <EmptyState title="No routings" description="Define process steps for paper production." />}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Operations {selected ? `· ${selected.routing_code}` : ""}</h3>
            <Dialog open={opOpen} onOpenChange={setOpOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!selected}><Plus className="h-4 w-4 mr-1" /> Operation</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <form onSubmit={addOp}>
                  <DialogHeader><DialogTitle>Add operation</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Op no</Label>
                        <Input value={opForm.operation_no} onChange={(e) => setOpForm((f) => ({ ...f, operation_no: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input required value={opForm.name} onChange={(e) => setOpForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Work center</Label>
                      <Select value={opForm.work_center_id || "none"} onValueChange={(v) => setOpForm((f) => ({ ...f, work_center_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {workCenters.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.center_code} — {w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Setup min</Label>
                        <Input type="number" value={opForm.setup_minutes} onChange={(e) => setOpForm((f) => ({ ...f, setup_minutes: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Run min/unit</Label>
                        <Input type="number" step="any" value={opForm.run_minutes_per_unit} onChange={(e) => setOpForm((f) => ({ ...f, run_minutes_per_unit: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Wait min</Label>
                        <Input type="number" value={opForm.wait_minutes} onChange={(e) => setOpForm((f) => ({ ...f, wait_minutes: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Skills</Label>
                      <Input value={opForm.skills_required} onChange={(e) => setOpForm((f) => ({ ...f, skills_required: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Instructions</Label>
                      <Input value={opForm.instructions} onChange={(e) => setOpForm((f) => ({ ...f, instructions: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Safety</Label>
                      <Input value={opForm.safety_procedures} onChange={(e) => setOpForm((f) => ({ ...f, safety_procedures: e.target.value }))} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={opForm.inspection_required}
                        onChange={(e) => setOpForm((f) => ({ ...f, inspection_required: e.target.checked }))}
                      />
                      Inspection required
                    </label>
                  </div>
                  <DialogFooter><Button type="submit" disabled={saving}>Add</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Center</TableHead>
                  <TableHead className="text-right">Setup</TableHead>
                  <TableHead className="text-right">Run/u</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{o.operation_no}</TableCell>
                    <TableCell>
                      {o.name}
                      {o.inspection_required && <span className="text-xs text-amber-600 ml-1">QC</span>}
                    </TableCell>
                    <TableCell className="text-xs">{o.mes_work_centers?.center_code || "—"}</TableCell>
                    <TableCell className="text-right">{formatNumber(o.setup_minutes)}</TableCell>
                    <TableCell className="text-right">{formatNumber(o.run_minutes_per_unit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!selected && <p className="p-4 text-sm text-muted-foreground">Select a routing.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
