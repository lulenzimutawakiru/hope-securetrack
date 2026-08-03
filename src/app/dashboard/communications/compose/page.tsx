"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/hooks/use-user";
import { MultiFileUpload } from "@/components/ui/file-upload";
import { composeMessage, COMM_CHANNELS, DOC_TYPES } from "@/lib/communications";
import type { UploadResult } from "@/lib/storage";
import { toast } from "sonner";

export default function ComposeMessagePage() {
  const { auth } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadResult[]>([]);
  const [form, setForm] = useState({
    channel: "email",
    to: "",
    subject: "",
    body: "",
    category: "system",
    priority: "normal",
    template_code: "",
    attach: "",
  });

  const send = async () => {
    if (!auth) return;
    if (!form.subject && form.channel === "email") {
      toast.error("Subject required for email");
      return;
    }
    setBusy(true);
    try {
      const msg = await composeMessage({
        company_id: auth.profile.company_id,
        channel: form.channel,
        subject: form.subject,
        body_text: form.body,
        body_html: `<p>${form.body.replace(/\n/g, "<br/>")}</p>`,
        to_addresses: form.to.split(/[,;\s]+/).filter(Boolean),
        recipient_user_ids: [auth.user.id],
        category: form.category,
        priority: form.priority,
        template_code: form.template_code || undefined,
        attach_docs: form.attach ? form.attach.split(",").map((s) => s.trim()).filter(Boolean) : [],
        source_module: "communications",
        source_event: "manual.compose",
        actor_id: auth.user.id,
        vars: {
          company_name: "SecureTrack ERP",
          message: form.body,
          title: form.subject,
        },
      });
      toast.success(`Queued ${msg.message_number}`);
      router.push(`/dashboard/communications/messages/${msg.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Compose Communication"
        description="Branded multi-channel message · auto-attachments · audit trail"
        actions={
          <Button size="sm" onClick={send} disabled={busy}>
            <Send className="h-4 w-4 mr-1" />{busy ? "Sending…" : "Send / Queue"}
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Message</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMM_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low", "normal", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>To (emails, comma-separated)</Label>
            <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="user@example.com" />
          </div>
          <div>
            <Label>Template code (optional)</Label>
            <Input value={form.template_code} onChange={(e) => setForm({ ...form, template_code: e.target.value })} placeholder="GENERIC_NOTIFY" />
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div>
            <Label>Attach document types (auto-generate registry)</Label>
            <Input
              value={form.attach}
              onChange={(e) => setForm({ ...form, attach: e.target.value })}
              placeholder="invoice, po, payslip"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Types: {DOC_TYPES.slice(0, 12).join(", ")}…
            </p>
          </div>
          <div>
            <Label>Upload file attachments</Label>
            <MultiFileUpload
              bucket="attachments"
              category="attachment"
              folder="communications"
              entityTable="comm_messages"
              onUploaded={(r) => setUploads((u) => [r, ...u])}
            />
            {uploads.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {uploads.length} file(s) uploaded and ready to reference.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
