"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, FileText } from "lucide-react";
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
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { createInvoice } from "@/lib/billing";
import { formatNumber } from "@/lib/utils";

export default function ProjectBillingPage() {
  const { auth } = useUser();
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([]);
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    billing_type: "time_material",
    budget: "5000000",
  });
  const [entryForm, setEntryForm] = useState({
    project_id: "",
    entry_type: "labor",
    description: "",
    quantity: "8",
    unit_rate: "75000",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: p }, { data: e }, { data: c }] = await Promise.all([
      supabase.from("bill_projects").select("*, customers(name)").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("bill_project_entries").select("*").eq("billable", true).order("entry_date", { ascending: false }).limit(100),
      supabase.from("customers").select("id,name").eq("is_active", true),
    ]);
    setProjects(p ?? []);
    setEntries(e ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const num = `PRJ-${new Date().getFullYear()}-${String(projects.length + 1).padStart(4, "0")}`;
      const crudRes4 = await crudCreate("bill_projects", {
        company_id: auth.profile.company_id,
        project_number: num,
        customer_id: form.customer_id || null,
        name: form.name,
        billing_type: form.billing_type,
        budget_amount: Number(form.budget) || 0,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      });
      if (!crudRes4.ok) throw new Error(crudRes4.error);
      toast.success("Project created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !entryForm.project_id) return;
    try {
      const qty = Number(entryForm.quantity) || 0;
      const rate = Number(entryForm.unit_rate) || 0;
      const supabase = createClient();
      const crudRes3 = await crudCreate("bill_project_entries", {
        company_id: auth.profile.company_id,
        project_id: entryForm.project_id,
        entry_type: entryForm.entry_type,
        description: entryForm.description,
        quantity: qty,
        unit: entryForm.entry_type === "labor" ? "hour" : "ea",
        unit_rate: rate,
        amount: qty * rate,
        billable: true,
        invoiced: false,
        created_by: auth.profile.id,
      });
      if (!crudRes3.ok) throw new Error(crudRes3.error);
      toast.success("Time/expense captured");
      setEntryOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const invoiceUnbilled = async (projectId: string) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const { data: proj } = await supabase.from("bill_projects").select("*").eq("id", projectId).single();
      if (!proj) throw new Error("Project not found");
      const unbilled = entries.filter(
        (e) => e.project_id === projectId && !e.invoiced
      );
      if (!unbilled.length) {
        toast.message("No unbilled entries");
        return;
      }
      const inv = await createInvoice(supabase, {
        company_id: auth.profile.company_id,
        customer_id: proj.customer_id,
        invoice_type: "tax",
        source_type: "project",
        source_ref: proj.project_number,
        notes: `Project billing: ${proj.name}`,
        lines: unbilled.map((e) => ({
          description: `${e.entry_type}: ${e.description || ""}`,
          quantity: Number(e.quantity),
          unit: String(e.unit || "ea"),
          unit_price: Number(e.unit_rate),
          tax_code: "VAT18",
          tax_rate: 18,
          line_type: String(e.entry_type),
        })),
        created_by: auth.profile.id,
      });
      for (const entry of unbilled) {
        const crudRes5 = await crudUpdate("bill_project_entries", String(entry.id), {
          invoiced: true,
          invoice_id: inv.id,
        });
        if (!crudRes5.ok) throw new Error(crudRes5.error);
      }
      const crudRes2 = await crudUpdate("bill_projects", projectId, {
          billed_amount: Number(proj.billed_amount || 0) + Number(inv.total_amount),
        });
      const crudRes = await crudUpdate("invoices", inv.id, { project_id: projectId });
      toast.success(`Invoice ${inv.invoice_number} from project entries`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading project billing…" />;

  return (
    <div>
      <PageHeader
        title="Project Billing"
        description="Time & material · fixed price · milestones · retainers · expenses"
        actions={
          <div className="flex gap-2">
            <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Capture time/expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Billable entry</DialogTitle></DialogHeader>
                <form onSubmit={addEntry} className="space-y-3">
                  <div>
                    <Label>Project</Label>
                    <Select value={entryForm.project_id} onValueChange={(v) => setEntryForm((f) => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={String(p.id)} value={String(p.id)}>{String(p.project_number)} · {String(p.name)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={entryForm.entry_type} onValueChange={(v) => setEntryForm((f) => ({ ...f, entry_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["labor", "materials", "equipment", "travel", "expense"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Description</Label><Input required value={entryForm.description} onChange={(e) => setEntryForm((f) => ({ ...f, description: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Qty / hours</Label><Input type="number" value={entryForm.quantity} onChange={(e) => setEntryForm((f) => ({ ...f, quantity: e.target.value }))} /></div>
                    <div><Label>Rate</Label><Input type="number" value={entryForm.unit_rate} onChange={(e) => setEntryForm((f) => ({ ...f, unit_rate: e.target.value }))} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Save entry</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New project</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Project</DialogTitle></DialogHeader>
                <form onSubmit={createProject} className="space-y-3">
                  <div>
                    <Label>Customer</Label>
                    <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div>
                    <Label>Billing type</Label>
                    <Select value={form.billing_type} onValueChange={(v) => setForm((f) => ({ ...f, billing_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["time_material", "fixed_price", "milestone", "retainer"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} /></div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState title="No projects" icon={Briefcase} />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Billed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={String(p.id)}>
                  <TableCell>
                    <div className="font-mono text-xs">{String(p.project_number)}</div>
                    <div>{String(p.name)}</div>
                  </TableCell>
                  <TableCell>{(p.customers as { name?: string } | null)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{String(p.billing_type)}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(p.budget_amount))}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(p.billed_amount))}</TableCell>
                  <TableCell><StatusBadge status={String(p.status)} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => invoiceUnbilled(String(p.id))}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> Invoice unbilled
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2">Recent billable entries</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Invoiced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={String(e.id)}>
                <TableCell className="text-xs">{String(e.entry_type)}</TableCell>
                <TableCell className="text-xs">{String(e.description)}</TableCell>
                <TableCell className="text-xs">{Number(e.quantity)}</TableCell>
                <TableCell className="text-xs">{formatNumber(Number(e.unit_rate))}</TableCell>
                <TableCell className="text-xs">{formatNumber(Number(e.amount))}</TableCell>
                <TableCell>{e.invoiced ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
