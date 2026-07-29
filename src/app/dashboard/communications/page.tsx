"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Mail, Bell, Send, AlertTriangle, FileText, Workflow, ArrowRight, Sparkles,
  MessageSquare, Smartphone, Radio, Activity, BarChart3, ListOrdered, Megaphone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getCommStats, listMessages, COMM_MENU } from "@/lib/communications";
import { formatDate } from "@/lib/utils";

const CHANNEL_DRILL = [
  { title: "Email", href: "/dashboard/communications/email", icon: Mail, desc: "Branded outbox" },
  { title: "SMS", href: "/dashboard/communications/sms", icon: MessageSquare, desc: "Text delivery" },
  { title: "WhatsApp", href: "/dashboard/communications/whatsapp", icon: Smartphone, desc: "Chat channel" },
  { title: "Push", href: "/dashboard/communications/push", icon: Radio, desc: "Device push" },
  { title: "In-app", href: "/dashboard/communications/in-app", icon: Bell, desc: "Inbox fan-out" },
  { title: "All messages", href: "/dashboard/communications/messages", icon: ListOrdered, desc: "Unified list" },
];

export default function CommunicationsHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({
    messages: 0, sent: 0, failed: 0, queued: 0, templates: 0, rules: 0, campaigns: 0, pendingReminders: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) {
      setLoading(false);
      return;
    }
    const cid = auth.profile.company_id;
    Promise.all([getCommStats(cid), listMessages({ companyId: cid, limit: 8 })])
      .then(([s, m]) => {
        setStats(s);
        setRecent(m as Array<Record<string, unknown>>);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return COMM_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof COMM_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Communication Center…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Communication Center"
        description="Drill down by channel · message · delivery event · rule · campaign"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/communications/live">
                <Activity className="h-4 w-4 mr-1" /> Live
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/communications/analytics">
                <BarChart3 className="h-4 w-4 mr-1" /> Analytics
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/notifications">
                <Bell className="h-4 w-4 mr-1" /> Inbox
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/communications/compose">
                <Send className="h-4 w-4 mr-1" /> Compose
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-gradient-to-r from-[#0B1F3A] to-[#0d2847] text-white p-4 mb-6">
        <p className="text-[#C9A227] text-[11px] font-semibold uppercase tracking-wider">
          Event-driven communications
        </p>
        <p className="text-white/70 text-sm mt-1 max-w-3xl">
          ERP event → matching rules → branded template → multi-channel delivery → delivery timeline → audit.
          Open any message number to drill into body, attachments, and events.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Messages" value={String(stats.messages)} icon={Mail} />
        <StatCard title="Sent" value={String(stats.sent)} icon={Send} />
        <StatCard title="Failed / retry" value={String(stats.failed)} icon={AlertTriangle} />
        <StatCard title="Queued" value={String(stats.queued)} icon={Workflow} />
        <StatCard title="Templates" value={String(stats.templates)} icon={FileText} />
        <StatCard title="Event rules" value={String(stats.rules)} icon={Workflow} />
        <StatCard title="Campaigns" value={String(stats.campaigns)} icon={Megaphone} />
        <StatCard title="Reminders" value={String(stats.pendingReminders)} icon={Bell} />
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Channel drill-down
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {CHANNEL_DRILL.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="h-full hover:border-primary/40 transition-colors">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <c.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent messages</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/communications/messages">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Compose or fire an ERP event.
              </p>
            ) : (
              recent.map((m) => (
                <Link
                  key={m.id as string}
                  href={`/dashboard/communications/messages/${m.id}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {String(m.message_number)}
                    </p>
                    <p className="font-medium truncate">{String(m.subject || "(no subject)")}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {String(m.channel)} · {formatDate(String(m.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{String(m.status)}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick drill paths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["/dashboard/communications/compose", "Compose message"],
              ["/dashboard/communications/messages", "All messages"],
              ["/dashboard/communications/rules", "Event rules"],
              ["/dashboard/communications/templates", "Templates"],
              ["/dashboard/communications/retry", "Retry queue"],
              ["/dashboard/communications/live", "Live board"],
              ["/dashboard/communications/ai", "AI draft assistant"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded border px-2 py-1.5 hover:bg-muted/40"
              >
                {label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Input
        className="max-w-md mb-4"
        placeholder="Filter communication modules…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {group}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link key={m.href + m.title} href={m.href}>
                  <Card className="h-full hover:border-primary/40 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
