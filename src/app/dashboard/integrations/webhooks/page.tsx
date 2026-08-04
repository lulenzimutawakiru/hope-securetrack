"use client";

import { useEffect, useState } from "react";
import { Webhook, Plus, Send } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { processEventPipeline, INTEGRATION_EVENTS } from "@/lib/integration";

export default function WebhooksPage() {
  const { auth } = useUser();
  const [subs, setSubs] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    target_url: "",
    events: "invoice.created,payment.received",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from("intg_webhook_subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("intg_webhook_deliveries").select("*, intg_webhook_subscriptions(name)").order("created_at", { ascending: false }).limit(40),
    ]);
    setSubs(s ?? []);
    setDeliveries(d ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `WH-${Date.now().toString(36).toUpperCase()}`;
      const events = form.events.split(",").map((x) => x.trim()).filter(Boolean);
      const crudRes = await crudCreate("intg_webhook_subscriptions", {
        company_id: auth.profile.company_id,
        subscription_code: code,
        name: form.name,
        target_url: form.target_url,
        events,
        secret: `whsec_${Math.random().toString(36).slice(2, 14)}`,
        is_active: true,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Webhook subscription created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const fireTest = async (eventType: string) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const res = await processEventPipeline(supabase, auth.profile.company_id, eventType, {
        source_module: "integration",
        test: true,
      });
      toast.success(`Event ${eventType} published · ${res.workflow_runs.length} workflows`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading webhooks…" />;

  return (
    <div>
      <PageHeader
        title="Webhook Engine"
        description="Real-time events · HMAC secrets · retries · delivery log"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fireTest("invoice.created")}>
              <Send className="h-4 w-4 mr-1" /> Fire test event
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Subscribe</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Webhook subscription</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Target URL</Label><Input required value={form.target_url} onChange={(e) => setForm((f) => ({ ...f, target_url: e.target.value }))} placeholder="https://..." /></div>
                  <div><Label>Events (comma-separated)</Label><Input value={form.events} onChange={(e) => setForm((f) => ({ ...f, events: e.target.value }))} /></div>
                  <p className="text-[10px] text-muted-foreground">Available: {INTEGRATION_EVENTS.join(", ")}</p>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="rounded-md border overflow-x-auto mb-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Failures</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={String(s.id)}>
                <TableCell className="font-mono text-xs">{String(s.subscription_code)}</TableCell>
                <TableCell>{String(s.name)}</TableCell>
                <TableCell className="text-xs max-w-[180px] truncate">{String(s.target_url)}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex flex-wrap gap-0.5">
                    {((s.events as string[]) || []).slice(0, 3).map((ev) => (
                      <Badge key={ev} variant="outline" className="text-[9px]">{ev}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{String(s.failure_count)}</TableCell>
                <TableCell><StatusBadge status={s.is_active ? "active" : "inactive"} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Webhook className="h-4 w-4" /> Deliveries</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscription</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>ms</TableHead>
              <TableHead>OK</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((d) => (
              <TableRow key={String(d.id)}>
                <TableCell className="text-xs">{(d.intg_webhook_subscriptions as { name?: string } | null)?.name}</TableCell>
                <TableCell className="text-xs">{String(d.attempt)}</TableCell>
                <TableCell className="text-xs">{String(d.status_code)}</TableCell>
                <TableCell className="text-xs">{String(d.duration_ms)}</TableCell>
                <TableCell>{d.success ? "Yes" : "No"}</TableCell>
                <TableCell className="text-xs">{new Date(String(d.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
