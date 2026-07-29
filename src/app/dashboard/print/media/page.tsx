"use client";

import { useEffect, useState } from "react";
import { Radio, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

export default function PrintMediaPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    media_code: "",
    name: "",
    media_type: "label",
    width_mm: "50",
    height_mm: "30",
    stock_qty: "100",
    reorder_level: "50",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("prt_media")
      .select("*")
      .order("width_mm");
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
      const { error } = await createClient().from("prt_media").insert({
        company_id: companyId,
        media_code: form.media_code.toUpperCase(),
        name: form.name,
        media_type: form.media_type,
        width_mm: Number(form.width_mm),
        height_mm: Number(form.height_mm) || null,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 50,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Media added");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading media…" />;

  return (
    <div>
      <PageHeader
        title="Media Stock"
        description="Label sizes · cards · A4 · continuous · reorder levels"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add media</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Media SKU</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.media_code} onChange={(e) => setForm((f) => ({ ...f, media_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Input value={form.media_type} onChange={(e) => setForm((f) => ({ ...f, media_type: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Width mm</Label>
                      <Input value={form.width_mm} onChange={(e) => setForm((f) => ({ ...f, width_mm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Height mm</Label>
                      <Input value={form.height_mm} onChange={(e) => setForm((f) => ({ ...f, height_mm: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Stock</Label>
                      <Input type="number" value={form.stock_qty} onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Reorder level</Label>
                      <Input type="number" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Radio} title="No media" description="Track label stock by size and brand compatibility." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const low = Number(r.stock_qty) <= Number(r.reorder_level);
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.media_code)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-sm">
                      {String(r.width_mm)}
                      {r.height_mm != null ? `×${String(r.height_mm)}` : ""} mm
                    </TableCell>
                    <TableCell className="text-right">{String(r.stock_qty)}</TableCell>
                    <TableCell className="text-right">{String(r.reorder_level)}</TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive" className="text-[10px]">Low stock</Badge>
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
