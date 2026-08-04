"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { runQcCheck } from "@/lib/packaging";

const CHECKS = [
  "product_ok",
  "quantity_ok",
  "packaging_ok",
  "label_ok",
  "qr_ok",
  "weight_ok",
  "seal_ok",
] as const;

export default function PkgQcPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    entity_type: "carton",
    entity_serial: "",
    defect_reason: "",
    product_ok: true,
    quantity_ok: true,
    packaging_ok: true,
    label_ok: true,
    qr_ok: true,
    weight_ok: true,
    seal_ok: true,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_qc_checks")
      .select("*")
      .order("checked_at", { ascending: false })
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
      const rec = await runQcCheck({
        company_id: companyId,
        entity_type: form.entity_type as "ream" | "carton" | "pallet",
        entity_serial: form.entity_serial.toUpperCase(),
        product_ok: form.product_ok,
        quantity_ok: form.quantity_ok,
        packaging_ok: form.packaging_ok,
        label_ok: form.label_ok,
        qr_ok: form.qr_ok,
        weight_ok: form.weight_ok,
        seal_ok: form.seal_ok,
        defect_reason: form.defect_reason,
        checked_by: auth?.user?.id,
      });
      toast.success(`QC ${rec.overall_status} · ${rec.check_number}`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading QC checks…" />;

  return (
    <div>
      <PageHeader
        title="Packing Quality Control"
        description="Product · qty · packaging · label · QR · weight · seal"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New QC check</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Packing QC checkpoint</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Entity</Label>
                      <Select value={form.entity_type} onValueChange={(v) => setForm((f) => ({ ...f, entity_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ream">Ream</SelectItem>
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
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {CHECKS.map((c) => (
                      <label key={c} className="flex items-center gap-2 capitalize">
                        <input
                          type="checkbox"
                          checked={Boolean(form[c])}
                          onChange={(e) => setForm((f) => ({ ...f, [c]: e.target.checked }))}
                        />
                        {c.replace(/_ok$/, "").replace(/_/g, " ")}
                      </label>
                    ))}
                  </div>
                  <div>
                    <Label>Defect reason (if fail)</Label>
                    <Input value={form.defect_reason} onChange={(e) => setForm((f) => ({ ...f, defect_reason: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Submit QC</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No QC checks" description="Run mandatory packing checkpoints." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.check_number)}</TableCell>
                  <TableCell className="font-mono text-sm">{String(r.entity_serial)}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.entity_type)}</TableCell>
                  <TableCell><StatusBadge status={String(r.overall_status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {String(r.defect_reason || "—")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.checked_at ? formatDateTime(String(r.checked_at)) : "—"}
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
