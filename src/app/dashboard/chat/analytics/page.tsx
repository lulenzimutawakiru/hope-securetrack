"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, MessageSquare, Users, Video, Paperclip, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";

export default function SecureChatAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    messages: 0,
    channels: 0,
    meetings: 0,
    files: 0,
    announcements: 0,
    tasks: 0,
    bots: 0,
    knowledge: 0,
  });
  const [byChannel, setByChannel] = useState<Array<{ name: string; count: number }>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: messages },
        { count: channels },
        { count: meetings },
        { count: files },
        { count: announcements },
        { count: tasks },
        { count: bots },
        { count: knowledge },
        { data: ch },
      ] = await Promise.all([
        sb.from("hc_messages").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("hc_channels").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("hc_meetings").select("*", { count: "exact", head: true }),
        sb.from("hc_files").select("*", { count: "exact", head: true }),
        sb.from("hc_announcements").select("*", { count: "exact", head: true }),
        sb.from("hc_chat_tasks").select("*", { count: "exact", head: true }),
        sb.from("hc_bots").select("*", { count: "exact", head: true }).eq("is_active", true),
        sb.from("hc_knowledge").select("*", { count: "exact", head: true }),
        sb.from("hc_channels").select("name, message_count").is("deleted_at", null).order("message_count", { ascending: false }).limit(8),
      ]);
      setStats({
        messages: messages ?? 0,
        channels: channels ?? 0,
        meetings: meetings ?? 0,
        files: files ?? 0,
        announcements: announcements ?? 0,
        tasks: tasks ?? 0,
        bots: bots ?? 0,
        knowledge: knowledge ?? 0,
      });
      setByChannel(
        (ch || []).map((c) => ({
          name: String(c.name),
          count: Number(c.message_count || 0),
        }))
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading SecureChat analytics…" />;

  const max = Math.max(1, ...byChannel.map((c) => c.count));

  return (
    <div>
      <PageHeader
        title="SecureChat Analytics"
        description="DAU proxy · messages · meetings · files · engagement · AI usage"
        actions={
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Messages" value={String(stats.messages)} icon={MessageSquare} />
        <StatCard title="Channels" value={String(stats.channels)} icon={Users} />
        <StatCard title="Meetings" value={String(stats.meetings)} icon={Video} />
        <StatCard title="Files" value={String(stats.files)} icon={Paperclip} />
        <StatCard title="Announcements" value={String(stats.announcements)} icon={Megaphone} />
        <StatCard title="Chat tasks" value={String(stats.tasks)} icon={BarChart3} />
        <StatCard title="Active bots" value={String(stats.bots)} icon={Users} />
        <StatCard title="Knowledge articles" value={String(stats.knowledge)} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Messages by channel</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {byChannel.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <span className="w-28 truncate">#{c.name}</span>
              <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary/70" style={{ width: `${(c.count / max) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-xs">{c.count}</span>
            </div>
          ))}
          {byChannel.length === 0 && (
            <p className="text-sm text-muted-foreground">No channel activity yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
