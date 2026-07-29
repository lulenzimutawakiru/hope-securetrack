"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, UserPlus, MessageSquare, ArrowUpRight, Copy, Archive,
} from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  TICKET_TYPES, SERVICE_TYPES, PRIORITIES, CHANNELS, TICKET_STATUSES,
  createTicket, updateTicketStatus, assignTicket, addComment,
  escalateTicket, duplicateTicket, softDeleteTicket, slaStatus,
} from "@/lib/service-desk";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  ticket_type: string;
  service_type: string;
  priority: string;
  impact: string;
  urgency: string;
  status: string;
  channel: string;
  requester_name: string | null;
  department_name: string | null;
  assigned_to: string | null;
  team_id: string | null;
  sla_response_due: string | null;
  sla_resolve_due: string | null;
  sla_response_met: boolean | null;
  sla_resolve_met: boolean | null;
  first_response_at: string | null;
  resolved_at: string | null;
  is_major: boolean;
  created_at: string;
  customers?: { name: string } | null;
};

export default function ServiceDeskTicketsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Ticket[]>([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("open");
  const [comment, setComment] = useState("");
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "hardware",
    subcategory: "",
    ticket_type: "incident",
    service_type: "it",
    priority: "medium",
    impact: "medium",
    urgency: "medium",
    channel: "web",
    requester_name: "",
    department_name: "",
    asset_tag: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from("support_tickets")
      .select("*, customers(name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (filter === "open") {
      query = query.not("status", "in", '("closed","resolved","archived")');
    } else if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const [{ data }, { data: t }, { data: u }] = await Promise.all([
      query,
      supabase.from("sd_teams").select("id,name").eq("is_active", true),
      supabase.from("user_profiles").select("id,first_name,last_name").eq("is_active", true).limit(100),
    ]);
    setRows((data as Ticket[]) || []);
    setTeams((t as typeof teams) || []);
    setUsers((u as typeof users) || []);
    setLoading(false);
  };

  const loadEvents = async (ticketId: string) => {
    const { data } = await createClient()
      .from("sd_ticket_events")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(100);
    setEvents((data as Array<Record<string, unknown>>) || []);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [filter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.ticket_number?.toLowerCase().includes(s) ||
        r.subject?.toLowerCase().includes(s) ||
        r.requester_name?.toLowerCase().includes(s) ||
        r.category?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => !["closed", "resolved", "archived"].includes(r.status)).length;
    const critical = rows.filter((r) => r.priority === "critical" || r.is_major).length;
    const breached = rows.filter(
      (r) => slaStatus({ due: r.sla_resolve_due, met: r.sla_resolve_met, completedAt: r.resolved_at }) === "breached"
    ).length;
    return { open, critical, breached, total: rows.length };
  }, [rows]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error("No company");
    setSaving(true);
    try {
      const t = await createTicket({
        company_id: companyId,
        created_by: auth?.user?.id,
        actor_name: auth?.profile
          ? `${auth.profile.first_name} ${auth.profile.last_name}`
          : null,
        ticket: form,
      });
      toast.success(`Ticket ${t.ticket_number} created`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!selected || !companyId) return;
    try {
      const updated = await updateTicketStatus({
        ticket_id: selected.id,
        company_id: companyId,
        status,
        actor_id: auth?.user?.id,
        actor_name: auth?.profile ? `${auth.profile.first_name} ${auth.profile.last_name}` : null,
      });
      toast.success(`Status → ${status}`);
      setSelected(updated as Ticket);
      await load();
      await loadEvents(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const onAssign = async (userId: string) => {
    if (!selected || !companyId) return;
    try {
      const updated = await assignTicket({
        ticket_id: selected.id,
        company_id: companyId,
        assigned_to: userId === "none" ? null : userId,
        actor_id: auth?.user?.id,
      });
      toast.success("Assignment updated");
      setSelected(updated as Ticket);
      await load();
      await loadEvents(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const onComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !companyId || !comment.trim()) return;
    setSaving(true);
    try {
      await addComment({
        ticket_id: selected.id,
        company_id: companyId,
        message: comment,
        actor_id: auth?.user?.id,
        actor_name: auth?.profile ? `${auth.profile.first_name} ${auth.profile.last_name}` : null,
      });
      toast.success("Comment added");
      setComment("");
      setCommentOpen(false);
      await loadEvents(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading tickets…" />;

  return (
    <div>
      <PageHeader
        title="Ticket Management"
        description="Full ITIL lifecycle · SLA · routing · comments · escalation"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New ticket</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>Create ticket</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Subject</Label>
                    <Input required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.ticket_type} onValueChange={(v) => setForm((f) => ({ ...f, ticket_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TICKET_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Service</Label>
                      <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Impact</Label>
                      <Select value={form.impact} onValueChange={(v) => setForm((f) => ({ ...f, impact: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map((x) => (
                            <SelectItem key={x} value={x}>{x}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Urgency</Label>
                      <Select value={form.urgency} onValueChange={(v) => setForm((f) => ({ ...f, urgency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map((x) => (
                            <SelectItem key={x} value={x}>{x}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Category</Label>
                      <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Channel</Label>
                      <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Requester</Label>
                      <Input value={form.requester_name} onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input value={form.department_name} onChange={(e) => setForm((f) => ({ ...f, department_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Asset tag</Label>
                    <Input value={form.asset_tag} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create & route"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="In view" value={String(stats.total)} icon={Search} />
        <StatCard title="Open" value={String(stats.open)} icon={MessageSquare} />
        <StatCard title="Critical / major" value={String(stats.critical)} icon={ArrowUpRight} />
        <StatCard title="SLA breached" value={String(stats.breached)} icon={Archive} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search tickets…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open only</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-md border overflow-x-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No tickets" description="Create an incident or service request." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const sla = slaStatus({
                    due: r.sla_resolve_due,
                    met: r.sla_resolve_met,
                    completedAt: r.resolved_at,
                  });
                  return (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${selected?.id === r.id ? "bg-muted/50" : ""}`}
                      onClick={() => {
                        setSelected(r);
                        loadEvents(r.id);
                      }}
                    >
                      <TableCell className="font-mono text-xs">
                        {r.ticket_number}
                        {r.is_major && <Badge variant="destructive" className="ml-1 text-[9px]">MAJOR</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium max-w-[220px] truncate">{r.subject}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {r.service_type} · {r.category}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{r.priority}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            sla === "breached"
                              ? "border-red-300 text-red-700"
                              : sla === "at_risk"
                                ? "border-amber-300 text-amber-700"
                                : ""
                          }
                        >
                          {sla}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selected ? selected.ticket_number : "Select a ticket"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Choose a ticket to work it.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="font-medium">{selected.subject}</div>
                  <p className="text-sm text-muted-foreground mt-1">{selected.description || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="capitalize">{selected.priority}</Badge>
                  <Badge variant="outline" className="capitalize">{selected.channel}</Badge>
                  <Badge variant="outline">{selected.requester_name || "—"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Response due: {selected.sla_response_due ? formatDateTime(selected.sla_response_due) : "—"}</div>
                  <div>Resolve due: {selected.sla_resolve_due ? formatDateTime(selected.sla_resolve_due) : "—"}</div>
                  <div>Created: {formatDate(selected.created_at)}</div>
                </div>

                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={selected.status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Assign agent</Label>
                  <Select
                    value={selected.assigned_to || "none"}
                    onValueChange={onAssign}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Comment</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={onComment}>
                        <DialogHeader><DialogTitle>Add comment</DialogTitle></DialogHeader>
                        <div className="py-3">
                          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Public reply…" required />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={saving}>Post</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!companyId) return;
                      await escalateTicket({
                        ticket_id: selected.id,
                        company_id: companyId,
                        level: 2,
                        reason: "Manual escalation",
                        actor_id: auth?.user?.id,
                      });
                      toast.success("Escalated");
                      await load();
                      await loadEvents(selected.id);
                    }}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Escalate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!companyId) return;
                      await duplicateTicket(selected.id, companyId, auth?.user?.id);
                      toast.success("Duplicated");
                      await load();
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await softDeleteTicket(selected.id);
                      toast.success("Archived");
                      setSelected(null);
                      await load();
                    }}
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                </div>

                <div className="border-t pt-3 max-h-48 overflow-y-auto space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Activity</div>
                  {events.map((ev) => (
                    <div key={String(ev.id)} className="text-xs border-b pb-1.5 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium capitalize">{String(ev.event_type)}</span>
                        <span className="text-muted-foreground">
                          {ev.created_at ? new Date(String(ev.created_at)).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{String(ev.message || "")}</p>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-xs text-muted-foreground">No events yet.</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
