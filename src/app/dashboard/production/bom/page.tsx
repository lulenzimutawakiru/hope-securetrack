"use client";

import { useEffect, useState } from "react";
import { Plus, Calculator, Layers } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { rollupBomHeaderCost } from "@/lib/mes";

type BomHeader = {
  id: string;
  bom_code?: string;
  name?: string;
  version?: number | string;
  status?: string;
  yield_pct?: number;
  scrap_pct?: number;
  total_cost?: number;
  product_id?: string;
  products?: { name: string; product_code: string } | null;
};

type BomLine = {
  id: string;
  component_code?: string;
  component_name?: string;
  product_code?: string;
  description?: string;
  quantity: number;
  uom?: string;
  scrap_pct?: number;
  unit_cost?: number;
  is_alternative?: boolean;
  level_no?: number;
};

export default function BomPage() {
  const { auth } = useUser();
  const [headers, setHeaders] = useState<BomHeader[]>([]);
  const [lines, setLines] = useState<BomLine[]>([]);
  const [selected, setSelected] = useState<BomHeader | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; product_code: string; name: string; standard_cost?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    bom_code: "",
    name: "",
    yield_pct: "100",
    scrap_pct: "2",
  });
  const [lineForm, setLineForm] = useState({
    product_id: "",
    quantity: "1",
    scrap_pct: "0",
    unit_cost: "0",
    is_alternative: false,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: prods }] = await Promise.all([
      supabase
        .from("bom_headers")
        .select("*, products(name,product_code)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("products").select("id,product_code,name,standard_cost").eq("is_active", true).order("name").limit(500),
    ]);
    setHeaders((data as BomHeader[]) || []);
    setProducts((prods as typeof products) || []);
    setLoading(false);
  };

  const loadLines = async (bomId: string) => {
    const { data } = await createClient().from("bom_lines").select("*").eq("bom_id", bomId);
    setLines((data as BomLine[]) || []);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("No company");
    const product = products.find((p) => p.id === form.product_id);
    setSaving(true);
    try {
      const code = form.bom_code || `BOM-${product?.product_code || "NEW"}-1`;
      const crudRes2 = await crudCreate("bom_headers", {
          company_id: companyId,
          product_id: form.product_id,
          bom_code: code,
          name: form.name || `BOM ${product?.name || ""}`,
          version: 1,
          status: "active",
          yield_pct: Number(form.yield_pct) || 100,
          scrap_pct: Number(form.scrap_pct) || 0,
          bom_type: "manufacturing",
        });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      const data = crudRes2.data as Record<string, unknown>;
      toast.success("BOM created");
      setOpen(false);
      await load();
      if (data) {
        setSelected(data as BomHeader);
        await loadLines(String(data.id));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const addLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !companyId) return;
    const component = products.find((p) => p.id === lineForm.product_id);
    if (!component) return toast.error("Select component");
    setSaving(true);
    try {
      const crudRes = await crudCreate("bom_lines", {
        bom_id: selected.id,
        company_id: companyId,
        component_product_id: component.id,
        product_id: component.id,
        component_code: component.product_code,
        component_name: component.name,
        product_code: component.product_code,
        description: component.name,
        quantity: Number(lineForm.quantity) || 0,
        scrap_pct: Number(lineForm.scrap_pct) || 0,
        unit_cost: Number(lineForm.unit_cost) || Number(component.standard_cost) || 0,
        is_alternative: lineForm.is_alternative,
        uom: "EA",
        level_no: 1,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Component added");
      setLineOpen(false);
      await loadLines(selected.id);
      await rollupBomHeaderCost(selected.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const onRollup = async () => {
    if (!selected) return;
    try {
      const total = await rollupBomHeaderCost(selected.id);
      toast.success(`Cost rollup: ${formatNumber(total)}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rollup failed");
    }
  };

  if (loading) return <LoadingState message="Loading BOMs…" />;

  return (
    <div>
      <PageHeader
        title="Bill of Materials"
        description="Multi-level manufacturing BOM · scrap · yield · cost rollup · alternatives"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New BOM</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>Create BOM</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Finished product</Label>
                    <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>BOM code</Label>
                    <Input value={form.bom_code} onChange={(e) => setForm((f) => ({ ...f, bom_code: e.target.value }))} placeholder="Auto if empty" />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Yield %</Label>
                      <Input type="number" value={form.yield_pct} onChange={(e) => setForm((f) => ({ ...f, yield_pct: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Scrap %</Label>
                      <Input type="number" value={form.scrap_pct} onChange={(e) => setForm((f) => ({ ...f, scrap_pct: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="BOM headers" value={String(headers.length)} icon={Layers} />
        <StatCard title="Selected lines" value={String(lines.length)} icon={Layers} />
        <StatCard title="Selected cost" value={formatNumber(selected?.total_cost || 0)} icon={Calculator} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Yield</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {headers.map((h) => (
                <TableRow
                  key={h.id}
                  className={`cursor-pointer ${selected?.id === h.id ? "bg-muted/50" : ""}`}
                  onClick={() => {
                    setSelected(h);
                    loadLines(h.id);
                  }}
                >
                  <TableCell className="font-mono text-sm">{h.bom_code || h.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{h.products?.name || h.name || "—"}</TableCell>
                  <TableCell>{h.yield_pct ?? 100}%</TableCell>
                  <TableCell className="text-right">{formatNumber(h.total_cost || 0)}</TableCell>
                  <TableCell><StatusBadge status={h.status || "active"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {headers.length === 0 && <EmptyState title="No BOMs" description="Create a manufacturing BOM for your finished goods." />}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">
              Components {selected ? `· ${selected.bom_code || selected.name}` : ""}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!selected} onClick={onRollup}>
                <Calculator className="h-4 w-4 mr-1" /> Rollup
              </Button>
              <Dialog open={lineOpen} onOpenChange={setLineOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={!selected}>
                    <Plus className="h-4 w-4 mr-1" /> Line
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={addLine}>
                    <DialogHeader><DialogTitle>Add component</DialogTitle></DialogHeader>
                    <div className="grid gap-3 py-3">
                      <div>
                        <Label>Component</Label>
                        <Select value={lineForm.product_id} onValueChange={(v) => {
                          const p = products.find((x) => x.id === v);
                          setLineForm((f) => ({
                            ...f,
                            product_id: v,
                            unit_cost: String(p?.standard_cost || 0),
                          }));
                        }}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label>Qty</Label>
                          <Input type="number" step="any" value={lineForm.quantity} onChange={(e) => setLineForm((f) => ({ ...f, quantity: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Scrap %</Label>
                          <Input type="number" value={lineForm.scrap_pct} onChange={(e) => setLineForm((f) => ({ ...f, scrap_pct: e.target.value }))} />
                        </div>
                        <div>
                          <Label>Unit cost</Label>
                          <Input type="number" value={lineForm.unit_cost} onChange={(e) => setLineForm((f) => ({ ...f, unit_cost: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={saving}>Add</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Scrap%</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">
                      {l.component_code || l.product_code} — {l.component_name || l.description}
                      {l.is_alternative && <span className="text-xs text-muted-foreground ml-1">(alt)</span>}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(l.quantity)}</TableCell>
                    <TableCell className="text-right">{l.scrap_pct || 0}</TableCell>
                    <TableCell className="text-right">{formatNumber(l.unit_cost || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {selected && lines.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No components. Add lines to explode MRP and material issues.</p>
            )}
            {!selected && (
              <p className="p-4 text-sm text-muted-foreground">Select a BOM header.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
