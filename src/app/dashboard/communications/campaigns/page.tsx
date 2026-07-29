"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { listCampaigns, createCampaign } from "@/lib/communications";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function CampaignsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body_html: "" });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listCampaigns(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.name) return toast.error("Name required");
    try {
      await createCampaign({
        company_id: auth.profile.company_id,
        name: form.name,
        subject: form.subject,
        body_html: form.body_html,
        created_by: auth.user.id,
      });
      toast.success("Campaign created");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading campaigns…" />;

  return (
    <div>
      <PageHeader
        title="Campaign Manager"
        description="Broadcast campaigns · audience · delivery analytics"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New campaign</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No campaigns" description="Create a draft campaign." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.campaign_code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.channel)}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.sent_count ?? 0)}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.created_at))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Body HTML</Label><Textarea value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} /></div>
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
