"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  submitForApproval,
  actOnApproval,
  APPROVAL_ROLES,
  queueCommunication,
} from "@/lib/billing";
import { formatNumber } from "@/lib/utils";

export default function BillingApprovalsPage() {
  const { auth } = useUser();
  const [pending, setPending] = useState<Array<Record<string, unknown>>>([]);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [steps, setSteps] = useState<Array<Record<string, unknown>>>([]);
  const [role, setRole] = useState("finance_officer");
  const [sig, setSig] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: p }, { data: d }, { data: h }, { data: s }] = await Promise.all([
      supabase
        .from("invoices")
        .select("*, customers(name)")
        .like("approval_status", "pending_%")
        .order("updated_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*, customers(name)")
        .eq("status", "draft")
        .or("approval_status.eq.none,approval_status.is.null")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("bill_approval_actions")
        .select("*, invoices(invoice_number)")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("bill_approval_steps").select("*").order("step_order"),
    ]);
    setPending(p ?? []);
    setDrafts(d ?? []);
    setHistory(h ?? []);
    setSteps(s ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submit = async (id: string) => {
    try {
      const supabase = createClient();
      await submitForApproval(supabase, id, auth?.profile?.id);
      await queueCommunication(supabase, {
        company_id: auth!.profile!.company_id,
        invoice_id: id,
        event_type: "approval_needed",
        channel: "portal",
        vars: { invoice_number: id },
      });
      toast.success("Submitted for approval");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const act = async (id: string, action: "approve" | "reject" | "return") => {
    try {
      const supabase = createClient();
      await actOnApproval(supabase, {
        invoice_id: id,
        action,
        role_name: role,
        signature_data: sig || `${role} digital approval`,
        comments: action,
        actor_id: auth?.profile?.id,
      });
      toast.success(action);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  if (loading) return <LoadingState message="Loading approvals…" />;

  return (
    <div>
      <PageHeader
        title="Invoice Approval Workflow"
        description="Finance Officer → Manager → Director → CEO · digital signatures · locking"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {APPROVAL_ROLES.map((r) => (
          <Badge key={r.role} variant={role === r.role ? "default" : "outline"}>
            {r.step}. {r.label}
          </Badge>
        ))}
      </div>

      <Card className="mb-6 max-w-xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Acting as / signature</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_ROLES.map((r) => (
                  <SelectItem key={r.role} value={r.role}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Digital signature text</Label>
            <Input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="Name / cert ref" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-4 mb-6 text-xs">
        {steps.map((s) => (
          <div key={String(s.id)} className="rounded border p-2">
            <div className="font-medium">Step {String(s.step_order)}</div>
            <div>{String(s.role_name)}</div>
            <div className="text-muted-foreground">Min {formatNumber(Number(s.min_amount))}</div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <CheckSquare className="h-4 w-4" /> Pending approval
      </h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((i) => (
              <TableRow key={String(i.id)}>
                <TableCell className="font-mono text-xs">{String(i.invoice_number)}</TableCell>
                <TableCell>{(i.customers as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{String(i.currency)} {formatNumber(Number(i.total_amount))}</TableCell>
                <TableCell><StatusBadge status={String(i.approval_status)} /></TableCell>
                <TableCell className="space-x-1">
                  <Button size="sm" onClick={() => act(String(i.id), "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => act(String(i.id), "return")}>Return</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(String(i.id), "reject")}>Reject</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Drafts ready to submit</h3>
      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((i) => (
              <TableRow key={String(i.id)}>
                <TableCell className="font-mono text-xs">{String(i.invoice_number)}</TableCell>
                <TableCell>{(i.customers as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{formatNumber(Number(i.total_amount))}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => submit(String(i.id))}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Approval audit trail</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((h) => (
              <TableRow key={String(h.id)}>
                <TableCell className="font-mono text-xs">
                  {(h.invoices as { invoice_number?: string } | null)?.invoice_number || "—"}
                </TableCell>
                <TableCell className="text-xs">{String(h.role_name)}</TableCell>
                <TableCell><StatusBadge status={String(h.action)} /></TableCell>
                <TableCell className="text-xs">{new Date(String(h.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
