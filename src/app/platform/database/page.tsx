"use client";

/**
 * Database Administration — controlled tools only.
 * Never exposes destructive SQL or raw production shell access.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";

export default function PlatformDatabasePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/platform/command-center")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading database health..." />;

  const h = data?.health;

  return (
    <ControlPlaneSectionPage
      title="Database Administration"
      description="Schema monitoring, migration status, query latency — no raw destructive SQL"
      capabilityId="database"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Health probe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={h?.database_ok ? "secondary" : "destructive"}>
                {h?.database_ok ? "reachable" : "unreachable"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Latency:{" "}
                {h?.database_latency_ms != null
                  ? `${h.database_latency_ms} ms`
                  : "n/a"}
              </span>
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>RLS is mandatory on all tenant business tables</li>
              <li>Migrations via supabase db push (CI/CD tracked)</li>
              <li>Index and query performance: Supabase dashboard / APM</li>
              <li>
                <strong className="text-foreground">Blocked:</strong> ad-hoc
                destructive SQL, direct prod shell, unlogged schema changes
              </li>
            </ul>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/health">Infrastructure health</Link>
            </Button>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
