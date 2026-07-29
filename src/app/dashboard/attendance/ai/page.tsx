"use client";

import { useEffect, useState } from "react";
import { Wand2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { generateAttendanceInsights, listAttendanceInsights, type AttInsight } from "@/lib/attendance";
import { toast } from "sonner";

export default function AttendanceAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<AttInsight[]>([]);
  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listAttendanceInsights(companyId);
      setInsights(
        rows.map((r) => ({
          id: r.id,
          insight_type: r.insight_type,
          title: r.title,
          summary: r.summary,
          severity: r.severity,
          score: r.score != null ? Number(r.score) : undefined,
          recommendations: Array.isArray(r.recommendations) ? (r.recommendations as string[]) : [],
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
    if (!companyId) return;
    setBusy(true);
    try {
      const g = await generateAttendanceInsights(companyId);
      toast.success(`Generated ${g.length} insight(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading AI attendance insights…" />;

  return (
    <div>
      <PageHeader
        title="AI Attendance Insights"
        description="Fraud · buddy punch · lateness · device anomalies · OT risk"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
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
              <div className="flex gap-2 flex-wrap">
                <Badge variant={ins.severity === "critical" ? "destructive" : "outline"}>{ins.severity}</Badge>
                <Badge variant="secondary">{ins.insight_type}</Badge>
              </div>
              <CardTitle className="text-base mt-1">{ins.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{ins.summary}</p>
              {ins.recommendations && ins.recommendations.length > 0 && (
                <ul className="text-sm list-disc pl-4">
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
        <p className="text-sm text-muted-foreground mt-4">No insights yet. Click Run analysis.</p>
      )}
    </div>
  );
}
