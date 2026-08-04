"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
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
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudList, crudUpdate } from "@/lib/api/crud-client";
import { createMaintenanceFromTag } from "@/lib/assets";

export default function AssetMaintenancePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    title: "",
    maintenance_type: "preventive",
    scheduled_date: "",
    notes: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const [maintRes, astRes] = await Promise.all([
      crudList<Record<string, unknown>>("ast_maintenance_links", {
        page: 1,
        pageSize: 100,
        sort: "created_at",
        order: "desc",
      }),
      crudList<Record<string, unknown>>("ast_assets", {
        page: 1,
        pageSize: 100,
        sort: "asset_tag",
        order: "asc",
      }),
    ]);
    setRows(maintRes.ok ? maintRes.data.data : []);
    setAssets(astRes.ok ? astRes.data.data : []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.asset_id) return;
    try {
      await createMaintenanceFromTag({
        company_id: companyId,
        asset_id: form.asset_id,
        title: form.title,
        maintenance_type: form.maintenance_type,
        scheduled_date: form.scheduled_date || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Maintenance linked");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const closeWo = async (id: string, assetId: string) => {
    const crudRes2 = await crudUpdate("ast_maintenance_links", id, { status: "completed", completed_at: new Date().toISOString() });
    const crudRes = await crudUpdate("ast_assets", assetId, { status: "active", updated_at: new Date().toISOString() });
    toast.success("Completed");
    await load();
  };

  if (loading) return <LoadingState message="Loading maintenance…" />;

  return (
    <div>
      <PageHeader
        title="Asset Maintenance"
        description="Preventive · corrective · calibration · spare parts · scan-to-WO"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/service-desk">Service desk</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New request</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create}>
                  <DialogHeader><DialogTitle>Maintenance from tag</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Asset</Label>
                      <Select value={form.asset_id} onValueChange={(v) => setForm((f) => ({ ...f, asset_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {assets.map((a) => (
                            <SelectItem key={String(a.id)} value={String(a.id)}>
                              {String(a.asset_tag)} — {String(a.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.maintenance_type} onValueChange={(v) => setForm((f) => ({ ...f, maintenance_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="preventive">Preventive</SelectItem>
                            <SelectItem value="corrective">Corrective</SelectItem>
                            <SelectItem value="calibration">Calibration</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Scheduled</Label>
                        <Input type="date" value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Notes</Label>
                      <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No maintenance records" description="Scan a tag on the twin page to open a request." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const a = r.ast_assets as { asset_tag?: string; name?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-xs">{String(r.work_order_ref)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/assets/${r.asset_id}`} className="text-primary text-xs font-mono hover:underline">
                        {a?.asset_tag}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{String(r.title)}</TableCell>
                    <TableCell className="capitalize text-xs">{String(r.maintenance_type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">{String(r.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => closeWo(String(r.id), String(r.asset_id))}>
                          <Wrench className="h-3 w-3 mr-1" /> Complete
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
