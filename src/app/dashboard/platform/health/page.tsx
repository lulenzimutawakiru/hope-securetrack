"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { listHealthChecks } from "@/lib/platform";

export default function PlatformHealthPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    listHealthChecks()
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading health…" />;

  return (
    <div>
      <PageHeader
        title="Platform health"
        description="Database · auth · storage · realtime · zero-downtime readiness"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{String(r.check_key)}</p>
                <Badge
                  variant={r.status === "healthy" ? "secondary" : "destructive"}
                  className="text-[10px]"
                >
                  {String(r.status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Latency: {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {r.checked_at ? new Date(String(r.checked_at)).toLocaleString() : ""}
              </p>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">No health samples yet.</p>
        )}
      </div>
    </div>
  );
}
