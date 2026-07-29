"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Archive,
  Settings2,
  Send,
  Workflow,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Notif = Record<string, unknown>;

const CATEGORIES = [
  "all",
  "system",
  "security",
  "finance",
  "hr",
  "production",
  "inventory",
  "procurement",
  "sales",
  "workflow",
  "report",
];

export default function NotificationCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "80" });
      if (unreadOnly) params.set("unread", "1");
      if (filter !== "all") params.set("category", filter);
      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [filter, unreadOnly]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const markRead = async (ids?: string[]) => {
    const res = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Failed");
      return;
    }
    toast.success(ids ? "Marked read" : "All marked read");
    load();
  };

  const openNotif = async (n: Notif) => {
    if (!n.is_read) await markRead([String(n.id)]);
    const href = String(n.action_url || n.link || "");
    if (href) router.push(href);
  };

  const filtered = useMemo(() => items, [items]);

  if (loading) return <LoadingState message="Loading notification center…" />;

  return (
    <div>
      <PageHeader
        title="Notification Center"
        description="In-app inbox · multi-channel delivery · security · workflows · operations"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => markRead()} disabled={!unread}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/notifications/preferences">
                <Settings2 className="h-4 w-4 mr-1" />
                Preferences
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/notifications/rules">
                <Workflow className="h-4 w-4 mr-1" />
                Rules
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/notifications/compose">
                <Send className="h-4 w-4 mr-1" />
                Compose
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">
          {unread} unread
        </Badge>
        <Button
          size="sm"
          variant={unreadOnly ? "default" : "outline"}
          onClick={() => setUnreadOnly((v) => !v)}
        >
          <Filter className="h-3.5 w-3.5 mr-1" />
          Unread only
        </Button>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={filter === c ? "default" : "ghost"}
              className="capitalize h-8"
              onClick={() => setFilter(c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Alerts from security, finance, HR, and operations appear here"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const priority = String(n.priority || "normal");
            const type = String(n.type || "info");
            return (
              <Card
                key={String(n.id)}
                className={cn(
                  "cursor-pointer transition-colors hover:border-hope-teal",
                  !n.is_read && "border-l-4 border-l-hope-teal bg-muted/20"
                )}
                onClick={() => openNotif(n)}
              >
                <CardContent className="py-3 flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{String(n.title)}</p>
                      {!n.is_read && (
                        <Badge className="bg-hope-teal/15 text-hope-teal text-[10px]">
                          New
                        </Badge>
                      )}
                      {(priority === "urgent" || priority === "high") && (
                        <Badge variant="destructive" className="text-[10px]">
                          {priority}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {String(n.category || "system")}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {type}
                      </Badge>
                    </div>
                    {n.message ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {String(n.message)}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {n.created_at
                        ? new Date(String(n.created_at)).toLocaleString()
                        : ""}
                      {n.source_event ? ` · ${String(n.source_event)}` : ""}
                      {Array.isArray(n.channels)
                        ? ` · ${(n.channels as string[]).join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!n.is_read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead([String(n.id)]);
                        }}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {Boolean(n.action_url || n.link) && (
                      <Button size="sm" variant="outline">
                        {String(n.action_label || "Open")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1">
        <Archive className="h-3 w-3" />
        Email delivery via Resend · SMS/WhatsApp queued · quiet hours & digests in Preferences
      </p>
    </div>
  );
}
