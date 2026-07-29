"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listReminders, createReminder } from "@/lib/communications";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function RemindersPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    due_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    message: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listReminders(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.title) return toast.error("Title required");
    try {
      await createReminder({
        company_id: auth.profile.company_id,
        title: form.title,
        due_at: new Date(form.due_at).toISOString(),
        message: form.message,
        recipient_user_ids: [auth.user.id],
      });
      toast.success("Reminder created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading reminders…" />;

  return (
    <div>
      <PageHeader
        title="Reminders & Escalations"
        description="Approvals · contracts · maintenance · deadlines · collections"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No reminders" description="Create a due reminder." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="text-sm font-medium">{String(r.title)}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.due_at))}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate">{String(r.message || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Due</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
            <div><Label>Message</Label><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
