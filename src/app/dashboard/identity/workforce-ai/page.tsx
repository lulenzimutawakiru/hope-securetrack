"use client";

import { useEffect, useState } from "react";
import { Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listAiInsights,
  resolveInsight,
  generateWorkforceInsights,
  getDigitalIdentityStats,
} from "@/lib/digital-identity";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function WorkforceAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [openCount, setOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [list, stats] = await Promise.all([
        listAiInsights({ limit: 50 }),
        getDigitalIdentityStats(),
      ]);
      setInsights(list as Array<Record<string, unknown>>);
      setOpenCount(stats.openInsights);
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const created = await generateWorkforceInsights(auth.profile.company_id);
      toast.success(`Generated ${created.length} insight(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id: string) => {
    try {
      await resolveInsight(id);
      toast.success("Insight resolved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resolve failed");
    }
  };

  if (loading) return <LoadingState message="Loading AI workforce assistant…" />;

  const severityColor = (s: string) => {
    if (s === "critical") return "destructive";
    if (s === "warning") return "secondary";
    return "outline";
  };

  return (
    <div>
      <PageHeader
        title="AI Workforce Assistant"
        description="Turnover · promotions · overtime · staffing · training gaps · absenteeism · shift optimization"
        actions={
          <Button size="sm" onClick={generate} disabled={busy}>
            <Sparkles className="h-4 w-4 mr-1" />
            {busy ? "Analyzing…" : "Run analysis"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Open insights" value={String(openCount)} icon={AlertTriangle} />
        <StatCard title="Total insights" value={String(insights.length)} icon={Sparkles} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6 text-xs">
        {[
          "Predict employee turnover",
          "Recommend promotions",
          "Detect overtime abuse",
          "Forecast staffing needs",
          "Identify training gaps",
          "Analyze absenteeism",
          "Optimize shift scheduling",
          "Answer HR policy questions",
          "Summarize employee performance",
        ].map((cap) => (
          <div key={cap} className="rounded border bg-muted/30 px-3 py-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-hope-gold shrink-0" />
            {cap}
          </div>
        ))}
      </div>

      {insights.length === 0 ? (
        <EmptyState
          title="No insights yet"
          description="Run analysis against live workforce lifecycle data."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.id as string}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{String(i.title)}</CardTitle>
                  <Badge variant={severityColor(String(i.severity)) as "outline"}>
                    {String(i.severity)}
                  </Badge>
                </div>
                <div className="flex gap-2 text-[11px] text-muted-foreground">
                  <span>{String(i.insight_type)}</span>
                  <span>·</span>
                  <span>score {String(i.score ?? "—")}</span>
                  <span>·</span>
                  <span>{formatDate(String(i.created_at))}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{String(i.summary)}</p>
                {Array.isArray(i.recommendations) && (i.recommendations as string[]).length > 0 && (
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    {(i.recommendations as string[]).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center justify-between">
                  <Badge variant={i.status === "open" ? "default" : "secondary"}>
                    {String(i.status)}
                  </Badge>
                  {i.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => resolve(i.id as string)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
