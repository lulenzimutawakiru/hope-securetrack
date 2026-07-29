"use client";

import { useEffect, useState } from "react";
import { ListOrdered, Plus, Play, Check, X, Pause } from "lucide-react";
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
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { DOCUMENT_TYPES, enqueuePrint, advanceQueueItem } from "@/lib/print";

export default function PrintQueuePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    job_title: "",
    document_type: "qr_auth",
    printer_id: "",
    template_id: "",
    copies: "1",
    priority: "5",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }, { data: tpl }] = await Promise.all([
      sb.from("prt_queue").select("*, printers(name,model)").is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
      sb.from("printers").select("id,name,model").eq("is_active", true),
      sb.from("prt_templates").select("id,name,template_code").is("deleted_at", null).eq("status", "published"),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setTemplates((tpl as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await enqueuePrint({
        company_id: companyId,
        job_title: form.job_title,
        document_type: form.document_type,
        printer_id: form.printer_id || null,
        template_id: form.template_id || null,
        copies: Number(form.copies) || 1,
        priority: Number(form.priority) || 5,
        submitted_by: auth?.user?.id,
      });
      toast.success("Job queued");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: "printing" | "completed" | "failed" | "cancelled" | "held") => {
    try {
      await advanceQueueItem(id, status);
      toast.success(`Marked ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading print queue…" />;

  const queued = rows.filter((r) => r.status === "queued").length;
  const printing = rows.filter((r) => r.status === "printing").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const done = rows.filter((r) => r.status === "completed").length;

  return (
    <div>
      <PageHeader
        title="Print Queue"
        description="Industrial queue · priority · batch · reprint · multi-device"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Queue job</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader><DialogTitle>Submit print job</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Document type</Label>
                    <Select value={form.document_type} onValueChange={(v) => setForm((f) => ({ ...f, document_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Printer</Label>
                    <Select value={form.printer_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, printer_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Auto / default</SelectItem>
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
                        <SelectItem value="none">None</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Copies</Label>
                      <Input type="number" value={form.copies} onChange={(e) => setForm((f) => ({ ...f, copies: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Priority (1–10)</Label>
                      <Input type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Enqueue</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Queued" value={String(queued)} />
        <StatCard title="Printing" value={String(printing)} />
        <StatCard title="Completed" value={String(done)} />
        <StatCard title="Failed" value={String(failed)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ListOrdered} title="Queue empty" description="Submit label or document print jobs." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pri</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.queue_number)}</TableCell>
                    <TableCell className="text-sm font-medium">{String(r.job_title)}</TableCell>
                    <TableCell className="text-sm">{pr?.name || "—"}</TableCell>
                    <TableCell className="text-xs capitalize">{String(r.document_type)}</TableCell>
                    <TableCell>{String(r.priority)}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_at ? formatDateTime(String(r.created_at)) : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "queued" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "printing")}>
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(String(r.id), "held")}>
                            <Pause className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {r.status === "printing" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "completed")}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(String(r.id), "failed")}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {(r.status === "failed" || r.status === "held") && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "printing")}>
                          Retry
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
