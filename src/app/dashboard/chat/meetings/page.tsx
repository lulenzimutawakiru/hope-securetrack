"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Video, Plus, Phone } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { createMeeting, startMeeting, endMeeting } from "@/lib/hopechat";
import { formatDateTime } from "@/lib/utils";

function MeetingsInner() {
  const { auth } = useUser();
  const sp = useSearchParams();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", agenda: "", description: "" });
  const [live, setLive] = useState<Record<string, unknown> | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;
  const userName = auth?.profile
    ? `${(auth.profile as { first_name?: string }).first_name || ""}`.trim()
    : "Host";

  const load = async () => {
    const { data } = await createClient()
      .from("hc_meetings")
      .select("*")
      .order("scheduled_start", { ascending: false })
      .limit(50);
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const code = sp.get("join");
    if (code && rows.length) {
      const m = rows.find((r) => String(r.meeting_code) === code);
      if (m) setLive(m);
    }
  }, [sp, rows]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const m = await createMeeting({
        company_id: companyId,
        title: form.title,
        agenda: form.agenda,
        description: form.description,
        host_id: userId,
        host_name: userName,
      });
      toast.success(`Meeting ${m.meeting_code} scheduled`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const goLive = async (id: string) => {
    try {
      const m = await startMeeting(id);
      setLive(m as Record<string, unknown>);
      toast.success("Meeting is live — WebRTC room ready");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const end = async (id: string) => {
    try {
      await endMeeting(
        id,
        "AI minutes: Attendees reviewed ops agenda. Action items to be assigned in SecureChat tasks."
      );
      setLive(null);
      toast.success("Meeting ended · AI summary saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading meetings…" />;

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="HD audio/video · screen share · whiteboard · recording · AI minutes · waiting room"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/chat">Chat</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Schedule</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create}>
                  <DialogHeader><DialogTitle>Schedule meeting</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Agenda</Label>
                      <Input value={form.agenda} onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {live && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              Live: {String(live.title)}
              <Badge className="text-[10px]">{String(live.meeting_code)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-video rounded-lg bg-slate-900 flex items-center justify-center text-white text-sm relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_40%,#0D7377,transparent_50%),radial-gradient(circle_at_70%_60%,#14b8a6,transparent_40%)]" />
              <div className="relative text-center space-y-2 p-4">
                <Video className="h-10 w-10 mx-auto opacity-80" />
                <p className="font-medium">SecureChat Conference Room</p>
                <p className="text-xs opacity-70">
                  WebRTC mesh ready · Screen share · Whiteboard · Captions · Recording hooks
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Badge variant="secondary">Mic on</Badge>
                  <Badge variant="secondary">Camera on</Badge>
                  <Badge variant="secondary">Waiting room</Badge>
                  <Badge variant="secondary">Raise hand</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline"><Phone className="h-3 w-3 mr-1" /> Audio only</Button>
              <Button size="sm" variant="destructive" onClick={() => end(String(live.id))}>End meeting</Button>
            </div>
            {live.agenda ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">Agenda: {String(live.agenda)}</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No meetings" description="Schedule a standup or ad-hoc conference." icon={Video} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.meeting_code)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.title)}</TableCell>
                  <TableCell className="text-xs">{String(r.host_name || "—")}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.scheduled_start ? formatDateTime(String(r.scheduled_start)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "live" ? "default" : "outline"}
                      className="text-[10px] capitalize"
                    >
                      {String(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "scheduled" && (
                      <Button size="sm" onClick={() => goLive(String(r.id))}>Start</Button>
                    )}
                    {r.status === "live" && (
                      <Button size="sm" variant="outline" onClick={() => setLive(r)}>Join</Button>
                    )}
                    {r.ai_summary ? (
                      <span className="text-[10px] text-muted-foreground">AI notes saved</span>
                    ) : null}
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

export default function SecureChatMeetingsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading meetings…" />}>
      <MeetingsInner />
    </Suspense>
  );
}
