"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type KanbanCard = {
  id: string;
  title: string;
  subtitle?: string;
  columnId: string;
  priority?: "low" | "normal" | "high" | "urgent";
  meta?: ReactNode;
};

export type KanbanColumn = {
  id: string;
  title: string;
  color?: string;
};

type Props = {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove?: (cardId: string, toColumnId: string) => void | Promise<void>;
  onCardClick?: (card: KanbanCard) => void;
  className?: string;
  /** Read-only board */
  readOnly?: boolean;
};

const priorityClass: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  normal: "border-l-slate-300",
  low: "border-l-slate-200",
};

export function KanbanBoard({
  columns,
  cards,
  onMove,
  onCardClick,
  className,
  readOnly,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map: Record<string, KanbanCard[]> = {};
    for (const c of columns) map[c.id] = [];
    for (const card of cards) {
      if (!map[card.columnId]) map[card.columnId] = [];
      map[card.columnId].push(card);
    }
    return map;
  }, [cards, columns]);

  const handleDrop = async (columnId: string) => {
    if (!draggingId || readOnly || !onMove) return;
    const card = cards.find((c) => c.id === draggingId);
    if (card && card.columnId !== columnId) {
      await onMove(draggingId, columnId);
    }
    setDraggingId(null);
    setOverCol(null);
  };

  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory",
        className
      )}
    >
      {columns.map((col) => {
        const list = byColumn[col.id] || [];
        return (
          <div
            key={col.id}
            className={cn(
              "flex w-[min(100%,280px)] shrink-0 flex-col rounded-xl border bg-muted/30 snap-start min-h-[320px]",
              overCol === col.id && "ring-2 ring-accent/40"
            )}
            onDragOver={(e) => {
              if (readOnly) return;
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(col.id);
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: col.color || "hsl(var(--accent))" }}
                />
                <h3 className="text-sm font-semibold truncate">{col.title}</h3>
              </div>
              <Badge variant="secondary" className="tabular-nums text-[10px]">
                {list.length}
              </Badge>
            </div>
            <div className="flex-1 space-y-2 p-2 overflow-y-auto max-h-[60vh]">
              {list.map((card) => (
                <div
                  key={card.id}
                  draggable={!readOnly && !!onMove}
                  onDragStart={() => setDraggingId(card.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onCardClick?.(card)}
                  className={cn(
                    "rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:border-accent/40 transition-colors border-l-4",
                    priorityClass[card.priority || "normal"],
                    draggingId === card.id && "opacity-50"
                  )}
                >
                  <p className="text-sm font-medium leading-snug">{card.title}</p>
                  {card.subtitle && (
                    <p className="text-caption mt-1 line-clamp-2">{card.subtitle}</p>
                  )}
                  {card.meta && <div className="mt-2">{card.meta}</div>}
                </div>
              ))}
              {list.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8">
                  Drop cards here
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
