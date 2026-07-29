"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { pending, syncNow, syncing } = useOfflineQueue();

  if (online && pending === 0) return null;

  if (!online) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-950 dark:text-amber-100 flex flex-wrap items-center justify-center gap-2">
        <WifiOff className="h-3.5 w-3.5" />
        <span>
          You are offline. Reads may use cache; writes can be queued and synced later.
        </span>
        {pending > 0 && (
          <span className="font-medium">{pending} change(s) queued</span>
        )}
      </div>
    );
  }

  // Online but pending queue
  return (
    <div className="bg-sky-500/10 border-b border-sky-500/20 px-3 py-1.5 text-xs flex flex-wrap items-center justify-center gap-2">
      <span>{pending} offline change(s) ready to sync</span>
      <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={() => syncNow()} disabled={syncing}>
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}
