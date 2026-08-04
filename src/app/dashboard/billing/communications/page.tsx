"use client";

import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { queueCommunication, agingBucket } from "@/lib/billing";
import { formatNumber } from "@/lib/utils";

export default function BillingCommunicationsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp" | "portal">("email");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bill_communications")
      .select("*, invoices(invoice_number), customers(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const blastReminders = async () => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const { data: inv } = await supabase
        .from("invoices")
        .select("id,invoice_number,due_date,status,total_amount,amount_paid,customer_id,currency,customers(name,email)")
        .not("status", "in", '("paid","void","cancelled","draft")')
        .limit(50);
      let n = 0;
      for (const i of inv || []) {
        const bal = Number(i.total_amount) - Number(i.amount_paid || 0);
        const bucket = agingBucket(i.due_date as string | null, String(i.status));
        const event =
          bucket === "current" ? "payment_reminder" : "overdue";
        await queueCommunication(supabase, {
          company_id: auth.profile.company_id,
          invoice_id: i.id,
          customer_id: i.customer_id as string,
          channel,
          event_type: event,
          recipient: (i.customers as { email?: string } | null)?.email || "customer",
          vars: {
            invoice_number: i.invoice_number,
            customer_name: (i.customers as { name?: string } | null)?.name,
            total: formatNumber(Number(i.total_amount)),
            balance: formatNumber(bal),
            currency: i.currency || "UGX",
            due_date: i.due_date as string,
          },
        });
        n++;
      }
      toast.success(`${n} messages queued/sent via ${channel}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading communications…" />;

  return (
    <div>
      <PageHeader
        title="Automated Communications"
        description="Email · SMS · WhatsApp · portal — invoice, reminder, overdue, receipt"
        actions={
          <div className="flex gap-2 items-center">
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["email", "sms", "whatsapp", "portal"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={blastReminders}>
              <Send className="h-4 w-4 mr-1" /> Send reminders
            </Button>
          </div>
        }
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs">{String(r.event_type)}</TableCell>
                <TableCell className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {String(r.channel)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {(r.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}
                </TableCell>
                <TableCell>{(r.customers as { name?: string } | null)?.name || "—"}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{String(r.subject)}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                <TableCell className="text-xs">{new Date(String(r.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
