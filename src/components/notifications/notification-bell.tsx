"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  message?: string | null;
  type?: string;
  category?: string;
  priority?: string;
  is_read?: boolean;
  link?: string | null;
  action_url?: string | null;
  created_at?: string;
};

export function NotificationBell() {
  const router = useRouter();
  const { auth } = useUser();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=8");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Live inbox via Supabase Realtime
  useRealtimeTable({
    table: "notifications",
    event: "INSERT",
    filter: auth?.profile.id ? `user_id=eq.${auth.profile.id}` : undefined,
    enabled: Boolean(auth?.profile.id),
    onChange: (payload) => {
      load();
      const row = payload.new as Notif | null;
      if (row?.title) {
        toast.message(String(row.title), {
          description: row.message ? String(row.message).slice(0, 120) : "New notification",
        });
      }
    },
  });

  const markRead = async (ids?: string[]) => {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
      load();
    } catch {
      /* silent */
    }
  };

  const openItem = async (n: Notif) => {
    if (!n.is_read) await markRead([n.id]);
    const href = n.action_url || n.link;
    setOpen(false);
    if (href) router.push(href);
    else router.push("/dashboard/notifications");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-hope-teal hover:underline"
              onClick={(e) => {
                e.preventDefault();
                markRead();
              }}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn(
                "flex flex-col items-start gap-0.5 py-2 cursor-pointer",
                !n.is_read && "bg-muted/50"
              )}
              onClick={() => openItem(n)}
            >
              <div className="flex w-full items-center gap-2">
                <span className="text-sm font-medium line-clamp-1 flex-1">
                  {n.title}
                </span>
                {n.priority === "urgent" || n.priority === "high" ? (
                  <Badge variant="destructive" className="text-[9px] h-4">
                    {n.priority}
                  </Badge>
                ) : null}
              </div>
              {n.message && (
                <span className="text-xs text-muted-foreground line-clamp-2 w-full">
                  {n.message}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {n.created_at
                  ? new Date(n.created_at).toLocaleString()
                  : ""}
                {n.category ? ` · ${n.category}` : ""}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-hope-teal"
          onClick={() => {
            setOpen(false);
            router.push("/dashboard/notifications");
          }}
        >
          Open notification center
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
