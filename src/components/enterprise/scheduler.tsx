"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  format,
  startOfWeek,
  isSameDay,
  parseISO,
  isValid,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ScheduleEvent = {
  id: string;
  title: string;
  date: string; // ISO date or datetime
  endDate?: string;
  color?: string;
  meta?: string;
};

type Props = {
  events: ScheduleEvent[];
  onEventClick?: (event: ScheduleEvent) => void;
  className?: string;
  weekStartsOn?: 0 | 1;
};

export function Scheduler({
  events,
  onEventClick,
  className,
  weekStartsOn = 1,
}: Props) {
  const [anchor, setAnchor] = useState(() => new Date());

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn }),
    [anchor, weekStartsOn]
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const d of days) {
      map.set(format(d, "yyyy-MM-dd"), []);
    }
    for (const ev of events) {
      let d: Date;
      try {
        d = parseISO(ev.date);
        if (!isValid(d)) d = new Date(ev.date);
      } catch {
        continue;
      }
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) continue;
      map.get(key)!.push(ev);
    }
    return map;
  }, [days, events]);

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAnchor((d) => addDays(d, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAnchor((d) => addDays(d, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm font-semibold">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </p>
        <Badge variant="secondary" className="tabular-nums">
          {events.length} events
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x min-h-[320px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDay.get(key) || [];
          const today = isSameDay(day, new Date());
          return (
            <div key={key} className="flex flex-col min-h-[120px] sm:min-h-[280px]">
              <div
                className={cn(
                  "px-2 py-1.5 border-b text-center",
                  today && "bg-accent/10"
                )}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {format(day, "EEE")}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    today && "text-accent"
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
              <div className="flex-1 space-y-1 p-1.5 overflow-y-auto">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick?.(ev)}
                    className="w-full text-left rounded-md border px-1.5 py-1 text-[11px] leading-snug hover:border-accent/50 transition-colors"
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: ev.color || "hsl(var(--accent))",
                    }}
                  >
                    <span className="font-medium line-clamp-2">{ev.title}</span>
                    {ev.meta && (
                      <span className="block text-muted-foreground truncate">
                        {ev.meta}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
