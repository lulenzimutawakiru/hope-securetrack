"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { listCustomers, addTimelineEvent, getTimelineSummary } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmTimelinePage() {
  const { auth } = useUser();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [customerId, setCustomerId] = useState<string>("all");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    kind: "note",
    title: "",
    body: "",
    channel: "internal",
  });

  const load = async () => {
    try {
      const cust = await listCustomers({ limit: 100 });
      setCustomers(cust);
      const supabase = createClient();
      let q = supabase
        .from("crm_timeline")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(80);
      if (customerId !== "all") q = q.eq("customer_id", customerId);
      const { data } = await q;
      setEvents(data || []);
      if (customerId !== "all") {
        setSummary(await getTimelineSummary(customerId));
      } else {
        setSummary("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.customer_id) return;
    try {
      await addTimelineEvent({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id,
        kind: form.kind,
        title: form.title,
        body: form.body,
        channel: form.channel,
        actor_id: auth.user.id,
        actor_name: (auth.profile as { full_name?: string }).full_name || auth.user.email || "User",
      });
      toast.success("Timeline event logged");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading timeline…" />;

  return (
    <div>
      <PageHeader
        title="Customer Timeline"
        description="Calls · meetings · email · WhatsApp · quotes · orders · tickets · AI summaries"
        actions={
          <div className="flex gap-2">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Filter account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log activity</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Log timeline event</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["call", "meeting", "email", "whatsapp", "sms", "note", "task"].map((k) => (
                              <SelectItem key={k} value={k}>{k}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Channel</Label>
                        <Input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Details</Label>
                      <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm">Hub</Link>
            </Button>
          </div>
        }
      />

      {summary && (
        <Card className="mb-4 border-hope-teal/30 bg-hope-teal/5">
          <CardContent className="p-4 text-sm whitespace-pre-wrap">{summary}</CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No timeline events" description="Log calls, meetings, and notes." />
      ) : (
        <div className="relative border-l-2 border-muted ml-3 space-y-4 pl-6">
          {events.map((ev) => (
            <div key={String(ev.id)} className="relative">
              <span className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-lg border p-3 bg-card">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="font-medium text-sm">{String(ev.title)}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {ev.occurred_at ? new Date(String(ev.occurred_at)).toLocaleString() : ""}
                  </span>
                </div>
                {ev.body ? <p className="text-xs text-muted-foreground mt-1">{String(ev.body)}</p> : null}
                <div className="flex gap-1 mt-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{String(ev.kind)}</Badge>
                  {ev.channel ? <Badge variant="outline" className="text-[10px]">{String(ev.channel)}</Badge> : null}
                  {ev.actor_name ? <span className="text-[10px] text-muted-foreground ml-1">{String(ev.actor_name)}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
