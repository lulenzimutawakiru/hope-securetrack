/**
 * Flush offline mutation queue when back online.
 */

import { createClient } from "@/lib/supabase/client";
import {
  queueDelete,
  queueGetAll,
  queueUpdate,
  type OfflineJob,
} from "./db";

export type SyncResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

export async function enqueueOfflineMutation(
  job: Omit<OfflineJob, "id" | "createdAt" | "status" | "attempts"> & {
    id?: string;
  }
): Promise<OfflineJob> {
  const { newJobId, queuePut } = await import("./db");
  const full: OfflineJob = {
    id: job.id || newJobId(),
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
    table: job.table,
    action: job.action,
    payload: job.payload,
    match: job.match,
    label: job.label,
  };
  await queuePut(full);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hope:offline-queue-changed"));
  }
  return full;
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return result;
  }

  const pending = [
    ...(await queueGetAll("pending")),
    ...(await queueGetAll("failed")),
  ].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (!pending.length) return result;

  const supabase = createClient();

  for (const job of pending) {
    result.processed += 1;
    await queueUpdate(job.id, {
      status: "syncing",
      attempts: job.attempts + 1,
    });

    try {
      let error;
      if (job.action === "insert") {
        ({ error } = await supabase.from(job.table).insert(job.payload));
      } else if (job.action === "update") {
        let q = supabase.from(job.table).update(job.payload);
        if (job.match) q = q.eq(job.match.column, job.match.value);
        ({ error } = await q);
      } else if (job.action === "delete") {
        let q = supabase.from(job.table).delete();
        if (job.match) q = q.eq(job.match.column, job.match.value);
        ({ error } = await q);
      }

      if (error) throw new Error(error.message);

      await queueDelete(job.id);
      result.succeeded += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      await queueUpdate(job.id, { status: "failed", lastError: msg });
      result.failed += 1;
      result.errors.push(`${job.label || job.id}: ${msg}`);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hope:offline-queue-changed"));
    window.dispatchEvent(
      new CustomEvent("hope:offline-sync-done", { detail: result })
    );
  }

  return result;
}
