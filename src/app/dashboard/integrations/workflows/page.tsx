"use client";

import { useEffect, useState } from "react";
import { Workflow, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { runWorkflow } from "@/lib/integration";

export default function WorkflowsPage() {
  const { auth } = useUser();
  const [workflows, setWorkflows] = useState<Array<Record<string, unknown>>>([]);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    event: "invoice.created",
    steps_json: '[{"id":"1","type":"notify","config":{"channel":"email"}},{"id":"2","type":"http","config":{"method":"POST"}}]',
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from("intg_workflows").select("*").is("deleted_at", null).order("name"),
      supabase.from("intg_workflow_runs").select("*, intg_workflows(name,workflow_code)").order("started_at", { ascending: false }).limit(40),
    ]);
    setWorkflows(w ?? []);
    setRuns(r ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth?.profile?.company_id) return;
    try {
      let steps = [];
      try {
        steps = JSON.parse(form.steps_json);
      } catch {
        throw new Error("Invalid steps JSON");
      }
      const supabase = createClient();
      const code = `WF-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("intg_workflows").insert({
        company_id: auth.profile.company_id,
        workflow_code: code,
        name: form.name,
        trigger_type: "event",
        trigger_config: { event: form.event },
        steps,
        is_active: true,
        created_by: auth.profile.id,
      });
      if (error) throw error;
      toast.success("Workflow created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const run = async (id: string) => {
    try {
      const supabase = createClient();
      const res = await runWorkflow(supabase, id, { manual: true });
      toast.success(`Run ${res.status} · ${res.step_log.length} steps`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    }
  };

  if (loading) return <LoadingState message="Loading workflows…" />;

  return (
    <div>
      <PageHeader
        title="Automation Builder"
        description="Triggers · conditions · actions · mapping · retries · schedules"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New workflow</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Workflow</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Trigger event</Label><Input value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} /></div>
                <div>
                  <Label>Steps JSON</Label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                    value={form.steps_json}
                    onChange={(e) => setForm((f) => ({ ...f, steps_json: e.target.value }))}
                  />
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        {workflows.map((wf) => (
          <Card key={String(wf.id)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-teal-700" /> {String(wf.name)}
                </CardTitle>
                <Badge variant={wf.is_active ? "default" : "secondary"}>
                  {wf.is_active ? "Active" : "Off"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs font-mono">{String(wf.workflow_code)} · trigger: {String(wf.trigger_type)}</p>
              <p className="text-muted-foreground text-xs">{String(wf.description || "—")}</p>
              <ol className="text-xs list-decimal pl-4 space-y-0.5">
                {((wf.steps as Array<{ type: string; id: string }>) || []).map((s) => (
                  <li key={s.id}>{s.type}</li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">Runs: {String(wf.run_count || 0)}</p>
              <Button size="sm" variant="outline" onClick={() => run(String(wf.id))}>
                <Play className="h-3.5 w-3.5 mr-1" /> Run now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-2">Recent runs</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs">{(r.intg_workflows as { name?: string } | null)?.name}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                <TableCell className="text-xs">{((r.step_log as unknown[]) || []).length}</TableCell>
                <TableCell className="text-xs">{new Date(String(r.started_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
