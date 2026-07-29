"use client";

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { createHighVolumeBatch, pauseBatch, resumeBatch } from "@/lib/print";

export default function PrintBatchesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    count: "10",
    prefix: "HDG-REAM",
    printer_id: "",
    template_id: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }, { data: tpl }] = await Promise.all([
      sb.from("prt_batches").select("*, printers(name)").is("deleted_at", null).order("created_at", { ascending: false }),
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

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const n = Math.min(100000, Math.max(1, Number(form.count) || 1));
      const batch = await createHighVolumeBatch({
        company_id: companyId,
        name: form.name,
        quantity: n,
        serial_prefix: form.prefix,
        printer_id: form.printer_id || null,
        template_id: form.template_id || null,
        product_name: "Premium A4 Copy Paper",
        created_by: auth?.user?.id,
      });
      toast.success(
        `Batch ${batch.batch_number} · ${n} planned · ${batch.completed_items || 0} enqueued`
      );
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const togglePause = async (r: Record<string, unknown>) => {
    try {
      if (r.status === "paused") {
        await resumeBatch(String(r.id));
        toast.success("Batch resumed");
      } else {
        await pauseBatch(String(r.id));
        toast.success("Batch paused");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading batch prints…" />;

  return (
    <div>
      <PageHeader
        title="Batch Print Automation"
        description="Bulk QR labels · continuous runs · production link"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New batch</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={run}>
                <DialogHeader><DialogTitle>Start batch print</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Batch name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Quantity (up to 100k)</Label>
                      <Input type="number" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Serial prefix</Label>
                      <Input value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
                    </div>
                  </div>
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
                        <SelectItem value="none">Default QR</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Queue batch</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No batches" description="Create bulk authentication label runs." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Done</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.batch_number)}</TableCell>
                    <TableCell className="font-medium text-sm">{String(r.name)}</TableCell>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell className="text-right">{String(r.total_items)}</TableCell>
                    <TableCell className="text-right">{String(r.completed_items)}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.started_at ? formatDateTime(String(r.started_at)) : "—"}
                    </TableCell>
                    <TableCell>
                      {(r.status === "running" || r.status === "paused") && (
                        <Button size="sm" variant="outline" onClick={() => togglePause(r)}>
                          {r.status === "paused" ? "Resume" : "Pause"}
                        </Button>
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
