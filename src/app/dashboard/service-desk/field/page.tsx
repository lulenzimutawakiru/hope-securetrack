"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";
import { createFieldJob } from "@/lib/service-desk";

export default function FieldServicePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [tickets, setTickets] = useState<Array<{ id: string; ticket_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    location_name: "",
    ticket_id: "",
    scheduled_at: new Date().toISOString().slice(0, 16),
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: t }] = await Promise.all([
      supabase.from("sd_field_jobs").select("*").order("scheduled_at", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("id,ticket_number")
        .is("deleted_at", null)
        .not("status", "in", '("closed","archived")')
        .limit(50),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setTickets((t as typeof tickets) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createFieldJob({
        company_id: companyId,
        title: form.title,
        location_name: form.location_name,
        ticket_id: form.ticket_id || null,
        technician_id: auth?.user?.id,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      });
      toast.success("Field job scheduled");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const crudRes = await crudUpdate("sd_field_jobs", id, patch);
    toast.success(`Job → ${status}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading field service…" />;

  const active = rows.filter((r) => !["completed", "cancelled"].includes(String(r.status))).length;

  return (
    <div>
      <PageHeader
        title="Field Service Management"
        description="Technician jobs · scheduling · checklist · sign-off · mobile ready"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Schedule job</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Field job</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Related ticket</Label>
                    <Select value={form.ticket_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, ticket_id: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {tickets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.ticket_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Scheduled</Label>
                    <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Create</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Jobs" value={String(rows.length)} icon={MapPin} />
        <StatCard title="Active" value={String(active)} icon={MapPin} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No field jobs" description="Schedule on-site technician visits." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.job_number)}</TableCell>
                  <TableCell className="text-sm">{String(r.title)}</TableCell>
                  <TableCell className="text-sm">{String(r.location_name || "—")}</TableCell>
                  <TableCell className="text-xs">
                    {r.scheduled_at ? formatDateTime(String(r.scheduled_at)) : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="space-x-1">
                    {r.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "en_route")}>En route</Button>
                    )}
                    {r.status === "en_route" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(String(r.id), "on_site")}>On site</Button>
                    )}
                    {r.status === "on_site" && (
                      <Button size="sm" onClick={() => setStatus(String(r.id), "completed")}>Complete</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
