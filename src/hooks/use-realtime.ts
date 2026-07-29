"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type Options<T extends Record<string, unknown>> = {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  /** Called on each change */
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
};

/**
 * Subscribe to Postgres changes via Supabase Realtime.
 * Returns connection status and last event timestamp.
 */
export function useRealtimeTable<T extends Record<string, unknown> = Record<string, unknown>>(
  options: Options<T>
) {
  const {
    table,
    schema = "public",
    event = "*",
    filter,
    onChange,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<"idle" | "connecting" | "subscribed" | "error" | "closed">(
    "idle"
  );
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    try {
      const supabase = getBrowserSupabase();
      setStatus("connecting");
      setError(null);

      const channelName = `rt:${schema}:${table}:${event}:${filter || "all"}:${Math.random().toString(36).slice(2, 8)}`;

      channel = supabase
        .channel(channelName)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          {
            event,
            schema,
            table,
            ...(filter ? { filter } : {}),
          },
          (payload: RealtimePostgresChangesPayload<T>) => {
            if (cancelled) return;
            setLastAt(Date.now());
            cbRef.current?.(payload);
          }
        )
        .subscribe((s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") setStatus("subscribed");
          else if (s === "CHANNEL_ERROR") {
            setStatus("error");
            setError("Channel error");
          } else if (s === "TIMED_OUT") {
            setStatus("error");
            setError("Timed out");
          } else if (s === "CLOSED") setStatus("closed");
        });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Realtime failed");
    }

    return () => {
      cancelled = true;
      if (channel) {
        try {
          getBrowserSupabase().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
      setStatus("closed");
    };
  }, [table, schema, event, filter, enabled]);

  return { status, lastAt, error, isLive: status === "subscribed" };
}

/**
 * Multi-table realtime fan-in for live ops dashboards.
 */
export function useRealtimeTables(
  tables: string[],
  onAny?: (table: string, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  enabled = true
) {
  const [tick, setTick] = useState(0);
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !tables.length) return;

    const supabase = getBrowserSupabase();
    const channels: RealtimeChannel[] = [];
    let live = 0;

    for (const table of tables) {
      const ch = supabase
        .channel(`rt-multi:${table}:${Date.now()}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            setTick((t) => t + 1);
            onAny?.(table, payload);
          }
        )
        .subscribe((s) => {
          if (s === "SUBSCRIBED") {
            live += 1;
            setLiveCount(live);
          }
        });
      channels.push(ch);
    }

    return () => {
      channels.forEach((c) => {
        try {
          supabase.removeChannel(c);
        } catch {
          /* ignore */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), enabled]);

  return { tick, liveCount };
}
