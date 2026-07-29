"use client";

import { useEffect, useState } from "react";
import { Wand2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { generateFleetInsights, listFleetInsights, type FleetInsight } from "@/lib/fleet";
import { toast } from "sonner";

export default function FleetAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<FleetInsight[]>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listFleetInsights(companyId);
      setInsights(
        rows.map((r) => ({
          id: r.id,
          insight_type: r.insight_type,
          title: r.title,
          summary: r.summary,
          severity: r.severity,
          score: r.score != null ? Number(r.score) : undefined,
          recommendations: Array.isArray(r.recommendations)
            ? (r.recommendations as string[])
            : typeof r.recommendations === "string"
              ? JSON.parse(r.recommendations)
              : [],
          status: r.status,
          created_at: r.created_at,
        }))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const run = async () => {
    if (!companyId) return toast.error("No company");
    setBusy(true);
    try {
      const generated = await generateFleetInsights(companyId);
      toast.success(`Generated ${generated.length} insight(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI run failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading AI Fleet Assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Fleet Assistant"
        description="Predict maintenance · fuel anomalies · utilization · safety · compliance"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={run} disabled={busy}>
              <Wand2 className="h-4 w-4 mr-1" /> {busy ? "Analyzing…" : "Run analysis"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((ins, i) => (
          <Card key={ins.id || i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    ins.severity === "critical"
                      ? "destructive"
                      : ins.severity === "warning"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {ins.severity}
                </Badge>
                <Badge variant="outline">{ins.insight_type}</Badge>
                {ins.score != null && (
                  <span className="text-xs text-muted-foreground">score {ins.score}</span>
                )}
              </div>
              <CardTitle className="text-base mt-1">{ins.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{ins.summary}</p>
              {ins.recommendations && ins.recommendations.length > 0 && (
                <ul className="text-sm list-disc pl-4 space-y-1">
                  {ins.recommendations.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {insights.length === 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          No insights yet. Click <strong>Run analysis</strong> to evaluate vehicles, fuel, drivers, and compliance.
        </p>
      )}
    </div>
  );
}
