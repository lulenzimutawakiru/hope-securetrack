"use client";

import { useEffect, useState } from "react";
import { Factory, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { LINE_STATUSES } from "@/lib/packaging";

export default function PkgLinesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    line_code: "",
    name: "",
    warehouse_name: "Main Warehouse",
    supervisor_name: "",
    capacity_units_hour: "200",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("pkg_lines")
      .select("*")
      .eq("is_active", true)
      .order("line_code");
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
      const crudRes2 = await crudCreate("pkg_lines", {
        company_id: companyId,
        line_code: form.line_code.toUpperCase(),
        name: form.name,
        warehouse_name: form.warehouse_name,
        supervisor_name: form.supervisor_name,
        capacity_units_hour: Number(form.capacity_units_hour) || 200,
        status: "idle",
        is_active: true,
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success("Line created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    const crudRes = await crudUpdate("pkg_lines", id, { status });
    await load();
  };

  if (loading) return <LoadingState message="Loading packing lines…" />;

  return (
    <div>
      <PageHeader
        title="Packing Lines"
        description="Capacity · operators · efficiency · live status"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add line</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Packing line</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.line_code} onChange={(e) => setForm((f) => ({ ...f, line_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Capacity u/h</Label>
                      <Input value={form.capacity_units_hour} onChange={(e) => setForm((f) => ({ ...f, capacity_units_hour: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Warehouse</Label>
                      <Input value={form.warehouse_name} onChange={(e) => setForm((f) => ({ ...f, warehouse_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Supervisor</Label>
                      <Input value={form.supervisor_name} onChange={(e) => setForm((f) => ({ ...f, supervisor_name: e.target.value }))} />
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
        <EmptyState icon={Factory} title="No packing lines" description="Seed or create production packing lines." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={String(r.id)} className={r.status === "running" ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{String(r.name)}</CardTitle>
                  <Badge variant={r.status === "running" ? "default" : "outline"} className="capitalize">
                    {String(r.status)}
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">{String(r.line_code)}</p>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>Warehouse: {String(r.warehouse_name || "—")}</p>
                <p>Supervisor: {String(r.supervisor_name || "—")}</p>
                <p>Capacity: {String(r.capacity_units_hour)} u/h · Eff {String(r.efficiency_pct)}%</p>
                <div className="flex flex-wrap gap-1 pt-2">
                  {LINE_STATUSES.map((s) => (
                    <Button key={s} size="sm" variant="outline" className="h-7 text-[10px] capitalize" onClick={() => setStatus(String(r.id), s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
