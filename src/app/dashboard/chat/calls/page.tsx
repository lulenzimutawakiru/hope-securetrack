"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone, Video, PhoneCall, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

type MeetingRow = {
  id: string;
  meeting_code?: string;
  title?: string;
  status?: string;
  host_name?: string;
  scheduled_start?: string;
  started_at?: string;
  ended_at?: string;
  join_url?: string;
};

/**
 * Voice/video call hub backed by SecureChat meetings.
 * Media mesh is launched from Meetings; this page lists live/history records.
 */
export default function SecureChatCallsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MeetingRow[]>([]);

  const load = async () => {
    const companyId = auth?.profile?.company_id;
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from("hc_meetings")
        .select(
          "id,meeting_code,title,status,host_name,scheduled_start,started_at,ended_at,join_url"
        )
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows((data as MeetingRow[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load call history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [auth?.profile?.company_id]);

  if (loading) return <LoadingState message="Loading calls & meetings…" />;

  const live = rows.filter((r) => r.status === "live" || r.status === "in_progress");
  const recent = rows.filter((r) => r.status !== "live" && r.status !== "in_progress");

  return (
    <div>
      <PageHeader
        title="Voice & Video Calls"
        description="Call history and live rooms from SecureChat meetings · start media from Meetings"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); void load(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/chat">Chat</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/chat/meetings">
                <Video className="h-4 w-4 mr-1" /> Start / schedule
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4" /> Instant audio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Open a meeting room and enable audio-only mode for 1:1 or group voice.</p>
            <Badge variant="outline">Meetings</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" /> Video conference
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>HD video rooms with waiting room, agenda, and participant roster.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/chat/meetings">Open rooms</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PhoneCall className="h-4 w-4" /> Live now
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{live.length}</CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-semibold mb-2">Live sessions</h3>
      {live.length === 0 ? (
        <EmptyState
          title="No live calls"
          description="Start a meeting from SecureChat Meetings when you need voice or video."
        />
      ) : (
        <div className="rounded-md border mb-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.meeting_code || "—"}</TableCell>
                  <TableCell>{r.title || "Untitled"}</TableCell>
                  <TableCell>{r.host_name || "—"}</TableCell>
                  <TableCell>
                    <Badge>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/chat/meetings">Join</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2 mt-6">Recent history</h3>
      {recent.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Meeting and call history will appear here after sessions are scheduled or completed
            in <strong>Meetings</strong>.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.meeting_code || "—"}</TableCell>
                  <TableCell>{r.title || "Untitled"}</TableCell>
                  <TableCell>{r.host_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.scheduled_start
                      ? new Date(r.scheduled_start).toLocaleString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
