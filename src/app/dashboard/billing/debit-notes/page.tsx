"use client";

import { useEffect, useState } from "react";
import { FilePlus, Plus } from "lucide-react";
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
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/utils";

export default function DebitNotesPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", reason: "", amount: "", tax: "0" });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase.from("bill_debit_notes").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").eq("is_active", true),
    ]);
    setRows(data ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost("/api/billing/debit-notes", {
        customer_id: form.customer_id || null,
        reason: form.reason || null,
        amount: Number(form.amount) || 0,
        tax: Number(form.tax) || 0,
      });
      if (!res.ok) throw new Error(res.error);
      toast.success("Debit note issued");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading debit notes…" />;

  return (
    <div>
      <PageHeader
        title="Debit Notes"
        description="Additional charges · corrections · under-billing"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Issue debit note</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Debit note</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Amount</Label><Input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                  <div><Label>Tax</Label><Input type="number" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} /></div>
                </div>
                <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Issue</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No debit notes" icon={FilePlus} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.debit_note_number)}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.debit_date))}</TableCell>
                  <TableCell>{(r.customers as { name?: string } | null)?.name || "—"}</TableCell>
                  <TableCell className="text-xs">{String(r.reason || "—")}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.total_amount))}</TableCell>
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
