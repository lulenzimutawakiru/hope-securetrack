"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { publishAnnouncement, ackAnnouncement } from "@/lib/hopechat";
import { formatDateTime } from "@/lib/utils";

export default function HopeChatAnnouncementsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal",
    require_ack: false,
  });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("hc_announcements")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await publishAnnouncement({
        company_id: companyId,
        title: form.title,
        body: form.body,
        priority: form.priority,
        require_ack: form.require_ack,
        created_by: userId,
      });
      toast.success("Announcement published to #announcements");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const ack = async (id: string) => {
    if (!companyId || !userId) return;
    try {
      await ackAnnouncement({
        company_id: companyId,
        announcement_id: id,
        user_id: userId,
      });
      toast.success("Acknowledged");
      await load();
    } catch {
      toast.error("Already acknowledged or failed");
    }
  };

  if (loading) return <LoadingState message="Loading announcements…" />;

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company news · safety · policy · emergency · read confirmations"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Broadcast</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={publish}>
                  <DialogHeader><DialogTitle>Publish announcement</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <textarea
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.require_ack}
                        onChange={(e) => setForm((f) => ({ ...f, require_ack: e.target.checked }))}
                      />
                      Require read confirmation
                    </label>
                  </div>
                  <DialogFooter><Button type="submit">Publish</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No announcements" description="Broadcast company news or safety alerts." icon={Megaphone} />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {rows.map((r) => (
            <Card key={String(r.id)} className={r.priority === "emergency" || r.priority === "critical" ? "border-destructive/40" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  {String(r.title)}
                  <Badge
                    variant={r.priority === "critical" || r.priority === "emergency" ? "destructive" : "outline"}
                    className="text-[10px] capitalize"
                  >
                    {String(r.priority)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap text-muted-foreground">{String(r.body)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{r.published_at ? formatDateTime(String(r.published_at)) : "Draft"}</span>
                  {r.require_ack ? <span>· Acks: {String(r.ack_count || 0)}</span> : null}
                  {r.require_ack && r.status === "published" && userId ? (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => ack(String(r.id))}>
                      Acknowledge
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
