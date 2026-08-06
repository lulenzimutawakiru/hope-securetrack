"use client";

import { useEffect, useState } from "react";
import { Workflow, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";

type Wf = {
  id: string;
  workflow_code: string;
  name: string;
  description: string | null;
  trigger_event: string;
  steps: Array<{ step: number; name: string; action: string }>;
  is_active: boolean;
};

type Run = {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
  wid_workflows?: { name: string; workflow_code: string } | null;
};

export default function WorkflowsPage() {
  const { auth } = useUser();
  const [workflows, setWorkflows] = useState<Wf[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from("wid_workflows").select("*").order("name"),
      supabase
        .from("wid_workflow_runs")
        .select("*, wid_workflows(name,workflow_code)")
        .order("started_at", { ascending: false })
        .limit(50),
    ]);
    setWorkflows((w as Wf[]) ?? []);
    setRuns((r as Run[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const startDemo = async (wf: Wf) => {
    if (!auth?.profile?.company_id) return;
    try {
      const crudRes2 = await crudCreate("wid_workflow_runs", {
        company_id: auth.profile.company_id,
        workflow_id: wf.id,
        entity_type: "demo",
        entity_id: crypto.randomUUID(),
        status: "running",
        current_step: 1,
        step_log: [{ step: 1, name: wf.steps?.[0]?.name || "Start", at: new Date().toISOString() }],
      });
      if (!crudRes2.ok) throw new Error(crudRes2.error);
      toast.success(`Workflow ${wf.workflow_code} started`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const advanceRun = async (run: Run) => {
    const wf = workflows.find((w) => w.id === (run as Run & { workflow_id?: string }).workflow_id)
      || workflows.find((w) => w.workflow_code === run.wid_workflows?.workflow_code);
    const steps = wf?.steps || [];
    const next = (run.current_step || 0) + 1;
    const done = next > steps.length;
    await crudUpdate("wid_workflow_runs", run.id, {
        current_step: done ? run.current_step : next,
        status: done ? "completed" : "running",
        completed_at: done ? new Date().toISOString() : null,
        step_log: [
          ...((run as Run & { step_log?: unknown[] }).step_log as unknown[] || []),
          { step: next, name: steps[next - 1]?.name || "Complete", at: new Date().toISOString() },
        ],
      });
    toast.success(done ? "Workflow completed" : `Step ${next}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading workflows…" />;

  return (
    <div>
      <PageHeader
        title="Identity Workflows"
        description="Onboarding · card creation · approval · print · activation · renewal · termination"
      />

      {workflows.length === 0 ? (
        <EmptyState title="No workflows" description="Seed migration to load default identity workflows." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 mb-8">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-teal-700" /> {wf.name}
                  </CardTitle>
                  <Badge variant={wf.is_active ? "default" : "secondary"}>
                    {wf.is_active ? "Active" : "Off"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{wf.description}</p>
                <p className="text-xs font-mono">Trigger: {wf.trigger_event}</p>
                <ol className="text-sm space-y-1 list-decimal pl-4">
                  {(wf.steps || []).map((s) => (
                    <li key={s.step}>
                      {s.name} <span className="text-xs text-muted-foreground">({s.action})</span>
                    </li>
                  ))}
                </ol>
                <Button size="sm" variant="outline" onClick={() => startDemo(wf)}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Start run
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.wid_workflows?.name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.entity_type}</TableCell>
                    <TableCell>{r.current_step}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {r.status === "running" && (
                        <Button size="sm" variant="outline" onClick={() => advanceRun(r)}>Advance</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
