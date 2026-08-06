"use client";

import { useEffect, useState } from "react";
import { Plus, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  } from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listBoardMembers, listCommittees, listMeetings, listSignatories,
  createBoardMember,
  createMeeting,
  } from "@/lib/enterprise-company";
import { toast } from "sonner";

export default function GovernancePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Array<Record<string, unknown>>>([]);
  const [committees, setCommittees] = useState<Array<Record<string, unknown>>>([]);
  const [meetings, setMeetings] = useState<Array<Record<string, unknown>>>([]);
  const [signatories, setSignatories] = useState<Array<Record<string, unknown>>>([]);
  const [dialog, setDialog] = useState<"board" | "meeting" | null>(null);
  const [form, setForm] = useState({ full_name: "", title: "", meeting_title: "" });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    const cid = auth.profile.company_id;
    try {
      const [b, c, m, s] = await Promise.all([
        listBoardMembers(cid), listCommittees(cid), listMeetings(cid), listSignatories(cid),
      ]);
      setBoard(b as Array<Record<string, unknown>>);
      setCommittees(c as Array<Record<string, unknown>>);
      setMeetings(m as Array<Record<string, unknown>>);
      setSignatories(s as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth) return;
    try {
      if (dialog === "board") {
        if (!form.full_name) return toast.error("Name required");
        await createBoardMember({
          company_id: auth.profile.company_id,
          full_name: form.full_name,
          title: form.title || undefined});
      } else if (dialog === "meeting") {
        if (!form.meeting_title) return toast.error("Title required");
        await createMeeting({
          company_id: auth.profile.company_id,
          title: form.meeting_title,
          created_by: auth.user.id});
      }
      toast.success("Saved");
      setDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading governance…" />;

  return (
    <div>
      <PageHeader
        title="Corporate Governance"
        description="Board · committees · meetings · signatories · resolutions"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog("board")}>
              <Plus className="h-4 w-4 mr-1" /> Board member
            </Button>
            <Button size="sm" onClick={() => setDialog("meeting")}>
              <Plus className="h-4 w-4 mr-1" /> Meeting
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Board ({board.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {board.map((b) => (
              <div key={b.id as string} className="flex justify-between rounded border px-2 py-1.5 text-sm">
                <div>
                  <p className="font-medium">{String(b.full_name)}</p>
                  <p className="text-[11px] text-muted-foreground">{String(b.title || "—")}</p>
                </div>
                <Badge variant="outline" className="text-[10px] h-fit">{String(b.member_type)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Committees ({committees.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {committees.map((c) => (
              <div key={c.id as string} className="rounded border px-2 py-1.5 text-sm">
                <p className="font-medium">{String(c.name)}</p>
                <p className="text-[11px] text-muted-foreground">Chair: {String(c.chair_name || "—")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Meetings</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meetings.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm">No meetings</TableCell></TableRow>
                ) : meetings.map((m) => (
                  <TableRow key={m.id as string}>
                    <TableCell className="font-mono text-xs">{String(m.meeting_number || "—")}</TableCell>
                    <TableCell className="text-sm">{String(m.title)}</TableCell>
                    <TableCell><Badge variant="secondary">{String(m.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Authorized signatories</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {signatories.map((s) => (
              <div key={s.id as string} className="flex justify-between rounded border px-2 py-1.5 text-sm">
                <div>
                  <p className="font-medium">{String(s.full_name)}</p>
                  <p className="text-[11px] text-muted-foreground">{String(s.role_title)} · {String(s.authority_scope)}</p>
                </div>
                {s.limit_amount != null && (
                  <span className="text-[10px] text-muted-foreground">
                    up to {Number(s.limit_amount).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "board" ? "Add board member" : "Schedule meeting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {dialog === "board" ? (
              <>
                <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              </>
            ) : (
              <div><Label>Meeting title</Label><Input value={form.meeting_title} onChange={(e) => setForm({ ...form, meeting_title: e.target.value })} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
