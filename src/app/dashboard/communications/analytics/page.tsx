"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Mail, AlertTriangle, Send, Workflow } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getCommStats, listMessages } from "@/lib/communications";
import { createClient } from "@/lib/supabase/client";

export default function CommAnalyticsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getCommStats>> | null>(null);
  const [byChannel, setByChannel] = useState<Array<{ channel: string; count: number }>>([]);
  const [recentFailed, setRecentFailed] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const cid = auth?.profile?.company_id;
      if (!cid) {
        setLoading(false);
        return;
      }
      try {
        const sb = createClient();
        const [s, msgs, { data: all }] = await Promise.all([
          getCommStats(cid),
          listMessages({ companyId: cid, status: "failed", limit: 10 }),
          sb
            .from("comm_messages")
            .select("channel")
            .eq("company_id", cid)
            .is("deleted_at", null)
            .limit(500),
        ]);
        setStats(s);
        setRecentFailed(msgs as Array<Record<string, unknown>>);

        const map = new Map<string, number>();
        for (const r of all || []) {
          const ch = String((r as { channel?: string }).channel || "unknown");
          map.set(ch, (map.get(ch) || 0) + 1);
        }
        setByChannel(
          Array.from(map.entries())
            .map(([channel, count]) => ({ channel, count }))
            .sort((a, b) => b.count - a.count)
        );
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [auth]);

  if (loading) return <LoadingState message="Loading communication analytics…" />;

  return (
    <div>
      <PageHeader
        title="Communication analytics"
        description="Volume, channel mix, failures and automation health"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/communications/live">Live board</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total messages" value={String(stats?.messages ?? 0)} icon={Mail} />
        <StatCard title="Sent" value={String(stats?.sent ?? 0)} icon={Send} />
        <StatCard title="Failed" value={String(stats?.failed ?? 0)} icon={AlertTriangle} />
        <StatCard title="Active rules" value={String(stats?.rules ?? 0)} icon={Workflow} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Channel mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byChannel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel data yet.</p>
            ) : (
              byChannel.map((c) => {
                const max = byChannel[0]?.count || 1;
                const pct = Math.round((c.count / max) * 100);
                return (
                  <div key={c.channel}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium capitalize">{c.channel}</span>
                      <span className="text-muted-foreground">{c.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent failures</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/communications/retry">Retry queue</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentFailed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed messages.</p>
            ) : (
              recentFailed.map((m) => (
                <Link
                  key={String(m.id)}
                  href={`/dashboard/communications/messages/${m.id}`}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {String(m.message_number)}
                    </p>
                    <p className="truncate font-medium">{String(m.subject || "—")}</p>
                  </div>
                  <Badge variant="destructive">{String(m.channel)}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
