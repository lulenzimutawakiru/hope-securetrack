"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Radio,
  Factory,
  AlertTriangle,
  ShieldCheck,
  Warehouse,
  Users,
  CloudOff,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiMetric } from "@/components/enterprise/kpi-metric";
import { LoadingState } from "@/components/ui/loading-state";
import { useRealtimeTables } from "@/hooks/use-realtime";
import { usePresence } from "@/hooks/use-presence";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { enqueueOfflineMutation } from "@/lib/offline/sync";
import { toast } from "sonner";

type FeedItem = {
  id: string;
  table: string;
  event: string;
  summary: string;
  at: number;
};

const LIVE_TABLES = [
  "production_batches",
  "fraud_alerts",
  "verification_logs",
  "notifications",
  "stock_balances",
  "print_jobs",
];

export default function LiveOpsPage() {
  const online = useOnlineStatus();
  const { peers, count, isJoined } = usePresence("hope-erp-global");
  const { pending, syncNow, syncing, jobs } = useOfflineQueue();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    batches: 0,
    fraud: 0,
    verify: 0,
    reams: 0,
  });
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const loadStats = useCallback(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const [b, f, v, r] = await Promise.all([
      supabase
        .from("production_batches")
        .select("*", { count: "exact", head: true })
        .in("production_status", ["in_progress", "qc_pending"]),
      supabase
        .from("fraud_alerts")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "investigating"]),
      supabase
        .from("verification_logs")
        .select("*", { count: "exact", head: true })
        .gte("verified_at", `${today}T00:00:00`),
      supabase
        .from("reams")
        .select("*", { count: "exact", head: true })
        .eq("inventory_status", "in_warehouse"),
    ]);
    setStats({
      batches: b.count ?? 0,
      fraud: f.count ?? 0,
      verify: v.count ?? 0,
      reams: r.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const { tick, liveCount } = useRealtimeTables(
    LIVE_TABLES,
    (table, payload) => {
      const event = String(payload.eventType || "CHANGE");
      const row = (payload.new || payload.old || {}) as Record<string, unknown>;
      const summary =
        (row.batch_number as string) ||
        (row.title as string) ||
        (row.public_uuid as string)?.slice?.(0, 8) ||
        (row.id as string)?.slice?.(0, 8) ||
        event;
      setFeed((prev) =>
        [
          {
            id: `${table}-${Date.now()}-${Math.random()}`,
            table,
            event,
            summary: String(summary),
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 40)
      );
      // light refresh of counters on activity
      if (["production_batches", "fraud_alerts", "verification_logs", "reams"].includes(table)) {
        loadStats();
      }
    },
    online
  );

  const queueDemoNote = async () => {
    await enqueueOfflineMutation({
      table: "system_settings",
      action: "update",
      payload: {
        value: JSON.stringify({ note: "offline demo", at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      },
      match: { column: "key", value: "offline.demo_note" },
      label: "Offline demo note",
    });
    toast.message("Queued offline mutation (demo)");
  };

  if (loading) return <LoadingState message="Connecting live ops…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Operations"
        description="Realtime feeds · presence · offline queue — Phase D"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/boards">Boards</Link>
            </Button>
            {!online && (
              <Button size="sm" variant="secondary" onClick={queueDemoNote}>
                <CloudOff className="h-3.5 w-3.5 mr-1" />
                Queue demo write
              </Button>
            )}
            {pending > 0 && (
              <Button size="sm" onClick={() => syncNow()} disabled={!online || syncing}>
                Sync {pending}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge
          className={
            online
              ? "bg-green-100 text-green-800"
              : "bg-amber-100 text-amber-900"
          }
        >
          {online ? "Network online" : "Network offline"}
        </Badge>
        <Badge variant="outline">
          <Radio className="h-3 w-3 mr-1" />
          {liveCount}/{LIVE_TABLES.length} channels
        </Badge>
        <Badge variant="outline">
          <Users className="h-3 w-3 mr-1" />
          {count} present{isJoined ? "" : " (joining…)"}
        </Badge>
        <Badge variant="secondary">Events: {tick}</Badge>
        {pending > 0 && (
          <Badge variant="destructive">{pending} queued</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiMetric
          title="Batches WIP"
          value={formatNumber(stats.batches)}
          icon={Factory}
          tone="info"
        />
        <KpiMetric
          title="Open fraud"
          value={formatNumber(stats.fraud)}
          icon={AlertTriangle}
          tone={stats.fraud ? "danger" : "success"}
        />
        <KpiMetric
          title="Verifications today"
          value={formatNumber(stats.verify)}
          icon={ShieldCheck}
          tone="success"
        />
        <KpiMetric
          title="Warehouse reams"
          value={formatNumber(stats.reams)}
          icon={Warehouse}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Realtime event feed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Waiting for Postgres changes…
                <br />
                <span className="text-xs">
                  Create a batch, verification, or notification to see live events.
                </span>
              </p>
            ) : (
              feed.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-2 rounded-lg border p-2 text-sm"
                >
                  <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                    {f.table}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {f.event} · {f.summary}
                    </p>
                    <p className="text-caption">
                      {new Date(f.at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              Presence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
            {peers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No presence data yet</p>
            ) : (
              peers.map((p) => (
                <div
                  key={p.user_id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-caption">{p.role || p.email}</p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                </div>
              ))
            )}
          </CardContent>

          <CardHeader className="pb-2 pt-0">
            <CardTitle className="text-base">Offline queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[140px] overflow-y-auto">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Queue empty</p>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="rounded-lg border p-2 text-xs">
                  <p className="font-medium">{j.label || j.id}</p>
                  <p className="text-muted-foreground">
                    {j.action} {j.table} · {j.status}
                    {j.lastError ? ` · ${j.lastError}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
