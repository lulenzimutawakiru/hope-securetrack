"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Kanban, CalendarDays, Columns2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { KanbanBoard, type KanbanCard, type KanbanColumn } from "@/components/enterprise/kanban-board";
import { Scheduler, type ScheduleEvent } from "@/components/enterprise/scheduler";
import { SplitPanel } from "@/components/enterprise/split-panel";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const BATCH_COLUMNS: KanbanColumn[] = [
  { id: "draft", title: "Draft", color: "#94a3b8" },
  { id: "in_progress", title: "In progress", color: "#3b82f6" },
  { id: "qc_pending", title: "QC pending", color: "#eab308" },
  { id: "approved", title: "Approved", color: "#22c55e" },
  { id: "packed", title: "Packed", color: "#8b5cf6" },
  { id: "completed", title: "Completed", color: "#0d7377" },
];

export default function BoardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selected, setSelected] = useState<KanbanCard | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: batches }, { data: leave }, { data: printJobs }] =
      await Promise.all([
        supabase
          .from("production_batches")
          .select("id, batch_number, production_status, quantity_reams, product_code, created_at")
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("leave_requests")
          .select("id, start_date, end_date, status, leave_type, employees(first_name,last_name)")
          .order("start_date", { ascending: false })
          .limit(40),
        supabase
          .from("print_jobs")
          .select("id, status, created_at, job_number")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    const kanban: KanbanCard[] = (batches ?? []).map((b) => {
      const status = String(b.production_status || "draft");
      const col = BATCH_COLUMNS.find((c) => c.id === status)?.id || "draft";
      return {
        id: String(b.id),
        title: String(b.batch_number),
        subtitle: `${b.product_code ?? "—"} · ${b.quantity_reams ?? 0} reams`,
        columnId: col,
        priority:
          status === "qc_pending"
            ? "high"
            : status === "in_progress"
              ? "normal"
              : "low",
        meta: <StatusBadge status={status} />,
      };
    });
    setCards(kanban);

    const schedule: ScheduleEvent[] = [];
    for (const l of leave ?? []) {
      const emp = l.employees as { first_name?: string; last_name?: string } | null;
      const name = emp
        ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim()
        : "Employee";
      schedule.push({
        id: `leave-${l.id}`,
        title: `Leave · ${name}`,
        date: String(l.start_date),
        endDate: l.end_date ? String(l.end_date) : undefined,
        color: l.status === "approved" ? "#22c55e" : "#eab308",
        meta: `${l.leave_type ?? "leave"} · ${l.status}`,
      });
    }
    for (const j of printJobs ?? []) {
      schedule.push({
        id: `print-${j.id}`,
        title: `Print ${j.job_number ?? j.id}`,
        date: String(j.created_at),
        color: "#3b82f6",
        meta: String(j.status),
      });
    }
    setEvents(schedule);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moveCard = async (cardId: string, toColumnId: string) => {
    const prev = cards;
    setCards((cs) =>
      cs.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c))
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("production_batches")
      .update({ production_status: toColumnId })
      .eq("id", cardId);
    if (error) {
      setCards(prev);
      toast.error(error.message);
    } else {
      toast.success(`Moved to ${toColumnId.replace(/_/g, " ")}`);
    }
  };

  const selectedDetail = useMemo(() => {
    if (!selected) return null;
    return selected;
  }, [selected]);

  if (loading) return <LoadingState message="Loading boards…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Boards & Scheduler"
        description="Kanban · weekly schedule · split inspector — Phase C workspace primitives"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/production">Production</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr/leave">Leave</Link>
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="kanban">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="kanban" className="gap-1">
            <Kanban className="h-3.5 w-3.5" />
            Production kanban
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Week schedule
          </TabsTrigger>
          <TabsTrigger value="split" className="gap-1">
            <Columns2 className="h-3.5 w-3.5" />
            Split workspace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <p className="text-caption mb-3">
            Drag batches between columns to update production status (optimistic + persisted).
          </p>
          <KanbanBoard
            columns={BATCH_COLUMNS}
            cards={cards}
            onMove={moveCard}
            onCardClick={(c) => {
              setSelected(c);
              router.push(`/dashboard/production`);
            }}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <p className="text-caption mb-3">
            Leave requests and print jobs on a weekly calendar. Navigate weeks with arrows.
          </p>
          <Scheduler
            events={events}
            onEventClick={(ev) => {
              if (ev.id.startsWith("leave-")) router.push("/dashboard/hr/leave");
              else router.push("/dashboard/printing");
            }}
          />
        </TabsContent>

        <TabsContent value="split" className="mt-4">
          <p className="text-caption mb-3">
            Dockable-style split: kanban left, detail inspector right. Drag the divider to resize
            (saved per browser).
          </p>
          <SplitPanel
            storageKey="split:boards"
            defaultLeftPct={58}
            left={
              <div className="p-3 h-full">
                <h3 className="text-sm font-semibold mb-2 px-1">Batches</h3>
                <KanbanBoard
                  columns={BATCH_COLUMNS.slice(0, 4)}
                  cards={cards}
                  onMove={moveCard}
                  onCardClick={setSelected}
                />
              </div>
            }
            right={
              <div className="p-4 space-y-3 h-full">
                <h3 className="text-sm font-semibold">Inspector</h3>
                {selectedDetail ? (
                  <div className="rounded-xl border p-4 space-y-2">
                    <p className="font-semibold">{selectedDetail.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedDetail.subtitle}
                    </p>
                    <div>{selectedDetail.meta}</div>
                    <Badge variant="outline">{selectedDetail.columnId}</Badge>
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => router.push("/dashboard/production")}
                    >
                      Open production
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a card on the board to inspect details here.
                  </p>
                )}
              </div>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
