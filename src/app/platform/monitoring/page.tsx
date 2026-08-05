"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Server, Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";

export default function PlatformMonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/platform/command-center")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading monitoring…" />;

  const j = data?.jobs;
  const h = data?.health;
  const e = data?.estate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring & operations"
        description="Infrastructure signals, queues, errors, and system uptime indicators"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/jobs">Job queue</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">DB latency</p>
            <p className="text-2xl font-semibold">
              {h?.database_latency_ms != null
                ? `${h.database_latency_ms}ms`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Queue pending</p>
            <p className="text-2xl font-semibold">{j?.pending ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Failed jobs</p>
            <p className="text-2xl font-semibold text-destructive">
              {j?.failed ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Events (24h)</p>
            <p className="text-2xl font-semibold">{e?.events_24h ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" /> Queue breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Pending" value={j?.pending} />
            <Row label="Running" value={j?.running} />
            <Row label="Failed" value={j?.failed} />
            <Row label="Dead letter" value={j?.dead} />
            <Row label="Open provision jobs" value={e?.open_provision_jobs} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineChart className="h-4 w-4" /> Performance posture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Database: {h?.database_ok ? "reachable" : "unreachable"}
              {h?.database_latency_ms != null
                ? ` · ${h.database_latency_ms}ms`
                : ""}
            </p>
            <p>Redis rate limits: {h?.redis_configured ? "configured" : "in-memory only"}</p>
            <p>Job worker auth: {h?.job_worker_configured ? "configured" : "missing secret"}</p>
            <p>Platform status: {h?.status}</p>
            <div className="pt-2 flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/health">Health detail</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/events">
                  <Activity className="h-3.5 w-3.5 mr-1" /> Events
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? 0}</span>
    </div>
  );
}
