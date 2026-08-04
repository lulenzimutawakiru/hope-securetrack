"use client";

import { useEffect, useState } from "react";
import { Star, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { recordCsat } from "@/lib/service-desk";

export default function CsatPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [tickets, setTickets] = useState<Array<{ id: string; ticket_number: string; assigned_to: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ticket_id: "", score: "5", comment: "" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: t }] = await Promise.all([
      supabase
        .from("sd_csat_responses")
        .select("*, support_tickets(ticket_number,subject)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("support_tickets")
        .select("id,ticket_number,assigned_to")
        .in("status", ["resolved", "closed", "customer_confirmation"])
        .limit(50),
    ]);
    setRows((data as Array<Record<string, unknown>>) || []);
    setTickets((t as typeof tickets) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.ticket_id) return;
    const ticket = tickets.find((t) => t.id === form.ticket_id);
    try {
      await recordCsat({
        company_id: companyId,
        ticket_id: form.ticket_id,
        score: Number(form.score),
        comment: form.comment,
        agent_id: ticket?.assigned_to,
      });
      toast.success("CSAT recorded");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading CSAT…" />;

  const avg =
    rows.length > 0
      ? rows.reduce((s, r) => s + Number(r.score || 0), 0) / rows.length
      : 0;
  const promoters = rows.filter((r) => Number(r.score) >= 4).length;

  return (
    <div>
      <PageHeader
        title="Customer Satisfaction (CSAT)"
        description="Post-resolution ratings · agent quality · service score"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record CSAT</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader><DialogTitle>CSAT response</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Ticket</Label>
                    <Select value={form.ticket_id} onValueChange={(v) => setForm((f) => ({ ...f, ticket_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {tickets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.ticket_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Score (1–5)</Label>
                    <Select value={form.score} onValueChange={(v) => setForm((f) => ({ ...f, score: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Comment</Label>
                    <Input value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Responses" value={String(rows.length)} icon={Star} />
        <StatCard title="Average score" value={avg ? formatNumber(avg) : "—"} icon={Star} />
        <StatCard title="Satisfied (4–5)" value={String(promoters)} icon={Star} />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const t = r.support_tickets as { ticket_number?: string; subject?: string } | null;
              return (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-sm">
                    <div className="font-mono text-xs">{t?.ticket_number}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{t?.subject}</div>
                  </TableCell>
                  <TableCell>{"★".repeat(Number(r.score || 0))}</TableCell>
                  <TableCell className="text-sm">{String(r.comment || "—")}</TableCell>
                  <TableCell className="text-xs">{r.created_at ? formatDate(String(r.created_at)) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
