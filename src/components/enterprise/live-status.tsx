"use client";

import { usePresence } from "@/hooks/use-presence";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Users, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LiveStatus() {
  const online = useOnlineStatus();
  const { count, others, isJoined } = usePresence("hope-erp-global", true);
  const { pending, syncing, syncNow } = useOfflineQueue();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 sm:gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium",
                online
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40"
              )}
            >
              {online ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{online ? "Live" : "Offline"}</span>
              {online && isJoined && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {online
              ? "Connected · Realtime & presence active"
              : "Offline · changes queue in IndexedDB"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden md:flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {count}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">{count} online</p>
            {others.length === 0 ? (
              <p className="text-xs text-muted-foreground">Only you</p>
            ) : (
              <ul className="text-xs space-y-0.5">
                {others.slice(0, 8).map((p) => (
                  <li key={p.user_id}>
                    {p.name}
                    {p.role ? ` · ${p.role}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>

        {pending > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1"
                onClick={() => syncNow()}
                disabled={!online || syncing}
              >
                <CloudUpload className="h-3 w-3" />
                {syncing ? "Sync…" : pending}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {pending} offline job(s) — click to sync
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
