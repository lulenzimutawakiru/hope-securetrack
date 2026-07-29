"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { listTimeline, addTimeline, listSuppliers } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmTimelinePage() {
  const { auth } = useUser();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [supplierId, setSupplierId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    kind: "note",
    title: "",
    body: "",
  });

  const load = async () => {
    try {
      const [s, e] = await Promise.all([
        listSuppliers({ limit: 80 }),
        listTimeline(supplierId === "all" ? undefined : supplierId),
      ]);
      setSuppliers(s);
      setEvents(e);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !form.supplier_id) return;
    try {
      await addTimeline({
        company_id: auth.profile.company_id,
        supplier_id: form.supplier_id,
        kind: form.kind,
        title: form.title,
        body: form.body,
        actor_id: auth.user.id,
        actor_name: auth.user.email || "User",
      });
      toast.success("Timeline event logged");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading timeline…" />;

  return (
    <div>
      <PageHeader
        title="Supplier Timeline"
        description="Calls · email · WhatsApp · RFQ · PO · delivery · QC · payments · portal"
        actions={
          <div className="flex gap-2">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log event</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Log timeline event</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={String(s.id)} value={String(s.id)}>{String(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["note", "call", "email", "whatsapp", "meeting", "document"].map((k) => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Details</Label>
                      <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
          </div>
        }
      />

      {events.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No timeline events" description="Log communications and milestones." />
      ) : (
        <div className="relative border-l-2 border-muted ml-3 space-y-4 pl-6">
          {events.map((ev) => (
            <div key={String(ev.id)} className="relative">
              <span className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-lg border p-3 bg-card">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium text-sm">{String(ev.title)}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {ev.occurred_at ? new Date(String(ev.occurred_at)).toLocaleString() : ""}
                  </span>
                </div>
                {ev.body ? <p className="text-xs text-muted-foreground mt-1">{String(ev.body)}</p> : null}
                <Badge variant="secondary" className="text-[10px] mt-2 capitalize">{String(ev.kind)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
