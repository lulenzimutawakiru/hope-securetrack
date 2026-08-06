"use client";

import { useEffect, useState } from "react";
import { Zap, Plus, Play } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { AUTOMATION_EVENTS, firePrintAutomation } from "@/lib/print";

export default function PrintAutomationPage() {
  const { auth } = useUser();
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [firing, setFiring] = useState(false);
  const [form, setForm] = useState({
    rule_code: "",
    name: "",
    trigger_event: "production_complete",
    document_type: "qr_auth",
    copies: "1",
  });
  const [testEvent, setTestEvent] = useState("production_complete");
  const [sourceRef, setSourceRef] = useState("BATCH-DEMO-001");

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const sb = createClient();
    const [{ data: r }, { data: l }] = await Promise.all([
      sb.from("prt_automation_rules").select("*").order("priority"),
      sb.from("prt_automation_log").select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    setRules((r as Array<Record<string, unknown>>) || []);
    setLogs((l as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const crudRes2 = await crudCreate("prt_automation_rules", {
        company_id: companyId,
        rule_code: form.rule_code.toUpperCase(),
        name: form.name,
        trigger_event: form.trigger_event,
        document_type: form.document_type,
        copies: Number(form.copies) || 1,
        is_active: true,
        priority: 5,
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success("Automation rule created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const fire = async () => {
    if (!companyId) return;
    setFiring(true);
    try {
      const result = await firePrintAutomation({
        company_id: companyId,
        trigger_event: testEvent,
        source_ref: sourceRef,
        submitted_by: auth?.user?.id,
        payload: { demo: true },
      });
      toast.success(`Fired ${result.fired} rule(s) · ${result.queueIds.length} job(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fire failed");
    } finally {
      setFiring(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    await crudUpdate("prt_automation_rules", id, { is_active: !active });
    await load();
  };

  if (loading) return <LoadingState message="Loading automation…" />;

  return (
    <div>
      <PageHeader
        title="Print Automation"
        description="ERP events → auto queue · production · GRN · invoice · hire · shipment"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New rule</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Automation rule</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Code</Label>
                      <Input required value={form.rule_code} onChange={(e) => setForm((f) => ({ ...f, rule_code: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Copies</Label>
                      <Input value={form.copies} onChange={(e) => setForm((f) => ({ ...f, copies: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Trigger</Label>
                    <Select value={form.trigger_event} onValueChange={(v) => setForm((f) => ({ ...f, trigger_event: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUTOMATION_EVENTS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Document type</Label>
                    <Input value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-md border p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <Label>Test event</Label>
          <Select value={testEvent} onValueChange={setTestEvent}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUTOMATION_EVENTS.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Source ref</Label>
          <Input className="w-[180px]" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
        </div>
        <Button size="sm" onClick={fire} disabled={firing}>
          <Play className="h-4 w-4 mr-1" /> {firing ? "Firing…" : "Fire rules"}
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={Zap} title="No rules" description="Apply migration seed or create automation rules." />
      ) : (
        <div className="rounded-md border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Doc</TableHead>
                <TableHead>Pri</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.rule_code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell className="text-xs">{String(r.trigger_event).replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-xs">{String(r.document_type)}</TableCell>
                  <TableCell>{String(r.priority)}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? "default" : "outline"}>
                      {r.is_active ? "On" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => toggle(String(r.id), Boolean(r.is_active))}>
                      Toggle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-medium mb-2">Automation log</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={String(l.id)}>
                <TableCell className="text-xs">{l.created_at ? formatDateTime(String(l.created_at)) : "—"}</TableCell>
                <TableCell className="text-xs">{String(l.trigger_event)}</TableCell>
                <TableCell className="text-xs font-mono">{String(l.source_ref || "—")}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{String(l.status)}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{String(l.details || "")}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  No automation events yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
