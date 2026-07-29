"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Printer, ShieldOff, CheckCircle, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  activateCredential,
  suspendCredential,
  issueCredential,
  buildCardPrintHtml,
  contextFromIdentity,
  printCardHtml,
  generateJobNumber,
  type WidCredential,
  type CardDesign,
} from "@/lib/workforce-id";

function CardsInner() {
  const { auth } = useUser();
  const sp = useSearchParams();
  const identityFilter = sp.get("identity") || "";
  const [rows, setRows] = useState<WidCredential[]>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; full_name: string; identity_number: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    identity_id: identityFilter || "",
    template_id: "",
    credential_type: "pvc",
    with_rfid: false,
    expiry_date: "",
  });

  const load = async () => {
    const supabase = createClient();
    let query = supabase
      .from("wid_credentials")
      .select("*, wid_identities(*), wid_card_templates(name,template_code,design_json)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (identityFilter) query = query.eq("identity_id", identityFilter);
    const [{ data }, { data: ids }, { data: tpls }] = await Promise.all([
      query,
      supabase.from("wid_identities").select("id,full_name,identity_number").is("deleted_at", null).order("full_name").limit(300),
      supabase.from("wid_card_templates").select("id,name").eq("is_active", true).is("deleted_at", null),
    ]);
    setRows((data as WidCredential[]) ?? []);
    setIdentities(ids ?? []);
    setTemplates(tpls ?? []);
    if (identityFilter) setForm((f) => ({ ...f, identity_id: identityFilter }));
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [identityFilter]);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id || !form.identity_id) return;
    setSaving(true);
    try {
      const supabase = createClient();
      await issueCredential(supabase, {
        company_id: auth.profile.company_id,
        identity_id: form.identity_id,
        template_id: form.template_id || null,
        credential_type: form.credential_type,
        expiry_date: form.expiry_date || null,
        with_rfid: form.with_rfid || form.credential_type === "rfid",
        with_nfc: form.credential_type === "nfc" || form.with_rfid,
        created_by: auth.profile.id,
        auto_queue_print: true,
      });
      toast.success("Credential issued and queued for print");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: string) => {
    try {
      const supabase = createClient();
      await activateCredential(supabase, id);
      toast.success("Credential activated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activate failed");
    }
  };

  const suspend = async (id: string) => {
    try {
      const supabase = createClient();
      await suspendCredential(supabase, id, "Suspended from credentials console");
      toast.success("Credential suspended & access paused");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suspend failed");
    }
  };

  const printCard = async (c: WidCredential) => {
    try {
      const identity = c.wid_identities as Record<string, unknown> | null;
      const design = (c.wid_card_templates?.design_json || {
        front: [],
        back: [],
      }) as CardDesign;
      if (!identity) throw new Error("Identity missing");
      const ctx = contextFromIdentity(identity, c as unknown as Record<string, unknown>);
      const html = buildCardPrintHtml({
        design,
        ctx,
        qrPublicId: c.qr_public_id,
        title: c.credential_number,
      });
      printCardHtml(html);

      const supabase = createClient();
      await supabase
        .from("wid_credentials")
        .update({
          status: c.status === "active" ? "active" : "printed",
          printed_at: new Date().toISOString(),
          print_count: (c.print_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id);

      if (auth?.profile?.company_id) {
        const { count } = await supabase
          .from("wid_print_jobs")
          .select("*", { count: "exact", head: true })
          .eq("company_id", auth.profile.company_id);
        await supabase.from("wid_print_jobs").insert({
          company_id: auth.profile.company_id,
          credential_id: c.id,
          job_number: generateJobNumber((count ?? 0) + 1),
          printer_brand: "browser",
          printer_name: "Browser Print",
          status: "completed",
          completed_at: new Date().toISOString(),
          requested_by: auth.profile.id,
        });
        await supabase.from("wid_print_history").insert({
          company_id: auth.profile.company_id,
          credential_id: c.id,
          event_type: "printed",
          message: `Printed ${c.credential_number}`,
          actor_id: auth.profile.id,
        });
      }
      toast.success("Print dialog opened");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.credential_number.toLowerCase().includes(s) ||
      (r.wid_identities?.full_name || "").toLowerCase().includes(s) ||
      (r.qr_public_id || "").toLowerCase().includes(s) ||
      (r.rfid_uid || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading credentials…" />;

  return (
    <div>
      <PageHeader
        title="ID Cards & Credentials"
        description="PVC · RFID · NFC · smart card · mobile — full lifecycle"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Issue Card</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Issue credential</DialogTitle></DialogHeader>
              <form onSubmit={issue} className="space-y-3">
                <div>
                  <Label>Identity</Label>
                  <Select value={form.identity_id} onValueChange={(v) => setForm((f) => ({ ...f, identity_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {identities.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.identity_number} · {i.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template</Label>
                  <Select value={form.template_id || "_auto"} onValueChange={(v) => setForm((f) => ({ ...f, template_id: v === "_auto" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_auto">Default</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Credential type</Label>
                  <Select value={form.credential_type} onValueChange={(v) => setForm((f) => ({ ...f, credential_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pvc", "rfid", "nfc", "smart_card", "mobile", "visitor"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.with_rfid} onChange={(e) => setForm((f) => ({ ...f, with_rfid: e.target.checked }))} />
                  Generate RFID / NFC UIDs
                </label>
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.identity_id}>{saving ? "Issuing…" : "Issue"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Total" value={String(rows.length)} icon={CreditCard} />
        <StatCard title="Active" value={String(rows.filter((r) => r.status === "active").length)} icon={CheckCircle} />
        <StatCard title="Suspended" value={String(rows.filter((r) => r.status === "suspended").length)} icon={ShieldOff} />
        <StatCard title="Printed" value={String(rows.filter((r) => r.printed_at).length)} icon={Printer} />
      </div>

      <Input className="max-w-md mb-4" placeholder="Search credential, name, QR, RFID…" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState title="No credentials" description="Issue a card from an identity record." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credential</TableHead>
                <TableHead>Holder</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>QR / RFID</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.credential_number}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.wid_identities?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.wid_identities?.identity_number}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.credential_type}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-xs">
                    <div>{c.qr_public_id || "—"}</div>
                    <div className="text-muted-foreground">{c.rfid_uid || ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">{c.expiry_date || "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => printCard(c)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {c.status !== "active" && !["destroyed", "archived"].includes(c.status) && (
                      <Button size="sm" variant="outline" onClick={() => activate(c.id)}>Activate</Button>
                    )}
                    {c.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => suspend(c.id)}>Suspend</Button>
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

export default function CardsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading credentials…" />}>
      <CardsInner />
    </Suspense>
  );
}
