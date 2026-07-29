"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useUser } from "@/hooks/use-user";

export type PresenceUser = {
  user_id: string;
  name: string;
  email?: string;
  role?: string;
  online_at: string;
  path?: string;
};

/**
 * Supabase Presence for "who's online" in the enterprise workspace.
 */
export function usePresence(room = "hope-erp-global", enabled = true) {
  const { auth } = useUser();
  const [peers, setPeers] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<"idle" | "joined" | "error">("idle");

  useEffect(() => {
    if (!enabled || !auth || typeof window === "undefined") return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    try {
      const supabase = getBrowserSupabase();
      const self: PresenceUser = {
        user_id: auth.profile.id,
        name: `${auth.profile.first_name} ${auth.profile.last_name}`.trim(),
        email: auth.profile.email,
        role: auth.profile.roles?.name,
        online_at: new Date().toISOString(),
        path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      };

      channel = supabase.channel(room, {
        config: { presence: { key: auth.profile.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (cancelled || !channel) return;
          const state = channel.presenceState<PresenceUser>();
          const list: PresenceUser[] = [];
          Object.values(state).forEach((arr) => {
            arr.forEach((u) => list.push(u));
          });
          // dedupe by user_id
          const map = new Map(list.map((u) => [u.user_id, u]));
          setPeers(Array.from(map.values()));
        })
        .subscribe(async (s) => {
          if (s === "SUBSCRIBED" && channel) {
            await channel.track(self);
            if (!cancelled) setStatus("joined");
          }
        });
    } catch {
      setStatus("error");
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
    };
  }, [auth, room, enabled]);

  const others = useMemo(
    () => peers.filter((p) => p.user_id !== auth?.profile.id),
    [peers, auth?.profile.id]
  );

  return {
    peers,
    others,
    count: peers.length,
    status,
    isJoined: status === "joined",
  };
}
