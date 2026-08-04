"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LifeBuoy, Plus, BookOpen, ShoppingBag, Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { createTicket, aiTriage } from "@/lib/service-desk";

export default function ServicePortalPage() {
  const { auth } = useUser();
  const [myTickets, setMyTickets] = useState<Array<Record<string, unknown>>>([]);
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [form, setForm] = useState({ subject: "", description: "" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const email = auth?.profile?.email;
    const [{ data: tickets }, { data: items }] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id,ticket_number,subject,status,priority,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("sd_catalog_items").select("id,name,item_code,description").eq("is_active", true).limit(6),
    ]);
    // Prefer tickets created by this user
    const all = (tickets as Array<Record<string, unknown>>) || [];
    setMyTickets(all.slice(0, 10));
    setCatalog((items as Array<Record<string, unknown>>) || []);
    void email;
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [auth]);

  const onDescChange = async (text: string) => {
    setForm((f) => ({ ...f, description: text }));
    if (text.length > 20 && companyId) {
      try {
        const result = await aiTriage(text, companyId);
        setAiHint(result.suggestedReply);
      } catch {
        /* ignore */
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      let triage = null as Awaited<ReturnType<typeof aiTriage>> | null;
      try {
        triage = await aiTriage(`${form.subject} ${form.description}`, companyId);
      } catch {
        /* optional */
      }
      const t = await createTicket({
        company_id: companyId,
        created_by: auth?.user?.id,
        actor_name: auth?.profile
          ? `${auth.profile.first_name} ${auth.profile.last_name}`
          : null,
        ticket: {
          subject: form.subject,
          description: form.description,
          channel: "portal",
          requester_name: auth?.profile
            ? `${auth.profile.first_name} ${auth.profile.last_name}`
            : null,
          requester_email: auth?.profile?.email,
          category: triage?.suggestedCategory || "general",
          subcategory: triage?.suggestedSubcategory,
          service_type: triage?.suggestedServiceType || "it",
          priority: triage?.suggestedPriority || "medium",
          impact: triage?.suggestedImpact || "medium",
          urgency: triage?.suggestedUrgency || "medium",
          is_major: triage?.isMajor,
        },
      });
      toast.success(`Ticket ${t.ticket_number} submitted`);
      setOpen(false);
      setForm({ subject: "", description: "" });
      setAiHint("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading service portal…" />;

  return (
    <div>
      <PageHeader
        title="Service Portal"
        description="Create tickets · track progress · catalog · knowledge"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Get help</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submit}>
                <DialogHeader><DialogTitle>How can we help?</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Subject</Label>
                    <Input required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Describe the issue</Label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                      value={form.description}
                      onChange={(e) => onDescChange(e.target.value)}
                    />
                  </div>
                  {aiHint && (
                    <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                      <strong className="text-foreground">AI assistant:</strong> {aiHint}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit ticket"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <Link href="/dashboard/service-desk/catalog" className="rounded-lg border p-4 hover:bg-muted/40">
          <ShoppingBag className="h-5 w-5 text-primary mb-2" />
          <div className="font-medium text-sm">Service Catalog</div>
          <p className="text-xs text-muted-foreground">Laptop, password, access…</p>
        </Link>
        <Link href="/dashboard/service-desk/knowledge" className="rounded-lg border p-4 hover:bg-muted/40">
          <BookOpen className="h-5 w-5 text-primary mb-2" />
          <div className="font-medium text-sm">Knowledge Base</div>
          <p className="text-xs text-muted-foreground">Self-help articles</p>
        </Link>
        <Link href="/dashboard/service-desk/tickets" className="rounded-lg border p-4 hover:bg-muted/40">
          <Ticket className="h-5 w-5 text-primary mb-2" />
          <div className="font-medium text-sm">All Tickets</div>
          <p className="text-xs text-muted-foreground">Agent workspace</p>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> My recent requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTickets.length === 0 && (
            <p className="text-sm text-muted-foreground">No tickets yet. Click Get help to start.</p>
          )}
          {myTickets.map((t) => (
            <div key={String(t.id)} className="flex items-center justify-between border-b py-2 last:border-0 text-sm">
              <div>
                <div className="font-mono text-xs">{String(t.ticket_number)}</div>
                <div className="font-medium">{String(t.subject)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-[10px]">{String(t.priority)}</Badge>
                <StatusBadge status={String(t.status)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {catalog.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2"><CardTitle className="text-base">Popular catalog items</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {catalog.map((c) => (
              <Link
                key={String(c.id)}
                href="/dashboard/service-desk/catalog"
                className="rounded-md border p-3 hover:bg-muted/40 text-sm"
              >
                <div className="font-medium">{String(c.name)}</div>
                <div className="text-xs text-muted-foreground font-mono">{String(c.item_code)}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
