"use client";

import { useEffect, useState } from "react";
import { Repeat, Plus, Play } from "lucide-react";
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
import { runRecurringSchedule } from "@/lib/billing";
import { formatDate } from "@/lib/utils";

type Sch = {
  id: string;
  schedule_number: string;
  name: string;
  frequency: string;
  next_run_date: string | null;
  last_run_date: string | null;
  status: string;
  invoices_generated: number;
  currency: string;
  customers?: { name: string } | null;
};

export default function RecurringBillingPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Sch[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    name: "",
    frequency: "monthly",
    amount: "150000",
    description: "Monthly subscription",
    tax_code: "VAT18",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: cust }] = await Promise.all([
      supabase
        .from("bill_recurring_schedules")
        .select("*, customers(name)")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").eq("is_active", true).order("name"),
    ]);
    setRows((data as Sch[]) ?? []);
    setCustomers(cust ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.customer_id) return;
    try {
      const supabase = createClient();
      const num = `REC-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("bill_recurring_schedules").insert({
        company_id: auth.profile.company_id,
        schedule_number: num,
        customer_id: form.customer_id,
        name: form.name,
        frequency: form.frequency,
        start_date: new Date().toISOString().slice(0, 10),
        next_run_date: new Date().toISOString().slice(0, 10),
        tax_code: form.tax_code,
        status: "active",
        lines_json: [
          {
            description: form.description,
            quantity: 1,
            unit: "period",
            unit_price: Number(form.amount) || 0,
            tax_code: form.tax_code,
            tax_rate: form.tax_code === "VAT18" ? 18 : 0,
          },
        ],
        created_by: auth.profile.id,
      });
      if (error) throw error;
      toast.success("Recurring schedule created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const run = async (id: string) => {
    try {
      const supabase = createClient();
      const inv = await runRecurringSchedule(supabase, id, auth?.profile?.id);
      toast.success(`Invoice ${inv.invoice_number} generated`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    }
  };

  if (loading) return <LoadingState message="Loading recurring schedules…" />;

  return (
    <div>
      <PageHeader
        title="Recurring Billing"
        description="Subscriptions · licenses · maintenance · service agreements"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New schedule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Recurring schedule</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Software license" /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["daily", "weekly", "monthly", "quarterly", "yearly"].map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Line description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No recurring schedules" description="Set up subscription or maintenance billing." icon={Repeat} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schedule</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.schedule_number}</TableCell>
                  <TableCell>{r.customers?.name || "—"}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-xs">{r.frequency}</TableCell>
                  <TableCell className="text-xs">{r.next_run_date ? formatDate(r.next_run_date) : "—"}</TableCell>
                  <TableCell>{r.invoices_generated}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => run(r.id)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Run now
                      </Button>
                    )}
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
