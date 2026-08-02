"use client";

import { useEffect, useState } from "react";
import { Boxes, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { MATERIAL_CATEGORIES } from "@/lib/packaging";

export default function PkgMaterialsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    material_code: "",
    name: "",
    category: "carton",
    uom: "ea",
    unit_cost: "0",
    stock_qty: "0",
    reorder_level: "50",
    storage_location: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_materials")
      .select("*")
      .is("deleted_at", null)
      .order("material_code");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes = await crudCreate("pkg_materials", {
        company_id: companyId,
        material_code: form.material_code.toUpperCase(),
        name: form.name,
        category: form.category,
        uom: form.uom,
        unit_cost: Number(form.unit_cost) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 50,
        storage_location: form.storage_location || null,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Material created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading packaging materials…" />;

  return (
    <div>
      <PageHeader
        title="Packaging Materials"
        description="Cartons · wrap · labels · tape · seals · shrink · pallets · stock"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add material</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Packaging material</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.material_code} onChange={(e) => setForm((f) => ({ ...f, material_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MATERIAL_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Stock</Label>
                      <Input type="number" value={form.stock_qty} onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Reorder</Label>
                      <Input type="number" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Unit cost</Label>
                      <Input type="number" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Storage location</Label>
                    <Input value={form.storage_location} onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No materials" description="Apply migration seed or add packaging materials." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const low = Number(r.stock_qty) <= Number(r.reorder_level);
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.material_code)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                    <TableCell className="capitalize text-sm">{String(r.category)}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.stock_qty))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.reorder_level))}</TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.unit_cost))}</TableCell>
                    <TableCell className="text-xs">{String(r.storage_location || "—")}</TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive" className="text-[10px]">Reorder</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">OK</Badge>
                      )}
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
