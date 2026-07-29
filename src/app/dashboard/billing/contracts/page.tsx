"use client";

import { useEffect, useState } from "react";
import { FileStack, Plus, Play } from "lucide-react";
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
import { createInvoice, checkCredit } from "@/lib/billing";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ContractBillingPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [milestones, setMilestones] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    contract_type: "maintenance",
    total_value: "12000000",
    billing_method: "fixed",
    billing_frequency: "monthly",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: m }, { data: c }] = await Promise.all([
      supabase.from("bill_contracts").select("*, customers(name)").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("bill_contract_milestones").select("*").order("due_date"),
      supabase.from("customers").select("id,name").eq("is_active", true),
    ]);
    setRows(data ?? []);
    setMilestones(m ?? []);
    setCustomers(c ?? []);
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
      const num = `CTR-${new Date().getFullYear()}-${String(rows.length + 1).padStart(4, "0")}`;
      const total = Number(form.total_value) || 0;
      const { data: ctr, error } = await supabase
        .from("bill_contracts")
        .insert({
          company_id: auth.profile.company_id,
          contract_number: num,
          customer_id: form.customer_id,
          title: form.title,
          contract_type: form.contract_type,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
          total_value: total,
          billing_method: form.billing_method,
          billing_frequency: form.billing_frequency,
          next_bill_date: new Date().toISOString().slice(0, 10),
          auto_invoice: true,
          lines_json: [
            {
              description: form.title,
              quantity: 1,
              unit: "period",
              unit_price: form.billing_method === "fixed" ? total / 12 : total,
              tax_code: "VAT18",
              tax_rate: 18,
            },
          ],
          created_by: auth.profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (form.billing_method === "milestone") {
        await supabase.from("bill_contract_milestones").insert([
          { company_id: auth.profile.company_id, contract_id: ctr.id, milestone_code: "M1", name: "Kickoff 30%", amount: total * 0.3, status: "ready" },
          { company_id: auth.profile.company_id, contract_id: ctr.id, milestone_code: "M2", name: "Mid 40%", amount: total * 0.4, status: "pending" },
          { company_id: auth.profile.company_id, contract_id: ctr.id, milestone_code: "M3", name: "Close 30%", amount: total * 0.3, status: "pending" },
        ]);
      }
      toast.success(`Contract ${num} created`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const invoiceContract = async (ctr: Record<string, unknown>) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const customerId = String(ctr.customer_id);
      const amount = Number((ctr.lines_json as Array<{ unit_price?: number }>)?.[0]?.unit_price || ctr.total_value) / 12;
      const credit = await checkCredit(supabase, auth.profile.company_id, customerId, amount);
      if (!credit.allowed) {
        toast.error(`Credit blocked: ${credit.reasons.join("; ")}`);
        return;
      }
      const inv = await createInvoice(supabase, {
        company_id: auth.profile.company_id,
        customer_id: customerId,
        invoice_type: "recurring",
        source_type: "contract",
        source_ref: String(ctr.contract_number),
        notes: `Contract billing: ${ctr.title}`,
        lines: (ctr.lines_json as Array<{
          description: string;
          quantity: number;
          unit?: string;
          unit_price: number;
          tax_code?: string;
          tax_rate?: number;
        }>) || [
          {
            description: String(ctr.title),
            quantity: 1,
            unit_price: amount,
            tax_code: "VAT18",
            tax_rate: 18,
          },
        ],
        created_by: auth.profile.id,
        status: "draft",
      });
      await supabase
        .from("invoices")
        .update({ contract_id: ctr.id })
        .eq("id", inv.id);
      await supabase
        .from("bill_contracts")
        .update({
          billed_to_date: Number(ctr.billed_to_date || 0) + Number(inv.total_amount),
          next_bill_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ctr.id);
      toast.success(`Invoice ${inv.invoice_number} created from contract`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice failed");
    }
  };

  const invoiceMilestone = async (m: Record<string, unknown>) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const { data: ctr } = await supabase.from("bill_contracts").select("*").eq("id", m.contract_id).single();
      if (!ctr) throw new Error("Contract missing");
      const inv = await createInvoice(supabase, {
        company_id: auth.profile.company_id,
        customer_id: ctr.customer_id,
        invoice_type: "tax",
        source_type: "contract",
        source_ref: `${ctr.contract_number}/${m.milestone_code}`,
        notes: `Milestone: ${m.name}`,
        lines: [
          {
            description: `${ctr.title} — ${m.name}`,
            quantity: 1,
            unit_price: Number(m.amount),
            tax_code: "VAT18",
            tax_rate: 18,
          },
        ],
        created_by: auth.profile.id,
      });
      await supabase
        .from("bill_contract_milestones")
        .update({ status: "invoiced", invoice_id: inv.id })
        .eq("id", m.id);
      toast.success(`Milestone invoiced as ${inv.invoice_number}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading contracts…" />;

  return (
    <div>
      <PageHeader
        title="Contract & SLA Billing"
        description="Fixed · milestone · retainer · maintenance · hosting · support"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New contract</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Billing contract</DialogTitle></DialogHeader>
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
                <div><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Annual maintenance SLA" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.contract_type} onValueChange={(v) => setForm((f) => ({ ...f, contract_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["service", "sla", "maintenance", "subscription", "project", "hosting", "support"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Billing method</Label>
                    <Select value={form.billing_method} onValueChange={(v) => setForm((f) => ({ ...f, billing_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["fixed", "milestone", "time_material", "usage", "retainer"].map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Total value</Label><Input type="number" value={form.total_value} onChange={(e) => setForm((f) => ({ ...f, total_value: e.target.value }))} /></div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No contracts" description="Create a service or SLA contract to auto-invoice." icon={FileStack} />
      ) : (
        <div className="rounded-md border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Billed</TableHead>
                <TableHead>Next bill</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell>
                    <div className="font-mono text-xs">{String(r.contract_number)}</div>
                    <div className="text-sm">{String(r.title)}</div>
                  </TableCell>
                  <TableCell>{(r.customers as { name?: string } | null)?.name}</TableCell>
                  <TableCell className="text-xs">{String(r.contract_type)}</TableCell>
                  <TableCell className="text-xs">{String(r.billing_method)}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.total_value))}</TableCell>
                  <TableCell className="text-xs">{formatNumber(Number(r.billed_to_date))}</TableCell>
                  <TableCell className="text-xs">{r.next_bill_date ? formatDate(String(r.next_bill_date)) : "—"}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    {r.status === "active" && r.billing_method !== "milestone" && (
                      <Button size="sm" variant="outline" onClick={() => invoiceContract(r)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Invoice
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {milestones.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-2">Milestones</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m) => (
                  <TableRow key={String(m.id)}>
                    <TableCell className="font-mono text-xs">{String(m.milestone_code)}</TableCell>
                    <TableCell>{String(m.name)}</TableCell>
                    <TableCell className="text-xs">{formatNumber(Number(m.amount))}</TableCell>
                    <TableCell><StatusBadge status={String(m.status)} /></TableCell>
                    <TableCell>
                      {m.status === "ready" && (
                        <Button size="sm" onClick={() => invoiceMilestone(m)}>Invoice milestone</Button>
                      )}
                    </TableCell>
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
