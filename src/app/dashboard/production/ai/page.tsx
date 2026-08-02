"use client";

import { useEffect, useState } from "react";
import { Sparkles, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { formatDate } from "@/lib/utils";

export default function MesAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await createClient()
      .from("mes_ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setInsights((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const generate = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const sb = createClient();
      const { count: delayed } = await sb
        .from("mes_production_orders")
        .select("*", { count: "exact", head: true })
        .lt("planned_finish", new Date().toISOString())
        .not("status", "in", '("completed","closed","cancelled")');
      const { count: ncr } = await sb
        .from("mes_ncr")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      const insights = [
        {
          insight_type: "schedule",
          title: `${delayed ?? 0} order(s) past planned finish`,
          summary: "Reschedule capacity or expedite materials to recover plan.",
          severity: (delayed ?? 0) > 0 ? "warning" : "info",
          score: 70,
          recommendations: ["Review MPS conflicts", "Pull in overtime shift", "Expedite shortage POs"],
          status: "open",
        },
        {
          insight_type: "quality",
          title: `${ncr ?? 0} open NCR(s)`,
          summary: "Open non-conformances may block order close and dispatch.",
          severity: (ncr ?? 0) > 0 ? "warning" : "info",
          score: 75,
          recommendations: ["Close CAPA", "Hold batch pending rework", "Update inspection plan"],
          status: "open",
        },
        {
          insight_type: "maintenance",
          title: "Predictive maintenance window",
          summary: "Schedule PM for high-utilization presses before peak print week.",
          severity: "info",
          score: 68,
          recommendations: ["Book maintenance slot", "Stage spare rollers", "Notify production planner"],
          status: "open",
        },
      ];
      for (const insight of insights) {
        const crudRes2 = await crudCreate("mes_ai_insights", insight);
        if (!crudRes2.ok) throw new Error(crudRes2.error);
      }
      toast.success("AI insights generated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading AI manufacturing assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Manufacturing Assistant"
        description="Predict failures · material shortages · delays · quality · energy · best sequence"
        actions={
          <Button size="sm" onClick={generate} disabled={busy}>
            <Sparkles className="h-4 w-4 mr-1" />
            {busy ? "Analyzing…" : "Run analysis"}
          </Button>
        }
      />
      {insights.length === 0 ? (
        <EmptyState title="No insights" description="Run analysis against live production data." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.id as string}>
              <CardHeader className="pb-2">
                <div className="flex justify-between gap-2">
                  <CardTitle className="text-sm">{String(i.title)}</CardTitle>
                  <Badge
                    variant={
                      i.severity === "warning" || i.severity === "critical"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {String(i.severity)}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {String(i.insight_type)} · {formatDate(String(i.created_at))}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{String(i.summary)}</p>
                {Array.isArray(i.recommendations) && (
                  <ul className="text-xs list-disc pl-4">
                    {(i.recommendations as string[]).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                {i.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const crudRes = await crudUpdate("mes_ai_insights", String(i.id), {
                          status: "resolved",
                          resolved_at: new Date().toISOString(),
                        });
                      toast.success("Resolved");
                      load();
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
