"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headphones, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  updateTicketStatus,
  addWorkLog,
  postMessage,
  escalateTicket,
  WORK_LOG_TYPES,
} from "@/lib/service-desk";
import { formatDateTime } from "@/lib/utils";

export default function AgentWorkspacePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<Array<Record<string, unknown>>>([]);
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [minutes, setMinutes] = useState("15");
  const [workType, setWorkType] = useState("investigation");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const actorName = auth?.profile
    ? `${(auth.profile as { first_name?: string }).first_name || ""} ${(auth.profile as { last_name?: string }).last_name || ""}`.trim()
    : "Agent";

  const load = async () => {
    const sb = createClient();
    const [{ data: m }, { data: q }] = await Promise.all([
      sb
        .from("support_tickets")
        .select("*")
        .eq("assigned_to", userId || "none")
        .is("deleted_at", null)
        .not("status", "in", '("closed","archived")')
        .order("sla_resolve_due", { ascending: true })
        .limit(50),
      sb
        .from("support_tickets")
        .select("*")
        .is("deleted_at", null)
        .in("status", ["new", "open", "assigned"])
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setMine((m as Array<Record<string, unknown>>) || []);
    setQueue((q as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [userId]);

  const selectTicket = async (t: Record<string, unknown>) => {
    setSelected(t);
    const sb = createClient();
    const [{ data: e }, { data: w }] = await Promise.all([
      sb.from("sd_ticket_events").select("*").eq("ticket_id", t.id).order("created_at", { ascending: false }).limit(30),
      sb.from("sd_work_logs").select("*").eq("ticket_id", t.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setEvents((e as Array<Record<string, unknown>>) || []);
    setLogs((w as Array<Record<string, unknown>>) || []);
  };

  const logWork = async () => {
    if (!companyId || !selected) return;
    try {
      await addWorkLog({
        company_id: companyId,
        ticket_id: String(selected.id),
        minutes: Number(minutes) || 0,
        work_type: workType,
        notes: note,
        agent_id: userId,
        agent_name: actorName,
      });
      toast.success("Work log saved");
      setNote("");
      await selectTicket(selected);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const sendReply = async () => {
    if (!companyId || !selected || !reply.trim()) return;
    try {
      await postMessage({
        company_id: companyId,
        ticket_id: String(selected.id),
        body: reply,
        is_public: true,
        author_id: userId,
        author_name: actorName,
        channel: "public",
      });
      toast.success("Reply sent");
      setReply("");
      await selectTicket(selected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (status: string) => {
    if (!companyId || !selected) return;
    try {
      const t = await updateTicketStatus({
        ticket_id: String(selected.id),
        company_id: companyId,
        status,
        actor_id: userId,
        actor_name: actorName,
        resolution_notes: status === "resolved" ? reply || note || "Resolved by agent" : undefined,
      });
      setSelected(t as Record<string, unknown>);
      toast.success(`Status → ${status}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const escalate = async () => {
    if (!companyId || !selected) return;
    await escalateTicket({
      ticket_id: String(selected.id),
      company_id: companyId,
      level: 2,
      reason: "Agent escalation",
      actor_id: userId,
      actor_name: actorName,
    });
    toast.success("Escalated");
  };

  if (loading) return <LoadingState message="Loading agent workspace…" />;

  return (
    <div>
      <PageHeader
        title="Technician Workspace"
        description="My queue · accept · work logs · replies · escalate · resolve"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/service-desk/create">New ticket</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Headphones className="h-4 w-4" /> My open tickets ({mine.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-64 overflow-y-auto">
              {mine.map((t) => (
                <button
                  key={String(t.id)}
                  type="button"
                  className="w-full text-left border rounded p-2 text-sm hover:bg-muted/40"
                  onClick={() => selectTicket(t)}
                >
                  <p className="font-mono text-[10px]">{String(t.ticket_number)}</p>
                  <p className="truncate font-medium">{String(t.subject)}</p>
                  <Badge variant="outline" className="text-[9px] capitalize mt-1">{String(t.priority)}</Badge>
                </button>
              ))}
              {mine.length === 0 && <p className="text-xs text-muted-foreground">No tickets assigned to you</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Unassigned / queue</CardTitle></CardHeader>
            <CardContent className="space-y-1 max-h-48 overflow-y-auto">
              {queue.map((t) => (
                <button
                  key={String(t.id)}
                  type="button"
                  className="w-full text-left border rounded p-2 text-xs hover:bg-muted/40"
                  onClick={() => selectTicket(t)}
                >
                  <span className="font-mono">{String(t.ticket_number)}</span> · {String(t.subject).slice(0, 40)}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Select a ticket to work.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-mono">{String(selected.ticket_number)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium text-lg">{String(selected.subject)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">{String(selected.status)}</Badge>
                    <Badge className="capitalize">{String(selected.priority)}</Badge>
                    <Badge variant="secondary">{String(selected.service_type)}</Badge>
                    {selected.asset_tag ? <Badge variant="outline">{String(selected.asset_tag)}</Badge> : null}
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{String(selected.description || "")}</p>
                  <p className="text-xs">SLA resolve: {selected.sla_resolve_due ? formatDateTime(String(selected.sla_resolve_due)) : "—"}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setStatus("acknowledged")}>Ack</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus("investigating")}>Investigate</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus("in_progress")}>In progress</Button>
                    <Button size="sm" onClick={() => setStatus("resolved")}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={escalate}>Escalate</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-1"><Clock className="h-4 w-4" /> Work log</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Minutes</Label>
                        <Input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select value={workType} onValueChange={setWorkType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {WORK_LOG_TYPES.map((w) => (
                              <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Input placeholder="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
                    <Button size="sm" onClick={logWork}>Log time</Button>
                    <div className="max-h-28 overflow-y-auto text-xs space-y-1">
                      {logs.map((l) => (
                        <p key={String(l.id)}>{String(l.minutes)}m · {String(l.work_type)} · {String(l.notes || "")}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-1"><MessageSquare className="h-4 w-4" /> Reply</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Public reply to requester…"
                    />
                    <Button size="sm" onClick={sendReply}>Send</Button>
                    <div className="max-h-28 overflow-y-auto text-xs space-y-1">
                      {events.slice(0, 8).map((e) => (
                        <p key={String(e.id)} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{String(e.event_type)}</span>{" "}
                          {String(e.message || "").slice(0, 80)}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
