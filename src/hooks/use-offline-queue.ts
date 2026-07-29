"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { queueCountPending, queueGetAll, type OfflineJob } from "@/lib/offline/db";
import { enqueueOfflineMutation, syncOfflineQueue } from "@/lib/offline/sync";
import { toast } from "sonner";

export function useOfflineQueue() {
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [jobs, setJobs] = useState<OfflineJob[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const count = await queueCountPending();
      setPending(count);
      const all = await queueGetAll();
      setJobs(all.filter((j) => j.status !== "done"));
    } catch {
      setPending(0);
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("hope:offline-queue-changed", onChange);
    return () => window.removeEventListener("hope:offline-queue-changed", onChange);
  }, [refresh]);

  // Auto-sync when coming online
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      const count = await queueCountPending();
      if (!count || cancelled) return;
      setSyncing(true);
      const res = await syncOfflineQueue();
      setSyncing(false);
      if (res.succeeded > 0) {
        toast.success(`Synced ${res.succeeded} offline change(s)`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} offline change(s) failed`);
      }
      refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [online, refresh]);

  const enqueue = useCallback(
    async (
      job: Parameters<typeof enqueueOfflineMutation>[0]
    ) => {
      const full = await enqueueOfflineMutation(job);
      toast.message("Saved offline", {
        description: job.label || "Will sync when connection returns",
      });
      await refresh();
      return full;
    },
    [refresh]
  );

  const syncNow = useCallback(async () => {
    if (!online) {
      toast.error("Still offline");
      return;
    }
    setSyncing(true);
    const res = await syncOfflineQueue();
    setSyncing(false);
    await refresh();
    return res;
  }, [online, refresh]);

  return {
    online,
    pending,
    jobs,
    syncing,
    enqueue,
    syncNow,
    refresh,
  };
}
