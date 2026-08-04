"use client";

import { useEffect, useState } from "react";
import { Tag, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { nextPrtCode, createHighVolumeBatch } from "@/lib/print";

export default function ProductLabelsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "Premium A4 Copy Paper",
    sku: "HDG-PPR-A4",
    batch_number: "",
    quantity: "100",
    serial_prefix: "HDG-REAM",
    mfg_date: new Date().toISOString().slice(0, 10),
    expiry_date: "",
    production_line: "Line A",
    quality_status: "approved",
    printer_id: "",
    template_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }, { data: tpl }] = await Promise.all([
      sb.from("prt_product_label_jobs").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("printers").select("id,name").eq("is_active", true),
      sb.from("prt_templates").select("id,name").is("deleted_at", null),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setTemplates((tpl as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    try {
      const qty = Number(form.quantity) || 1;
      const job_number = await nextPrtCode(companyId, "prt_product_label_jobs", "PLJ");
      const batch = await createHighVolumeBatch({
        company_id: companyId,
        name: `${form.product_name} · ${form.batch_number || job_number}`,
        quantity: qty,
        serial_prefix: form.serial_prefix,
        printer_id: form.printer_id || null,
        template_id: form.template_id || null,
        product_name: form.product_name,
        batch_number: form.batch_number || job_number,
        created_by: auth?.user?.id,
      });

      const crudRes = await crudCreate("prt_product_label_jobs", {
        company_id: companyId,
        job_number,
        product_name: form.product_name,
        sku: form.sku,
        batch_number: form.batch_number || batch.batch_number,
        serial_start: `${form.serial_prefix}-000001`,
        serial_end: `${form.serial_prefix}-${String(qty).padStart(6, "0")}`,
        quantity: qty,
        mfg_date: form.mfg_date || null,
        expiry_date: form.expiry_date || null,
        production_line: form.production_line,
        quality_status: form.quality_status,
        printer_id: form.printer_id || null,
        template_id: form.template_id || null,
        batch_id: batch.id,
        status: "printing",
        created_by: auth?.user?.id,
      });

      toast.success(`Queued product labels · batch ${batch.batch_number} · ${qty} planned`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading product labels…" />;

  return (
    <div>
      <PageHeader
        title="Product Label Printing"
        description="SKU · QR auth · barcode · batch · serial · mfg/expiry · line · QC"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Production labels</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Manufacturing product labels</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product name</Label>
                    <Input required value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>SKU</Label>
                      <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Batch #</Label>
                      <Input value={form.batch_number} onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value }))} placeholder="B240722A" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantity</Label>
                      <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground mt-1">Up to 100k tracked; browser enqueues first 500</p>
                    </div>
                    <div>
                      <Label>Serial prefix</Label>
                      <Input value={form.serial_prefix} onChange={(e) => setForm((f) => ({ ...f, serial_prefix: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Mfg date</Label>
                      <Input type="date" value={form.mfg_date} onChange={(e) => setForm((f) => ({ ...f, mfg_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Expiry</Label>
                      <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Line</Label>
                      <Input value={form.production_line} onChange={(e) => setForm((f) => ({ ...f, production_line: e.target.value }))} />
                    </div>
                    <div>
                      <Label>QC status</Label>
                      <Select value={form.quality_status} onValueChange={(v) => setForm((f) => ({ ...f, quality_status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="hold">Hold</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Printer</Label>
                      <Select value={form.printer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, printer_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          {printers.map((p) => (
                            <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Template</Label>
                      <Select value={form.template_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, template_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">QR ream default</SelectItem>
                          {templates.map((t) => (
                            <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>{busy ? "Queueing…" : "Generate & queue"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Tag} title="No product label jobs" description="Create manufacturing authentication labels." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU / Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>QC</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.job_number)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.product_name)}</TableCell>
                  <TableCell className="text-xs">
                    {String(r.sku || "—")}
                    <div className="text-muted-foreground">{String(r.batch_number || "")}</div>
                  </TableCell>
                  <TableCell className="text-right">{String(r.quantity)}</TableCell>
                  <TableCell className="text-sm">{String(r.production_line || "—")}</TableCell>
                  <TableCell className="capitalize text-sm">{String(r.quality_status)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
