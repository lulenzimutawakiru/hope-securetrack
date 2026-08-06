"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function QueuePage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("intg_queue_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const requeue = async (id: string) => {
    await crudUpdate("intg_queue_messages", id, { status: "queued", attempts: 0, error_message: null, available_at: new Date().toISOString() });
    toast.success("Re-queued");
    await load();
  };

  const processNext = async () => {
    const supabase = createClient();
    const { data: msg } = await supabase
      .from("intg_queue_messages")
      .select("*")
      .eq("status", "queued")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!msg) {
      toast.message("Queue empty");
      return;
    }
    await crudUpdate("intg_queue_messages", msg.id, {
        status: "done",
        attempts: (msg.attempts || 0) + 1,
        locked_at: new Date().toISOString(),
      });
    toast.success(`Processed ${msg.message_type}`);
    await load();
  };

  if (loading) return <LoadingState message="Loading message queue…" />;

  const queued = rows.filter((r) => r.status === "queued").length;
  const failed = rows.filter((r) => r.status === "failed" || r.status === "dead_letter").length;
  const done = rows.filter((r) => r.status === "done").length;

  return (
    <div>
      <PageHeader
        title="Message Queue"
        description="Async processing · retries · dead-letter · multi-queue"
        actions={
          <Button size="sm" onClick={processNext}>
            <RefreshCw className="h-4 w-4 mr-1" /> Process next
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Queued" value={String(queued)} icon={Activity} />
        <StatCard title="Done" value={String(done)} icon={Activity} />
        <StatCard title="Failed / DLQ" value={String(failed)} icon={Activity} />
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="text-xs font-mono">{String(r.queue_name)}</TableCell>
                <TableCell className="text-xs">{String(r.message_type)}</TableCell>
                <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                <TableCell className="text-xs">{String(r.attempts)}/{String(r.max_attempts)}</TableCell>
                <TableCell className="text-xs">{new Date(String(r.created_at)).toLocaleString()}</TableCell>
                <TableCell>
                  {(r.status === "failed" || r.status === "dead_letter") && (
                    <Button size="sm" variant="outline" onClick={() => requeue(String(r.id))}>Retry</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
