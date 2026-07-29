"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldCheck, AlertTriangle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { INSPECTION_TYPES, createInspection, completeInspection } from "@/lib/mes";

export default function QualityMesPage() {
  const { auth } = useUser();
  const [inspections, setInspections] = useState<Array<Record<string, unknown>>>([]);
  const [ncrs, setNcrs] = useState<Array<Record<string, unknown>>>([]);
  const [plans, setPlans] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; product_id: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    production_order_id: "",
    plan_id: "",
    inspection_type: "final",
    sample_size: "10",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: qi }, { data: ncr }, { data: pl }, { data: po }] = await Promise.all([
      supabase.from("mes_quality_inspections").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("mes_ncr").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("mes_quality_plans").select("*").eq("is_active", true),
      supabase.from("mes_production_orders").select("id,order_number,product_id").is("deleted_at", null).limit(100),
    ]);
    setInspections((qi as Array<Record<string, unknown>>) || []);
    setNcrs((ncr as Array<Record<string, unknown>>) || []);
    setPlans((pl as Array<Record<string, unknown>>) || []);
    setOrders((po as typeof orders) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const order = orders.find((o) => o.id === form.production_order_id);
    setSaving(true);
    try {
      await createInspection({
        company_id: companyId,
        production_order_id: form.production_order_id || null,
        product_id: order?.product_id || null,
        plan_id: form.plan_id || null,
        inspection_type: form.inspection_type,
        sample_size: Number(form.sample_size) || 0,
        inspector_id: auth?.user?.id,
      });
      toast.success("Inspection created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const finish = async (id: string, passed: boolean, productionOrderId?: string | null) => {
    if (!companyId) return;
    try {
      await completeInspection({
        inspection_id: id,
        passed,
        defects: passed ? 0 : 1,
        create_ncr: !passed,
        company_id: companyId,
        production_order_id: productionOrderId,
        created_by: auth?.user?.id,
        ncr_title: "Auto NCR from failed inspection",
      });
      toast.success(passed ? "Inspection passed" : "Failed — NCR opened");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const closeNcr = async (id: string) => {
    const { error } = await createClient()
      .from("mes_ncr")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        corrective_action: "Corrective action completed",
        preventive_action: "Process control updated",
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("NCR closed with CAPA");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading quality…" />;

  const openNcr = ncrs.filter((n) => n.status === "open").length;
  const passed = inspections.filter((i) => i.status === "passed").length;

  return (
    <div>
      <PageHeader
        title="Quality Management"
        description="Incoming · in-process · final · laboratory · NCR · CAPA"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Inspection</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>New inspection</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Production order</Label>
                    <Select value={form.production_order_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, production_order_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {orders.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={form.plan_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ad-hoc</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>
                            {String(p.plan_code)} — {String(p.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.inspection_type} onValueChange={(v) => setForm((f) => ({ ...f, inspection_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INSPECTION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sample size</Label>
                      <Input type="number" value={form.sample_size} onChange={(e) => setForm((f) => ({ ...f, sample_size: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={saving}>Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Inspections" value={String(inspections.length)} icon={ShieldCheck} />
        <StatCard title="Passed" value={String(passed)} icon={ShieldCheck} />
        <StatCard title="Open NCR" value={String(openNcr)} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="inspections">
        <TabsList>
          <TabsTrigger value="inspections">Inspections</TabsTrigger>
          <TabsTrigger value="ncr">NCR / CAPA</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>
        <TabsContent value="inspections" className="mt-4">
          {inspections.length === 0 ? (
            <EmptyState title="No inspections" description="Create in-process or final QC records." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Defects</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.map((i) => (
                    <TableRow key={String(i.id)}>
                      <TableCell className="font-mono text-sm">{String(i.inspection_number)}</TableCell>
                      <TableCell className="capitalize text-sm">{String(i.inspection_type)}</TableCell>
                      <TableCell>{String(i.sample_size ?? 0)}</TableCell>
                      <TableCell>{String(i.defects ?? 0)}</TableCell>
                      <TableCell><StatusBadge status={String(i.status)} /></TableCell>
                      <TableCell className="text-xs">{i.created_at ? formatDate(String(i.created_at)) : "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {(i.status === "pending" || i.status === "in_progress") && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => finish(String(i.id), true, i.production_order_id as string)}>Pass</Button>
                            <Button size="sm" variant="destructive" onClick={() => finish(String(i.id), false, i.production_order_id as string)}>Fail</Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="ncr" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NCR</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ncrs.map((n) => (
                  <TableRow key={String(n.id)}>
                    <TableCell className="font-mono text-sm">{String(n.ncr_number)}</TableCell>
                    <TableCell>{String(n.title)}</TableCell>
                    <TableCell className="capitalize">{String(n.severity)}</TableCell>
                    <TableCell><StatusBadge status={String(n.status)} /></TableCell>
                    <TableCell>
                      {n.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => closeNcr(String(n.id))}>Close CAPA</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ncrs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No NCRs.</p>}
          </div>
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell className="font-mono text-sm">{String(p.plan_code)}</TableCell>
                    <TableCell>{String(p.name)}</TableCell>
                    <TableCell className="capitalize">{String(p.inspection_type)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
