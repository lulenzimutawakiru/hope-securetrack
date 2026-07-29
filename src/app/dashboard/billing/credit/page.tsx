"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Plus, Ban, Unlock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  checkCredit,
  getCustomerOutstanding,
  setCustomerCreditBlock,
  logCreditEvent,
} from "@/lib/billing";
import { formatNumber } from "@/lib/utils";

type Cust = {
  id: string;
  code: string;
  name: string;
  credit_limit: number;
  credit_rating: string | null;
  credit_blocked: boolean | null;
  risk_score: number | null;
  on_hold: boolean | null;
  payment_terms_days: number;
};

export default function CreditControlPage() {
  const { auth } = useUser();
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [outstanding, setOutstanding] = useState<Record<string, number>>({});
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", amount: "", reason: "" });

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: a }, { data: e }] = await Promise.all([
      supabase.from("customers").select("id,code,name,credit_limit,credit_rating,credit_blocked,risk_score,on_hold,payment_terms_days").eq("is_active", true).order("name"),
      supabase.from("bill_credit_approvals").select("*, customers(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("bill_credit_events").select("*, customers(name)").order("created_at", { ascending: false }).limit(30),
    ]);
    const list = (c as Cust[]) ?? [];
    setCustomers(list);
    setApprovals(a ?? []);
    setEvents(e ?? []);
    const map: Record<string, number> = {};
    await Promise.all(
      list.slice(0, 100).map(async (cust) => {
        map[cust.id] = await getCustomerOutstanding(supabase, cust.id);
      })
    );
    setOutstanding(map);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const block = async (c: Cust, blocked: boolean) => {
    if (!auth?.profile?.company_id) return;
    const supabase = createClient();
    await setCustomerCreditBlock(supabase, c.id, blocked, blocked ? "Blocked by credit control" : undefined);
    await logCreditEvent(supabase, {
      company_id: auth.profile.company_id,
      customer_id: c.id,
      event_type: blocked ? "blocked" : "unblocked",
      credit_limit: c.credit_limit,
      outstanding: outstanding[c.id] || 0,
      message: blocked ? "Sales blocked" : "Credit restored",
      actor_id: auth.profile.id,
    });
    toast.success(blocked ? "Customer blocked" : "Customer unblocked");
    await load();
  };

  const requestApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.customer_id) return;
    try {
      const supabase = createClient();
      const num = `CRA-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("bill_credit_approvals").insert({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id,
        request_number: num,
        requested_amount: Number(form.amount) || 0,
        reason: form.reason || null,
        status: "pending",
        requested_by: auth.profile.id,
      });
      if (error) throw error;
      await logCreditEvent(supabase, {
        company_id: auth.profile.company_id,
        customer_id: form.customer_id,
        event_type: "approval_requested",
        amount: Number(form.amount) || 0,
        message: form.reason || "Credit approval requested",
        actor_id: auth.profile.id,
      });
      toast.success("Credit approval requested");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!auth?.profile) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("bill_credit_approvals")
      .update({
        status,
        decided_by: auth.profile.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (data) {
      await logCreditEvent(supabase, {
        company_id: auth.profile.company_id,
        customer_id: data.customer_id,
        event_type: status === "approved" ? "approval_granted" : "approval_denied",
        amount: Number(data.requested_amount),
        actor_id: auth.profile.id,
      });
    }
    toast.success(status);
    await load();
  };

  const runCheck = async (customerId: string) => {
    if (!auth?.profile?.company_id) return;
    const supabase = createClient();
    const res = await checkCredit(supabase, auth.profile.company_id, customerId, 0);
    toast.message(
      res.allowed ? "Credit OK" : "Credit blocked",
      { description: res.reasons.join("; ") || res.warning || `Available ${formatNumber(res.available)}` }
    );
  };

  if (loading) return <LoadingState message="Loading credit control…" />;

  const blockedCount = customers.filter((c) => c.credit_blocked || c.on_hold).length;
  const overLimit = customers.filter((c) => {
    const lim = Number(c.credit_limit || 0);
    return lim > 0 && (outstanding[c.id] || 0) > lim;
  }).length;

  return (
    <div>
      <PageHeader
        title="Credit Control"
        description="Limits · risk · sales blocks · finance approval when exceeded"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Credit approval</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request credit approval</DialogTitle></DialogHeader>
              <form onSubmit={requestApproval} className="space-y-3">
                <div>
                  <Label>Customer</Label>
                  <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input type="number" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Customers" value={String(customers.length)} icon={ShieldAlert} />
        <StatCard title="Blocked / hold" value={String(blockedCount)} icon={Ban} />
        <StatCard title="Over limit" value={String(overLimit)} icon={ShieldAlert} />
      </div>

      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Limit</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const out = outstanding[c.id] || 0;
              const avail = Math.max(0, Number(c.credit_limit) - out);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{c.code}</div>
                  </TableCell>
                  <TableCell className="text-xs">{formatNumber(c.credit_limit)}</TableCell>
                  <TableCell className="text-xs">{formatNumber(out)}</TableCell>
                  <TableCell className="text-xs">{formatNumber(avail)}</TableCell>
                  <TableCell className="text-xs">{c.risk_score ?? 50} · {c.credit_rating || "—"}</TableCell>
                  <TableCell>
                    {c.credit_blocked || c.on_hold ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : out > Number(c.credit_limit) && Number(c.credit_limit) > 0 ? (
                      <Badge variant="destructive">Over limit</Badge>
                    ) : (
                      <StatusBadge status="active" />
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => runCheck(c.id)}>Check</Button>
                    {c.credit_blocked ? (
                      <Button size="sm" variant="outline" onClick={() => block(c, false)}><Unlock className="h-3.5 w-3.5" /></Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => block(c, true)}><Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Credit approval requests</h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvals.map((a) => (
              <TableRow key={String(a.id)}>
                <TableCell className="font-mono text-xs">{String(a.request_number)}</TableCell>
                <TableCell>{(a.customers as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{formatNumber(Number(a.requested_amount))}</TableCell>
                <TableCell><StatusBadge status={String(a.status)} /></TableCell>
                <TableCell className="space-x-1">
                  {a.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => decide(String(a.id), "approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(String(a.id), "rejected")}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Credit events</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <TableRow key={String(ev.id)}>
                <TableCell className="text-xs">{String(ev.event_type)}</TableCell>
                <TableCell>{(ev.customers as { name?: string } | null)?.name || "—"}</TableCell>
                <TableCell className="text-xs">{String(ev.message || "—")}</TableCell>
                <TableCell className="text-xs">{new Date(String(ev.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
