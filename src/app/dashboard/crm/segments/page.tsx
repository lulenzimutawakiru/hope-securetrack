"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { listSegments, campaignTargetHint } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmSegmentsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  const load = async () => {
    try {
      setRows(await listSegments());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      const supabase = createClient();
      const code = form.code || form.name.slice(0, 8).toUpperCase().replace(/\s/g, "-");
      const { error } = await supabase.from("crm_segments").insert({
        company_id: auth.profile.company_id,
        code,
        name: form.name,
        description: form.description || null,
        is_dynamic: true,
        is_active: true,
        created_by: auth.user.id,
      });
      if (error) throw error;
      toast.success("Segment created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading segments…" />;

  return (
    <div>
      <PageHeader
        title="Customer Segmentation"
        description="Dynamic audiences for campaigns · AI targeting recommendations"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/campaigns">Campaigns</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New segment</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Create segment</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Code</Label>
                      <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="GOV-EDU" />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No segments" description="Apply migration 00044 for seed segments." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <Card key={String(s.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{String(s.name)}</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[10px]">{String(s.code)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{String(s.description || "No description")}</p>
                <p className="text-sm">
                  <span className="font-semibold">{String(s.member_count ?? 0)}</span>{" "}
                  <span className="text-muted-foreground">members</span>
                  {s.is_dynamic ? (
                    <Badge variant="outline" className="ml-2 text-[10px]">Dynamic</Badge>
                  ) : null}
                </p>
                <p className="text-[11px] text-hope-teal bg-hope-teal/5 rounded p-2 border border-hope-teal/20">
                  AI: {campaignTargetHint(String(s.name) + " " + String(s.code))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
