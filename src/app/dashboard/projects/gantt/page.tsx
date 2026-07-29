"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { getPpmGanttData } from "@/lib/ppm";
import { toast } from "sonner";

export default function GanttPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [milestones, setMilestones] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getPpmGanttData(companyId, filter || undefined);
      setTasks(data.tasks as Array<Record<string, unknown>>);
      setMilestones(data.milestones as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [companyId]);

  const range = useMemo(() => {
    const dates: number[] = [];
    for (const t of tasks) {
      if (t.start_date) dates.push(new Date(String(t.start_date)).getTime());
      if (t.due_date) dates.push(new Date(String(t.due_date)).getTime());
    }
    for (const m of milestones) {
      if (m.due_date) dates.push(new Date(String(m.due_date)).getTime());
    }
    if (dates.length === 0) {
      const now = Date.now();
      return { min: now - 7 * 86400000, max: now + 60 * 86400000 };
    }
    return { min: Math.min(...dates), max: Math.max(...dates) + 7 * 86400000 };
  }, [tasks, milestones]);

  const span = Math.max(1, range.max - range.min);

  const barStyle = (start?: unknown, end?: unknown, pct?: unknown) => {
    const s = start ? new Date(String(start)).getTime() : range.min;
    const e = end ? new Date(String(end)).getTime() : s + 7 * 86400000;
    const left = ((s - range.min) / span) * 100;
    const width = Math.max(2, ((e - s) / span) * 100);
    return {
      left: `${Math.max(0, Math.min(98, left))}%`,
      width: `${Math.min(100 - left, width)}%`,
      opacity: 0.35 + Math.min(1, Number(pct || 0) / 100) * 0.65,
    };
  };

  if (loading) return <LoadingState message="Loading Gantt chart…" />;

  return (
    <div>
      <PageHeader
        title="Gantt Chart"
        description="Schedule bars · milestones · progress · critical path visibility"
        actions={
          <div className="flex gap-2">
            <Input
              className="w-40"
              placeholder="Project code"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLoading(true);
                  load();
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); load(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {tasks.length === 0 && milestones.length === 0 ? (
        <EmptyState title="No schedule data" description="Create tasks with start/due dates to populate the Gantt." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[220px_1fr] border-b bg-muted/40 text-xs font-medium">
              <div className="p-2">Task / Milestone</div>
              <div className="p-2 flex justify-between text-muted-foreground">
                <span>{new Date(range.min).toISOString().slice(0, 10)}</span>
                <span>{new Date(range.max).toISOString().slice(0, 10)}</span>
              </div>
            </div>
            {tasks.map((t) => (
              <div key={String(t.task_code)} className="grid grid-cols-[220px_1fr] border-b text-sm">
                <div className="p-2 truncate">
                  <div className="font-medium truncate">{String(t.name)}</div>
                  <div className="text-xs text-muted-foreground">
                    {String(t.task_code)} · {String(t.assignee_name || "—")}
                  </div>
                </div>
                <div className="relative h-12 bg-[linear-gradient(to_right,transparent_0,transparent_49%,hsl(var(--border))_50%,transparent_51%)] bg-[length:40px_100%]">
                  <div
                    className="absolute top-3 h-5 rounded-sm bg-primary"
                    style={barStyle(t.start_date, t.due_date || t.finish_date, t.percent_complete)}
                    title={`${t.percent_complete || 0}%`}
                  />
                </div>
              </div>
            ))}
            {milestones.map((m) => {
              const pos = m.due_date
                ? ((new Date(String(m.due_date)).getTime() - range.min) / span) * 100
                : 50;
              return (
                <div key={String(m.milestone_code)} className="grid grid-cols-[220px_1fr] border-b text-sm">
                  <div className="p-2 truncate">
                    <div className="font-medium truncate">◆ {String(m.name)}</div>
                    <div className="text-xs text-muted-foreground">{String(m.milestone_code)}</div>
                  </div>
                  <div className="relative h-10">
                    <div
                      className="absolute top-2 -ml-1.5 h-3 w-3 rotate-45 bg-amber-500"
                      style={{ left: `${Math.max(0, Math.min(97, pos))}%` }}
                    />
                    <Badge variant="outline" className="absolute top-1 text-[10px]" style={{ left: `${Math.min(85, pos + 2)}%` }}>
                      {String(m.status)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
