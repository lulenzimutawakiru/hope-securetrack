"use client";

import { useEffect, useState } from "react";
import { GitBranch, Play, RefreshCw, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { listWorkflowDefs, type WorkflowDefinition } from "@/lib/workflows/engine";
import { toast } from "sonner";

type InstanceRow = {
  id: string;
  definition_id: string;
  entity_type: string;
  entity_code?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export default function WorkflowsPage() {
  const defs = listWorkflowDefs();
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [selectedDef, setSelectedDef] = useState(defs[0]?.id || "payroll");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/workflows");
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || "Load failed");
      setInstances(json.data?.instances || []);
    } catch (e) {
      // API may fail if not signed in / migration not applied — still show defs
      toast.error(e instanceof Error ? e.message : "Could not load instances");
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          definition_id: selectedDef,
          entity_type: selectedDef,
          entity_code: `${selectedDef.toUpperCase()}-${Date.now().toString(36)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || "Start failed");
      toast.success("Workflow started");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (instanceId: string, event: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", instance_id: instanceId, event }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || "Advance failed");
      toast.success(`Advanced → ${json.data?.to}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Advance failed");
    } finally {
      setBusy(false);
    }
  };

  const activeDef: WorkflowDefinition | undefined = defs.find((d) => d.id === selectedDef);

  if (loading) return <LoadingState message="Loading workflows…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Workflows"
        description="Recruitment · Procurement · Manufacturing · Payroll · Paper pipeline — state machine driven"
        actions={
          <Button size="sm" variant="outline" onClick={() => { setLoading(true); void load(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {defs.map((d) => (
          <Card
            key={d.id}
            className={selectedDef === d.id ? "border-primary ring-1 ring-primary/30" : "cursor-pointer"}
            onClick={() => setSelectedDef(d.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> {d.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <div>
                Module: <Badge variant="outline">{d.module}</Badge>
              </div>
              <p>{d.stages.length} stages · start: {d.initial}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeDef && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{activeDef.name} pipeline</CardTitle>
            <div className="flex gap-2">
              <Select value={selectedDef} onValueChange={setSelectedDef}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={start} disabled={busy}>
                <Play className="h-4 w-4 mr-1" /> Start instance
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {activeDef.stages.map((s, i) => (
                <span key={s.key} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <Badge variant="secondary">{s.label}</Badge>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Recent instances</h3>
        {instances.length === 0 ? (
          <EmptyState
            title="No workflow instances yet"
            description="Start a process above. Requires migration 00068 (wf_instances)."
          />
        ) : (
          <div className="space-y-2">
            {instances.map((inst) => {
              const def = defs.find((d) => d.id === inst.definition_id);
              const next = def?.transitions
                .filter((t) => {
                  const from = t.from;
                  if (Array.isArray(from)) return from.includes(inst.status) || from.includes("*");
                  return from === inst.status || from === "*";
                })
                .slice(0, 3);
              return (
                <Card key={inst.id}>
                  <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="text-sm">
                      <div className="font-medium">
                        {def?.name || inst.definition_id}{" "}
                        <span className="text-muted-foreground font-normal">
                          {inst.entity_code || inst.entity_type}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status: <Badge variant="outline">{inst.status}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(next || []).map((t) => (
                        <Button
                          key={t.event}
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => advance(inst.id, t.event)}
                        >
                          {t.label || t.event}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
