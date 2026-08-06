"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Send } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

const CHANNELS = ["email", "sms", "push", "in_app", "whatsapp"];

export default function NotificationsSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    template_key: "",
    name: "",
    channel: "email",
    subject: "",
    body: "",
  });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notification_templates")
      .select("*")
      .order("template_key");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (auth?.profile.email) setTestEmail(auth.profile.email);
  }, [auth]);

  const sendTemplate = async (r: Record<string, unknown>) => {
    if (String(r.channel) !== "email") {
      toast.error("Only email channel is sent via Resend. Other channels are queued.");
    }
    const to = testEmail || auth?.profile.email;
    if (!to) {
      toast.error("Set a test recipient email first");
      return;
    }
    setSendingId(String(r.id));
    try {
      const res = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          to,
          template_key: r.template_key,
          vars: {
            name: auth?.profile.first_name || "User",
            number: "HDG-DEMO-001",
            amount: "1,000,000 UGX",
            supplier: "Demo Supplier Ltd",
            start: "2026-08-01",
            end: "2026-08-05",
            link: typeof window !== "undefined" ? window.location.origin : "",
            message: "Test security alert from SecureTrack ERP",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Send failed", { description: data.hint });
      } else if (data.queued && data.channel !== "email") {
        toast.success("Queued for worker delivery");
      } else {
        toast.success(`Sent via Resend to ${to}`, {
          description: data.id ? `id: ${data.id}` : undefined,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSendingId(null);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ template_key: "", name: "", channel: "email", subject: "", body: "" });
    setOpen(true);
  };

  const openEdit = (r: Record<string, unknown>) => {
    setEditId(String(r.id));
    setForm({
      template_key: String(r.template_key),
      name: String(r.name),
      channel: String(r.channel ?? "email"),
      subject: String(r.subject ?? ""),
      body: String(r.body ?? ""),
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const payload = {
      template_key: form.template_key,
      name: form.name,
      channel: form.channel,
      subject: form.subject || null,
      body: form.body || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      const crudRes2 = await crudUpdate("notification_templates", editId, payload);
      if (!crudRes2.ok) {
        toast.error(crudRes2.error);
        return;
      }
    } else {
      const crudRes2 = await crudCreate("notification_templates", payload);
      if (!crudRes2.ok) {
        toast.error(crudRes2.error);
        return;
      }
    }
    toast.success(editId ? "Template updated" : "Template created");
    setOpen(false);
    load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const crudRes = await crudUpdate("notification_templates", id, { is_active: !is_active });
    if (!crudRes.ok) toast.error(crudRes.error);
    else load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Notification Templates"
        description="Email via Resend · SMS/WhatsApp queued · dynamic variables {{name}}"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/email">Resend / Email</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <form onSubmit={save} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>{editId ? "Edit template" : "New template"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Key</Label>
                      <Input
                        value={form.template_key}
                        onChange={(e) => setForm((f) => ({ ...f, template_key: e.target.value }))}
                        required
                        disabled={!!editId}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Channel</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={form.channel}
                        onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                      >
                        {CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Subject</Label>
                    <Input
                      value={form.subject}
                      onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Body</Label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">{editId ? "Update" : "Create"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2 max-w-md">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Test recipient (Resend)</Label>
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Bell} title="No templates" description="Create welcome, invoice, leave templates" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">{String(r.template_key)}</TableCell>
                  <TableCell>{String(r.name)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(r.channel)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {String(r.subject ?? "—")}
                  </TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    {String(r.channel) === "email" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={sendingId === String(r.id)}
                        onClick={() => sendTemplate(r)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        {sendingId === String(r.id) ? "…" : "Send"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(String(r.id), Boolean(r.is_active))}
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </Button>
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
