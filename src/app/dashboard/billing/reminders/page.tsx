"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { agingBucket } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/utils";

export default function RemindersPage() {
  const { auth } = useUser();
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [reminders, setReminders] = useState<Array<Record<string, unknown>>>([]);
  const [overdue, setOverdue] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: r }, { data: rem }, { data: inv }] = await Promise.all([
      supabase.from("bill_dunning_rules").select("*").order("days_overdue"),
      supabase.from("bill_reminders").select("*, invoices(invoice_number), customers(name)").order("created_at", { ascending: false }).limit(50),
      supabase
        .from("invoices")
        .select("id,invoice_number,due_date,status,total_amount,amount_paid,customer_id,customers(name)")
        .not("status", "in", '("paid","void","cancelled","draft")')
        .limit(200),
    ]);
    setRules(r ?? []);
    setReminders(rem ?? []);
    setOverdue(
      (inv || []).filter((i) => {
        const b = agingBucket(i.due_date as string | null, String(i.status));
        return b !== "current" && b !== "paid";
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const queueReminders = async () => {
    if (!auth?.profile?.company_id) return;
    try {
      const rows = overdue.slice(0, 20).map((i) => ({
        company_id: auth.profile!.company_id,
        invoice_id: i.id,
        customer_id: i.customer_id,
        reminder_type: "payment_overdue",
        channel: "email",
        status: "pending",
        scheduled_at: new Date().toISOString(),
        message: `Reminder: invoice ${i.invoice_number} is overdue. Balance ${formatNumber(Number(i.total_amount) - Number(i.amount_paid || 0))}`,
      }));
      if (!rows.length) {
        toast.message("No overdue invoices");
        return;
      }
      for (const row of rows) {
        const crudRes2 = await crudCreate("bill_reminders", row);
        if (!crudRes2.ok) throw new Error(crudRes2.error);
      }
      toast.success(`${rows.length} reminders queued`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const markSent = async (id: string) => {
    await crudUpdate("bill_reminders", id, { status: "sent", sent_at: new Date().toISOString() });
    toast.success("Marked sent");
    await load();
  };

  if (loading) return <LoadingState message="Loading dunning…" />;

  return (
    <div>
      <PageHeader
        title="Payment Reminders & Dunning"
        description="Overdue rules · email/SMS channels · escalation"
        actions={
          <Button size="sm" onClick={queueReminders}>
            <Plus className="h-4 w-4 mr-1" /> Queue overdue reminders
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        {rules.map((r) => (
          <Card key={String(r.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{String(r.name)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <Badge variant="outline">{String(r.channel)}</Badge>
              <p>Days: {String(r.days_overdue)}</p>
              <p className="text-muted-foreground">{String(r.subject_template)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" /> Overdue open invoices ({overdue.length})
      </h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Bucket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.map((i) => (
              <TableRow key={String(i.id)}>
                <TableCell className="font-mono text-xs">{String(i.invoice_number)}</TableCell>
                <TableCell>{(i.customers as { name?: string } | null)?.name || "—"}</TableCell>
                <TableCell className="text-xs">{i.due_date ? formatDate(String(i.due_date)) : "—"}</TableCell>
                <TableCell className="text-xs">{formatNumber(Number(i.total_amount) - Number(i.amount_paid || 0))}</TableCell>
                <TableCell className="text-xs">{agingBucket(i.due_date as string | null, String(i.status))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Reminder log</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs">{String(r.reminder_type)}</TableCell>
                <TableCell className="font-mono text-xs">{(r.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}</TableCell>
                <TableCell>{(r.customers as { name?: string } | null)?.name || "—"}</TableCell>
                <TableCell className="text-xs">{String(r.channel)}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                <TableCell>
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => markSent(String(r.id))}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
