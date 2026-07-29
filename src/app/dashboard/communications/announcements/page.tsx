"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listAnnouncements, createAnnouncement } from "@/lib/communications";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function AnnouncementsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", priority: "normal" });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listAnnouncements(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.title || !form.body) return toast.error("Title and body required");
    try {
      await createAnnouncement({
        company_id: auth.profile.company_id,
        title: form.title,
        body: form.body,
        priority: form.priority,
        created_by: auth.user.id,
      });
      toast.success("Published");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading announcements…" />;

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company-wide pinned notices and broadcasts"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Publish</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No announcements" description="Publish a company notice." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id as string}>
              <CardHeader className="pb-2">
                <div className="flex justify-between gap-2">
                  <CardTitle className="text-sm">{String(r.title)}</CardTitle>
                  <div className="flex gap-1">
                    {r.is_pinned ? <Badge>Pinned</Badge> : null}
                    <Badge variant="outline">{String(r.priority)}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{formatDate(String(r.publish_at || r.created_at))}</p>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(r.body)}</p></CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
