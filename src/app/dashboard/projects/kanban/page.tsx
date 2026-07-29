"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getPpmKanbanTasks, ppmUpdate } from "@/lib/ppm";
import { toast } from "sonner";

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
] as const;

export default function KanbanPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getPpmKanbanTasks(companyId, filter || undefined);
      setTasks(data as Array<Record<string, unknown>>);
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

  const byColumn = useMemo(() => {
    const map: Record<string, Array<Record<string, unknown>>> = {};
    for (const c of COLUMNS) map[c.key] = [];
    for (const t of tasks) {
      const col = String(t.board_column || t.status || "todo");
      const key = COLUMNS.some((c) => c.key === col) ? col : "todo";
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const move = async (task: Record<string, unknown>, column: string) => {
    setBusy(String(task.id));
    try {
      await ppmUpdate(
        "ppm_tasks",
        String(task.id),
        {
          board_column: column,
          status: column === "done" ? "done" : column === "blocked" ? "blocked" : column === "in_review" ? "in_review" : column === "in_progress" ? "in_progress" : "todo",
        },
        auth?.user?.id
      );
      toast.success(`Moved to ${column}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Loading Kanban board…" />;

  return (
    <div>
      <PageHeader
        title="Kanban Board"
        description="Drag status via column actions · full task CRUD on Tasks page"
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => (
          <div key={col.key} className="rounded-lg border bg-muted/20 min-h-[320px]">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">{col.label}</span>
              <Badge variant="secondary">{byColumn[col.key]?.length || 0}</Badge>
            </div>
            <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
              {(byColumn[col.key] || []).map((t) => (
                <Card key={String(t.id)} className="shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-sm font-medium leading-snug">{String(t.name)}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {String(t.task_code)} · {String(t.project_code || "—")}
                    </div>
                    <div className="text-xs">{String(t.assignee_name || "Unassigned")}</div>
                    <div className="flex flex-wrap gap-1">
                      {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                        <Button
                          key={c.key}
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-1.5"
                          disabled={busy === String(t.id)}
                          onClick={() => move(t, c.key)}
                        >
                          → {c.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
