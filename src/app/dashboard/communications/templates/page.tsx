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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listTemplates, upsertTemplate, COMM_CHANNELS } from "@/lib/communications";
import { toast } from "sonner";

export default function TemplatesPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    template_code: "", name: "", channel: "email", category: "system",
    subject_template: "", body_text: "", body_html: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows((await listTemplates(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth || !form.template_code || !form.name) return toast.error("Code and name required");
    try {
      await upsertTemplate({
        company_id: auth.profile.company_id,
        ...form,
        is_active: true,
      }, auth.user.id);
      toast.success("Template saved");
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading templates…" />;

  return (
    <div>
      <PageHeader
        title="Message Templates"
        description="Branded multi-channel templates · {{variables}} · attachments map"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No templates" description="Create email/SMS/push templates." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.template_code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.channel)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.category)}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{String(r.subject_template || "—")}</TableCell>
                  <TableCell><Badge variant="secondary">{r.is_active ? "active" : "off"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.template_code} onChange={(e) => setForm({ ...form, template_code: e.target.value.toUpperCase() })} /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMM_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label><Input value={form.subject_template} onChange={(e) => setForm({ ...form, subject_template: e.target.value })} placeholder="{{title}}" /></div>
            <div><Label>Body text</Label><Textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
