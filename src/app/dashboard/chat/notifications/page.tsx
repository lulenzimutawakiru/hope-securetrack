"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, CheckCheck, Archive, Loader2, Inbox, CheckSquare, Users, Wallet,
  HeartPulse, Package, FolderKanban, ShieldAlert, Briefcase, CreditCard,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "chat", label: "Chat" },
  { value: "approval", label: "Approvals" },
  { value: "hr", label: "HR" },
  { value: "finance", label: "Finance" },
  { value: "payroll", label: "Payroll" },
  { value: "procurement", label: "Procurement" },
  { value: "service_desk", label: "Service Desk" },
  { value: "assets", label: "Assets" },
  { value: "projects", label: "Projects" },
  { value: "security", label: "Security" },
  { value: "system", label: "System" },
] as const;

const CATEGORY_ICON: Record<string, typeof Bell> = {
  chat: Users,
  approval: CheckSquare,
  hr: HeartPulse,
  finance: Wallet,
  payroll: CreditCard,
  procurement: Briefcase,
  service_desk: Bell,
  assets: Package,
  projects: FolderKanban,
  security: ShieldAlert,
  system: Bell,
};

const PRIORITY_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  normal: "secondary",
  low: "outline",
  high: "warning",
  urgent: "destructive",
  critical: "destructive",
};

export default function ChatNotificationsPage() {
  const { auth } = useUser();
  const [notifications, setNotifications] = useState<Array<Record<string, unknown>>>([]);
  const [category, setCategory] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.user?.id as string | undefined;

  const load = async () => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let q = supabase
      .from("notifications")
      .select("*")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .eq("is_archived", false);
    if (category !== "all") q = q.eq("category", category);
    if (unreadOnly) q = q.eq("is_read", false);
    const { data } = await q.order("created_at", { ascending: false }).limit(200);
    setNotifications((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [companyId, userId, category, unreadOnly]);

  const update = async (id: string, patch: Record<string, unknown>) => {
    await createClient().from("notifications").update(patch).eq("id", id);
  };

  const markRead = async (id: string) => {
    setBusy(true);
    try {
      await update(id, { is_read: true, read_at: new Date().toISOString() });
      await load();
    } catch {
      toast.error("Failed to update notification");
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      await createClient()
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_archived", false);
      await load();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to update notifications");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    setBusy(true);
    try {
      await update(id, { is_archived: true, archived_at: new Date().toISOString() });
      await load();
    } catch {
      toast.error("Failed to archive notification");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading notifications..." />;

  const unreadCount = notifications.filter((n) => !Boolean(n.is_read)).length;

  return (
    <div>
      <PageHeader
        title="Notifications Center"
        description="Unified enterprise notifications - approvals, workflows, payroll, security and chat"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-1" />
            )}
            Mark all read
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              category === c.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={cn(
            "ml-auto rounded-full px-3 py-1 text-xs font-medium transition-colors",
            unreadOnly
              ? "bg-warning text-warning-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >
          {unreadOnly ? `Unread only (${unreadCount})` : "All notifications"}
        </button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          description="No notifications in this view. New messages, approvals and system alerts will appear here."
        />
      ) : (
        <Card>
          <CardContent className="grid gap-1 p-2">
            {notifications.map((n) => {
              const cat = String(n.category || "system");
              const Icon = CATEGORY_ICON[cat] || Bell;
              const isRead = Boolean(n.is_read);
              const link = n.link ? String(n.link) : null;
              const main = (
                <>
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isRead ? "bg-muted" : "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      <p className="truncate text-sm font-medium">{String(n.title || "")}</p>
                      <Badge variant={PRIORITY_VARIANT[String(n.priority || "normal")] || "secondary"}>
                        {String(n.priority || "normal")}
                      </Badge>
                    </div>
                    {Boolean(n.message) && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {String(n.message)}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {cat} - {formatDateTime(String(n.created_at || ""))}
                    </p>
                  </div>
                </>
              );
              return (
                <div
                  key={String(n.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/40",
                    !isRead && "border-primary/30 bg-primary/5"
                  )}
                >
                  {link ? (
                    <Link href={link} className="flex min-w-0 flex-1 items-start gap-3">
                      {main}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3">{main}</div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {Boolean(n.action_label) && link && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={link}>
                          {String(n.action_label)} <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                    {!isRead && (
                      <Button size="icon" variant="ghost" title="Mark read" onClick={() => markRead(String(n.id))}>
                        <CheckCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Archive" onClick={() => archive(String(n.id))}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}