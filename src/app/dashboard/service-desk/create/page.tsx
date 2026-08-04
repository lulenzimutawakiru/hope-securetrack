"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  createTicket,
  createFromAssetQr,
  aiTriage,
  TICKET_TYPES,
  SERVICE_TYPES,
  PRIORITIES,
  CHANNELS_EXTENDED,
  IMPACT_LEVELS,
  URGENCY_LEVELS,
} from "@/lib/service-desk";

export default function SmartTicketCreatePage() {
  const { auth } = useUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [saving, setSaving] = useState(false);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [kb, setKb] = useState<Array<{ title: string; score: number }>>([]);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "general",
    subcategory: "",
    ticket_type: "incident",
    service_type: "it",
    priority: "medium",
    impact: "medium",
    urgency: "medium",
    channel: "web",
    requester_name: "",
    requester_email: "",
    department_name: "",
    location_name: "",
    asset_tag: "",
    related_invoice: "",
    related_product: "",
    related_qr: "",
    preferred_contact: "email",
    template_code: "",
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  useEffect(() => {
    createClient()
      .from("sd_ticket_templates")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setTemplates((data as Array<Record<string, unknown>>) || []));
  }, []);

  const runAi = async () => {
    if (!companyId || !form.description && !form.subject) return;
    try {
      const r = await aiTriage(`${form.subject}\n${form.description}`, companyId);
      setForm((f) => ({
        ...f,
        category: r.suggestedCategory,
        subcategory: r.suggestedSubcategory || f.subcategory,
        service_type: r.suggestedServiceType,
        priority: r.suggestedPriority,
        impact: r.suggestedImpact,
        urgency: r.suggestedUrgency,
      }));
      setKb(r.knowledgeMatches.map((k) => ({ title: k.title, score: k.score })));
      setAiHints([
        r.suggestedReply,
        r.isMajor ? "AI flags this as a potential major incident." : "Standard priority path.",
        r.duplicates?.length
          ? `Possible duplicates: ${r.duplicates.length}`
          : "No obvious duplicates.",
      ]);
      toast.success("AI classification applied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    }
  };

  const applyTemplate = (code: string) => {
    const t = templates.find((x) => String(x.template_code) === code);
    if (!t) return;
    setForm((f) => ({
      ...f,
      template_code: code,
      subject: String(t.subject_template || f.subject),
      description: String(t.description_template || f.description),
      category: String(t.category || f.category),
      subcategory: String(t.subcategory || ""),
      service_type: String(t.service_type || f.service_type),
      ticket_type: String(t.ticket_type || f.ticket_type),
      priority: String(t.priority || f.priority),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      let ticket;
      if (form.channel === "qr" && form.asset_tag) {
        ticket = await createFromAssetQr({
          company_id: companyId,
          asset_tag: form.asset_tag,
          subject: form.subject,
          description: form.description,
          created_by: userId,
          channel: "qr",
        });
      } else {
        ticket = await createTicket({
          company_id: companyId,
          created_by: userId,
          actor_name: auth?.profile
            ? `${(auth.profile as { first_name?: string }).first_name || ""} ${(auth.profile as { last_name?: string }).last_name || ""}`.trim()
            : undefined,
          ticket: {
            subject: form.subject,
            description: form.description,
            category: form.category,
            subcategory: form.subcategory,
            ticket_type: form.ticket_type,
            service_type: form.service_type,
            priority: form.priority,
            impact: form.impact,
            urgency: form.urgency,
            channel: form.channel,
            requester_name: form.requester_name || undefined,
            requester_email: form.requester_email || undefined,
            department_name: form.department_name || undefined,
            location_name: form.location_name || undefined,
            asset_tag: form.asset_tag || undefined,
            related_invoice: form.related_invoice || undefined,
            related_product: form.related_product || undefined,
            related_qr: form.related_qr || undefined,
            preferred_contact: form.preferred_contact,
            template_code: form.template_code || undefined,
          },
        });
      }
      toast.success(`Created ${ticket.ticket_number}`);
      router.push("/dashboard/service-desk/tickets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Smart Ticket Create"
        description="AI classify · templates · multi-channel · asset QR · related ERP records"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={runAi}>
            <Wand2 className="h-4 w-4 mr-1" /> AI classify
          </Button>
        }
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Request</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label>Template</Label>
                  <Select
                    value={form.template_code || "none"}
                    onValueChange={(v) => {
                      if (v === "none") return;
                      applyTemplate(v);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={String(t.id)} value={String(t.template_code)}>
                          {String(t.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS_EXTENDED.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <Input required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
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
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <Label>Impact</Label>
                  <Select value={form.impact} onValueChange={(v) => setForm((f) => ({ ...f, impact: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Urgency</Label>
                  <Select value={form.urgency} onValueChange={(v) => setForm((f) => ({ ...f, urgency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {URGENCY_LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Requester & links</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Requester name</Label>
                <Input value={form.requester_name} onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.requester_email} onChange={(e) => setForm((f) => ({ ...f, requester_email: e.target.value }))} />
              </div>
              <div>
                <Label>Department</Label>
                <Input value={form.department_name} onChange={(e) => setForm((f) => ({ ...f, department_name: e.target.value }))} />
              </div>
              <div>
                <Label>Location / branch</Label>
                <Input value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><QrCode className="h-3 w-3" /> Asset tag / QR</Label>
                <Input value={form.asset_tag} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} placeholder="HDG-IT-LAP-000001" />
              </div>
              <div>
                <Label>Related invoice</Label>
                <Input value={form.related_invoice} onChange={(e) => setForm((f) => ({ ...f, related_invoice: e.target.value }))} />
              </div>
              <div>
                <Label>Related product</Label>
                <Input value={form.related_product} onChange={(e) => setForm((f) => ({ ...f, related_product: e.target.value }))} />
              </div>
              <div>
                <Label>Related QR / dispatch</Label>
                <Input value={form.related_qr} onChange={(e) => setForm((f) => ({ ...f, related_qr: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Creating…" : "Create ticket"}
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4" /> AI assist</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {aiHints.length === 0 ? (
                <p className="text-muted-foreground text-xs">Run AI classify to suggest category, priority, and KB articles.</p>
              ) : (
                aiHints.map((h, i) => (
                  <p key={i} className="text-xs text-muted-foreground border rounded p-2">{h}</p>
                ))
              )}
              {kb.map((k) => (
                <div key={k.title} className="flex justify-between text-xs border-b py-1">
                  <span>{k.title}</span>
                  <Badge variant="outline" className="text-[9px]">{Math.round(k.score * 100)}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">SLA preview</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              {PRIORITIES.filter((p) => p.value === form.priority).map((p) => (
                <div key={p.value}>
                  <p className="font-medium text-foreground">{p.label}</p>
                  <p>First response: {p.responseMin} min</p>
                  <p>Resolve: {p.resolveMin} min</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
