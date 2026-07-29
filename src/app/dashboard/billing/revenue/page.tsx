"use client";

import { useEffect, useState } from "react";
import { Landmark, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/utils";

export default function RevenuePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; total_amount: number; customer_id: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    invoice_id: "",
    description: "Service contract recognition",
    months: "12",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: inv }] = await Promise.all([
      supabase.from("bill_revenue_schedules").select("*, invoices(invoice_number), customers(name)").order("created_at", { ascending: false }),
      supabase.from("invoices").select("id,invoice_number,total_amount,customer_id").in("status", ["issued", "partially_paid", "paid"]).limit(100),
    ]);
    setRows(data ?? []);
    setInvoices(inv ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.invoice_id) return;
    try {
      const inv = invoices.find((i) => i.id === form.invoice_id);
      if (!inv) throw new Error("Invoice not found");
      const months = Math.max(1, Number(form.months) || 12);
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + months);
      const supabase = createClient();
      const { data: sch, error } = await supabase
        .from("bill_revenue_schedules")
        .insert({
          company_id: auth.profile.company_id,
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          description: form.description,
          total_amount: inv.total_amount,
          recognized_amount: 0,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          recognition_method: "straight_line",
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;

      // post first period entry
      const monthly = Number(inv.total_amount) / months;
      await supabase.from("bill_revenue_entries").insert({
        company_id: auth.profile.company_id,
        schedule_id: sch.id,
        period_label: start.toISOString().slice(0, 7),
        entry_date: start.toISOString().slice(0, 10),
        amount: monthly,
        status: "posted",
      });
      await supabase
        .from("bill_revenue_schedules")
        .update({ recognized_amount: monthly })
        .eq("id", sch.id);

      toast.success("Revenue schedule created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading revenue schedules…" />;

  const deferred = rows.reduce(
    (s, r) => s + (Number(r.total_amount) - Number(r.recognized_amount || 0)),
    0
  );

  return (
    <div>
      <PageHeader
        title="Revenue Recognition"
        description="Straight-line schedules for contracts, subscriptions, and multi-period revenue"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New schedule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Revenue schedule</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Invoice</Label>
                  <Select value={form.invoice_id} onValueChange={(v) => setForm((f) => ({ ...f, invoice_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {invoices.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.invoice_number} · {formatNumber(i.total_amount)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
                <div><Label>Months</Label><Input type="number" value={form.months} onChange={(e) => setForm((f) => ({ ...f, months: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Schedules" value={String(rows.length)} icon={Landmark} />
        <StatCard title="Deferred revenue" value={formatNumber(Math.round(deferred))} icon={Landmark} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No schedules" description="Create recognition for multi-period contracts." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Recognized</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{(r.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}</TableCell>
                  <TableCell>{(r.customers as { name?: string } | null)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.start_date))} → {formatDate(String(r.end_date))}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.total_amount))}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.recognized_amount))}</TableCell>
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
