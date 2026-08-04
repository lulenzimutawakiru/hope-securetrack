"use client";

import { useEffect, useState } from "react";
import { Scale, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { recordWeight } from "@/lib/packaging";

export default function PkgWeighingPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    entity_type: "carton",
    entity_serial: "",
    gross_weight_kg: "",
    tare_weight_kg: "0.45",
    length_mm: "320",
    width_mm: "240",
    height_mm: "280",
    expected_kg: "12.95",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_weights")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(100);
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
      const rec = await recordWeight({
        company_id: companyId,
        entity_type: form.entity_type as "carton" | "pallet",
        entity_serial: form.entity_serial.toUpperCase(),
        gross_weight_kg: Number(form.gross_weight_kg),
        tare_weight_kg: Number(form.tare_weight_kg) || 0,
        length_mm: Number(form.length_mm) || undefined,
        width_mm: Number(form.width_mm) || undefined,
        height_mm: Number(form.height_mm) || undefined,
        expected_kg: Number(form.expected_kg) || undefined,
        recorded_by: auth?.user?.id,
      });
      toast.success(`Weight recorded · ${rec.status}`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading weights…" />;

  return (
    <div>
      <PageHeader
        title="Weight & Dimensions"
        description="Digital scale capture · under/overweight alerts · volume"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record weight</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Weigh package</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.entity_type} onValueChange={(v) => setForm((f) => ({ ...f, entity_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carton">Carton</SelectItem>
                          <SelectItem value="pallet">Pallet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Serial</Label>
                      <Input required value={form.entity_serial} onChange={(e) => setForm((f) => ({ ...f, entity_serial: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Gross kg</Label>
                      <Input type="number" step="0.001" required value={form.gross_weight_kg} onChange={(e) => setForm((f) => ({ ...f, gross_weight_kg: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Tare kg</Label>
                      <Input type="number" step="0.001" value={form.tare_weight_kg} onChange={(e) => setForm((f) => ({ ...f, tare_weight_kg: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>L mm</Label>
                      <Input value={form.length_mm} onChange={(e) => setForm((f) => ({ ...f, length_mm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>W mm</Label>
                      <Input value={form.width_mm} onChange={(e) => setForm((f) => ({ ...f, width_mm: e.target.value }))} />
                    </div>
                    <div>
                      <Label>H mm</Label>
                      <Input value={form.height_mm} onChange={(e) => setForm((f) => ({ ...f, height_mm: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Expected gross kg</Label>
                    <Input type="number" step="0.01" value={form.expected_kg} onChange={(e) => setForm((f) => ({ ...f, expected_kg: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Scale} title="No weight records" description="Capture scale readings for cartons and pallets." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Dims mm</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.entity_serial)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.entity_type)}</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.gross_weight_kg))}</TableCell>
                  <TableCell className="text-right">{formatNumber(Number(r.net_weight_kg))}</TableCell>
                  <TableCell className="text-xs">
                    {r.length_mm ? `${r.length_mm}×${r.width_mm}×${r.height_mm}` : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.recorded_at ? formatDateTime(String(r.recorded_at)) : "—"}
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
