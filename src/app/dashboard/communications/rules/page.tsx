"use client";

import { useEffect, useState } from "react";
import { Play, Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listEventRules, publishCommEvent } from "@/lib/communications";
import { toast } from "sonner";

export default function EventRulesPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [testEvent, setTestEvent] = useState("procurement.po.approved");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listEventRules(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const fire = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const results = await publishCommEvent({
        company_id: auth.profile.company_id,
        event_key: testEvent,
        source_module: testEvent.split(".")[0] || "system",
        entity_code: "TEST-001",
        actor_id: auth.user.id,
        vars: {
          po_number: "PO-TEST-001",
          invoice_number: "INV-TEST-001",
          order_number: "MO-TEST-001",
          employee_name: "Test Employee",
          customer_name: "Test Customer",
          supplier_name: "Test Supplier",
          batch_number: "BAT-TEST",
          voucher_number: "PV-TEST",
          grn_number: "GRN-TEST",
          amount: "1,000,000",
          currency: "UGX",
          title: "Test event notification",
          message: `Triggered ${testEvent} from Communication Center.`,
          company_name: "SecureTrack ERP",
          hire_date: new Date().toISOString().slice(0, 10),
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date().toISOString().slice(0, 10),
          product_name: "Security Paper",
          quantity: "100",
        },
        extra_recipients: auth.profile.email ? [auth.profile.email] : [],
      });
      toast.success(`Fired ${results.length} message(s)`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Event failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading event rules…" />;

  return (
    <div>
      <PageHeader
        title="Event-Driven Communication Rules"
        description="ERP events → recipients · channels · templates · auto attachments · escalations"
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Play className="h-4 w-4 mr-1" /> Test event
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No rules" description="Apply migration 00052 to seed default rules." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.rule_code)}</TableCell>
                  <TableCell className="text-sm font-medium flex items-center gap-1">
                    <Workflow className="h-3.5 w-3.5" />{String(r.name)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">{String(r.event_key)}</TableCell>
                  <TableCell className="text-xs">{String(r.source_module)}</TableCell>
                  <TableCell className="text-[10px]">{((r.channels as string[]) || []).join(", ")}</TableCell>
                  <TableCell className="text-[10px]">{((r.attach_docs as string[]) || []).join(", ") || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.priority)}</Badge></TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "yes" : "no"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fire test event</DialogTitle></DialogHeader>
          <div>
            <Label>Event key</Label>
            <Input value={testEvent} onChange={(e) => setTestEvent(e.target.value)} list="events" />
            <datalist id="events">
              {[
                "procurement.po.approved",
                "sales.invoice.generated",
                "hr.leave.submitted",
                "hr.leave.approved",
                "production.order.created",
                "production.qc.failed",
                "finance.payment.pending",
                "finance.invoice.overdue",
                "hr.employee.hired",
                "inventory.grn.posted",
              ].map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={fire} disabled={busy}>{busy ? "Firing…" : "Publish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
