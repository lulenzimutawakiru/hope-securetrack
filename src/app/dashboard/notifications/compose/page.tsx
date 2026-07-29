"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function ComposeNotificationPage() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    category: "system",
    priority: "normal",
    type: "info",
    link: "",
    channels: {
      in_app: true,
      email: true,
      sms: false,
      whatsapp: false,
    },
    all_users: true,
    force: false,
  });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const channels = Object.entries(form.channels)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          category: form.category,
          priority: form.priority,
          type: form.type,
          link: form.link || undefined,
          channels,
          all_users: form.all_users,
          force: form.force,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Send failed");
      else {
        toast.success(
          `Sent: ${data.inApp} in-app · ${data.email} email · ${data.skipped} skipped · ${data.failed} failed`
        );
        setForm((f) => ({ ...f, title: "", message: "" }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Compose Notification"
        description="Broadcast to company users · multi-channel · respects preferences unless forced"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/notifications">Inbox</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/email">Resend</Link>
            </Button>
          </div>
        }
      />

      <form onSubmit={send} className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Broadcast message
            </CardTitle>
            <CardDescription>
              Creates in-app inbox items and emails via Resend when enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <textarea
                required
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="low">low</option>
                  <option value="normal">normal</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="info">info</option>
                  <option value="success">success</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                  <option value="fraud_alert">fraud_alert</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Link (optional)</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="/dashboard/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ["in_app", "In-app"],
                    ["email", "Email"],
                    ["sms", "SMS"],
                    ["whatsapp", "WhatsApp"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.channels[k]}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          channels: { ...f.channels, [k]: !f.channels[k] },
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.all_users}
                onChange={() => setForm((f) => ({ ...f, all_users: !f.all_users }))}
              />
              Send to all active company users
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.force}
                onChange={() => setForm((f) => ({ ...f, force: !f.force }))}
              />
              Force channels (ignore user preference mutes)
            </label>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send notification"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
