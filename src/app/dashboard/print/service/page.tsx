"use client";

import { useEffect, useState } from "react";
import { Wrench, Plus } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function PrintServicePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [printers, setPrinters] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    printer_id: "",
    service_type: "maintenance",
    description: "",
    cost: "0",
    performed_by: "",
    service_date: new Date().toISOString().slice(0, 10),
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: pr }] = await Promise.all([
      sb.from("prt_service_logs").select("*, printers(name,model)").order("service_date", { ascending: false }),
      sb.from("printers").select("id,name").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setPrinters((pr as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.printer_id) return;
    try {
      const crudRes = await crudCreate("prt_service_logs", {
        company_id: companyId,
        printer_id: form.printer_id,
        service_type: form.service_type,
        description: form.description,
        cost: Number(form.cost) || 0,
        performed_by: form.performed_by,
        service_date: form.service_date,
        created_by: auth?.user?.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Service log added");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading service history…" />;

  return (
    <div>
      <PageHeader
        title="Printer Service History"
        description="Maintenance · repair · calibration · firmware · warranty tracking"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log service</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Service log</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Printer</Label>
                    <Select value={form.printer_id} onValueChange={(v) => setForm((f) => ({ ...f, printer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {printers.map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="install">Install</SelectItem>
                          <SelectItem value="calibration">Calibration</SelectItem>
                          <SelectItem value="firmware">Firmware</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={form.service_date} onChange={(e) => setForm((f) => ({ ...f, service_date: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Cost</Label>
                      <Input type="number" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Performed by</Label>
                      <Input value={form.performed_by} onChange={(e) => setForm((f) => ({ ...f, performed_by: e.target.value }))} />
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
        <EmptyState icon={Wrench} title="No service logs" description="Record maintenance and repairs per device." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pr = r.printers as { name?: string; model?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-sm">
                      {r.service_date ? formatDate(String(r.service_date)) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {pr?.name || "—"}
                      <div className="text-[10px] text-muted-foreground">{pr?.model}</div>
                    </TableCell>
                    <TableCell className="capitalize text-sm">{String(r.service_type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {String(r.description || "—")}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(Number(r.cost || 0))}</TableCell>
                    <TableCell className="text-sm">{String(r.performed_by || "—")}</TableCell>
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
