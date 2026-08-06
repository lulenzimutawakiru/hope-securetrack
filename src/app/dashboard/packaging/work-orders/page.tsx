"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
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
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { createWorkOrder } from "@/lib/packaging";

export default function PkgWorkOrdersPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "Premium A4 Copy Paper",
    product_code: "HDG-PPR-A4",
    quantity_units: "500",
    source_type: "production",
    source_ref: "",
    line_id: "",
    due_date: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data }, { data: ln }] = await Promise.all([
      sb.from("pkg_work_orders").select("*, pkg_lines(name)").is("deleted_at", null).order("created_at", { ascending: false }),
      sb.from("pkg_lines").select("id,name,line_code").eq("is_active", true),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLines((ln as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const { wo, cartonization } = await createWorkOrder({
        company_id: companyId,
        product_name: form.product_name,
        product_code: form.product_code,
        quantity_units: Number(form.quantity_units) || 0,
        source_type: form.source_type,
        source_ref: form.source_ref,
        line_id: form.line_id || null,
        due_date: form.due_date || undefined,
        created_by: auth?.user?.id,
      });
      toast.success(
        `${wo.wo_number} · ${cartonization.cartons_required} cartons · ${cartonization.pallets_required} pallets`
      );
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "in_progress") patch.started_at = new Date().toISOString();
    await crudUpdate("pkg_work_orders", id, patch);
    toast.success(`Status → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading work orders…" />;

  return (
    <div>
      <PageHeader
        title="Packing Work Orders"
        description="From production · sales · transfer · export"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New work order</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Create packing WO</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Product</Label>
                    <Input required value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input value={form.product_code} onChange={(e) => setForm((f) => ({ ...f, product_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Quantity (units)</Label>
                      <Input type="number" required value={form.quantity_units} onChange={(e) => setForm((f) => ({ ...f, quantity_units: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Source</Label>
                      <Select value={form.source_type} onValueChange={(v) => setForm((f) => ({ ...f, source_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="sales">Sales order</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="export">Export</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Source ref</Label>
                      <Input value={form.source_ref} onChange={(e) => setForm((f) => ({ ...f, source_ref: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Line</Label>
                      <Select value={form.line_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, line_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {lines.map((l) => (
                            <SelectItem key={String(l.id)} value={String(l.id)}>{String(l.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due date</Label>
                      <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create & release</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No work orders" description="Create packing WOs from production quantity." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Line</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Cartons</TableHead>
                <TableHead className="text-right">Pallets</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ln = r.pkg_lines as { name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.wo_number)}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {String(r.product_name)}
                      <div className="text-[10px] text-muted-foreground">{String(r.source_type)} · {String(r.source_ref || "")}</div>
                    </TableCell>
                    <TableCell className="text-sm">{ln?.name || "—"}</TableCell>
                    <TableCell className="text-right">{String(r.quantity_units)}</TableCell>
                    <TableCell className="text-right">
                      {String(r.quantity_cartons_done || 0)}/{String(r.quantity_cartons_planned || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {String(r.quantity_pallets_done || 0)}/{String(r.quantity_pallets_planned || 0)}
                    </TableCell>
                    <TableCell className="text-xs">{r.due_date ? formatDate(String(r.due_date)) : "—"}</TableCell>
                    <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                    <TableCell className="space-x-1">
                      {r.status === "released" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "in_progress")}>Start</Button>
                      )}
                      {r.status === "in_progress" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "completed")}>Complete</Button>
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
