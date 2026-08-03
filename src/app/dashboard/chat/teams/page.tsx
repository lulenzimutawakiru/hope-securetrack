"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Hash, Lock, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";

export default function SecureChatTeamsPage() {
  const [channels, setChannels] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await createClient()
          .from("hc_channels")
          .select("*")
          .in("channel_type", ["channel", "private", "department", "project", "announcement"])
          .is("deleted_at", null)
          .order("name");
        setChannels((data as Array<Record<string, unknown>>) || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading teams…" />;

  const groups = channels.reduce<Record<string, Array<Record<string, unknown>>>>((acc, c) => {
    const k = String(c.channel_type || "channel");
    if (!acc[k]) acc[k] = [];
    acc[k].push(c);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Teams & Channels"
        description="Public · private · department · project · company-wide"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/chat"><ArrowLeft className="h-4 w-4 mr-1" /> Back to chat</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([type, list]) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {type}
                <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {list.map((c) => (
                <Link
                  key={String(c.id)}
                  href="/dashboard/chat"
                  className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  {c.is_private ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                  <span className="truncate flex-1">{String(c.name)}</span>
                  <span className="text-[10px] text-muted-foreground">{String(c.message_count || 0)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
