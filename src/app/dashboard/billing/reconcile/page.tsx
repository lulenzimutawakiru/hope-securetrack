"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { formatDate } from "@/lib/utils";

export default function ReconcilePage() {
  const { auth } = useUser();
  const [batches, setBatches] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank_account_label: "Stanbic Operating", notes: "" });

  const load = async () => {
    const supabase = createClient();
    const [{ data: b }, { data: l }, { data: p }] = await Promise.all([
      supabase.from("bill_reconciliation_batches").select("*").order("created_at", { ascending: false }),
      supabase.from("bill_reconciliation_lines").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("invoice_payments").select("id,amount,payment_date,reference,method,receipt_number").order("payment_date", { ascending: false }).limit(50),
    ]);
    setBatches(b ?? []);
    setLines(l ?? []);
    setPayments(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const num = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(batches.length + 1).padStart(3, "0")}`;
      const crudRes3 = await crudCreate("bill_reconciliation_batches", {
          company_id: auth.profile.company_id,
          batch_number: num,
          bank_account_label: form.bank_account_label,
          period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
          period_end: new Date().toISOString().slice(0, 10),
          status: "open",
          notes: form.notes || null,
          created_by: auth.profile.id,
        });
      if (!crudRes3.ok) throw new Error(crudRes3.error);
      const batch = crudRes3.data as Record<string, unknown>;

      // auto-match payments as lines
      let matched = 0;
      for (const pay of payments.slice(0, 15)) {
        const crudRes2 = await crudCreate("bill_reconciliation_lines", {
          batch_id: batch.id,
          company_id: auth.profile.company_id,
          txn_date: pay.payment_date,
          description: `Payment ${pay.receipt_number || pay.reference || pay.id}`,
          amount: pay.amount,
          reference: pay.reference || pay.receipt_number,
          matched_payment_id: pay.id,
          status: "matched",
        });
        matched++;
      }
      const crudRes = await crudUpdate("bill_reconciliation_batches", String(batch.id), { matched_count: matched, unmatched_count: 0 });

      toast.success(`Batch ${num} created with ${matched} matched lines`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading reconciliation…" />;

  return (
    <div>
      <PageHeader
        title="Payment Reconciliation"
        description="Match bank / MoMo deposits to invoice receipts"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New batch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Reconciliation batch</DialogTitle></DialogHeader>
              <form onSubmit={createBatch} className="space-y-3">
                <div><Label>Bank / wallet label</Label><Input value={form.bank_account_label} onChange={(e) => setForm((f) => ({ ...f, bank_account_label: e.target.value }))} /></div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <DialogFooter><Button type="submit"><RefreshCw className="h-4 w-4 mr-1" /> Create & auto-match</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {batches.length === 0 ? (
        <EmptyState title="No batches" description="Create a batch to reconcile recent payments." />
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Unmatched</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={String(b.id)}>
                    <TableCell className="font-mono text-xs">{String(b.batch_number)}</TableCell>
                    <TableCell>{String(b.bank_account_label || "—")}</TableCell>
                    <TableCell className="text-xs">{formatDate(String(b.period_start))} → {formatDate(String(b.period_end))}</TableCell>
                    <TableCell>{String(b.matched_count)}</TableCell>
                    <TableCell>{String(b.unmatched_count)}</TableCell>
                    <TableCell><StatusBadge status={String(b.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <h3 className="text-sm font-semibold mb-2">Recent lines</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={String(l.id)}>
                    <TableCell className="text-xs">{l.txn_date ? formatDate(String(l.txn_date)) : "—"}</TableCell>
                    <TableCell className="text-xs">{String(l.description || "—")}</TableCell>
                    <TableCell className="text-xs">{Number(l.amount)}</TableCell>
                    <TableCell className="text-xs font-mono">{String(l.reference || "—")}</TableCell>
                    <TableCell><StatusBadge status={String(l.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
