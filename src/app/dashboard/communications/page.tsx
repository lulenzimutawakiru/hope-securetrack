"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Mail, Bell, Send, AlertTriangle, FileText, Workflow, ArrowRight, Sparkles,
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

export default function CommunicationsHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({
    messages: 0, sent: 0, failed: 0, queued: 0, templates: 0, rules: 0, campaigns: 0, pendingReminders: 0,
  });
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
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
    return COMM_MENU.filter((m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s));
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof COMM_MENU[number][]>();
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
        description="Branded email · multi-channel · event rules · PDF delivery · full audit trail"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/notifications"><Bell className="h-4 w-4 mr-1" /> Inbox</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/communications/compose"><Send className="h-4 w-4 mr-1" /> Compose</Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-4 mb-6 text-sm">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide">Event-driven communications</p>
        <p className="text-white/70 text-xs mt-1">
          Every ERP module publishes events → rules select recipients → branded documents attach → multi-channel delivery → audit log
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Messages" value={String(stats.messages)} icon={Mail} />
        <StatCard title="Sent" value={String(stats.sent)} icon={Send} />
        <StatCard title="Failed / retry" value={String(stats.failed)} icon={AlertTriangle} />
        <StatCard title="Queued" value={String(stats.queued)} icon={Workflow} />
        <StatCard title="Templates" value={String(stats.templates)} icon={FileText} />
        <StatCard title="Event rules" value={String(stats.rules)} icon={Workflow} />
        <StatCard title="Campaigns" value={String(stats.campaigns)} icon={Sparkles} />
        <StatCard title="Reminders" value={String(stats.pendingReminders)} icon={Bell} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent messages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet. Compose or fire an ERP event.</p>
            ) : recent.map((m) => (
              <div key={m.id as string} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-muted-foreground">{String(m.message_number)}</p>
                  <p className="font-medium truncate">{String(m.subject || "(no subject)")}</p>
                  <p className="text-[11px] text-muted-foreground">{String(m.channel)} · {formatDate(String(m.created_at))}</p>
                </div>
                <Badge variant="outline">{String(m.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["/dashboard/communications/compose", "Compose message"],
              ["/dashboard/communications/rules", "Event rules"],
              ["/dashboard/communications/templates", "Templates"],
              ["/dashboard/communications/retry", "Retry queue"],
              ["/dashboard/communications/ai", "AI draft assistant"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded border px-2 py-1.5 hover:bg-muted/40">
                {label}<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Input className="max-w-md mb-4" placeholder="Search communication modules…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link key={m.href} href={m.href}>
                  <Card className="h-full hover:border-hope-navy/40 transition-colors">
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
