"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  listInsights,
  dismissInsight,
  listCustomers,
  listOpportunities,
  refreshCustomerHealth,
  nextBestActions,
  forecastPipeline,
  recommendProducts,
} from "@/lib/crm";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmAiPage() {
  const { auth } = useUser();
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [forecast, setForecast] = useState({ totalPipeline: 0, weightedForecast: 0, commit: 0, bestCase: 0, winRateHint: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = async () => {
    try {
      const [ins, cust, opps] = await Promise.all([
        listInsights(),
        listCustomers({ limit: 50 }),
        listOpportunities(),
      ]);
      setInsights(ins);
      setCustomers(cust);
      setForecast(
        forecastPipeline(
          opps.map((o) => ({
            expected_value: Number(o.expected_value),
            probability: Number(o.probability),
            stage: String(o.stage),
          }))
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dismiss = async (id: string) => {
    try {
      await dismissInsight(id);
      toast.success("Insight dismissed");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const refreshHealth = async (customerId: string) => {
    if (!auth) return;
    setRefreshing(customerId);
    try {
      const r = await refreshCustomerHealth(customerId, auth.profile.company_id);
      toast.success(`Health ${r.score} · Churn risk ${r.churn_risk}%`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  };

  if (loading) return <LoadingState message="Loading AI intelligence…" />;

  const atRisk = customers
    .filter((c) => Number(c.churn_risk || 0) >= 40 || Number(c.health_score || 100) < 60)
    .slice(0, 8);

  const sampleNba = nextBestActions({
    health: atRisk[0] ? Number(atRisk[0].health_score) : 70,
    openOpps: 2,
    overdue: atRisk[0] ? Number(atRisk[0].outstanding_balance) : 0,
    loyalty: atRisk[0] ? String(atRisk[0].loyalty_level) : "gold",
  });

  return (
    <div>
      <PageHeader
        title="AI Customer Intelligence"
        description="Health scores · churn prediction · upsell · forecast · next best action"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/crm">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Weighted forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatNumber(Math.round(forecast.weightedForecast))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatNumber(Math.round(forecast.totalPipeline))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Commit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatNumber(Math.round(forecast.commit))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Open insights</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{insights.length}</CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground mb-6">{forecast.winRateHint}</p>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Active insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">No open insights. Seed data appears after migration 00044.</p>
            )}
            {insights.map((i) => (
              <div key={String(i.id)} className="rounded-lg border p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-sm">{String(i.title)}</p>
                  <StatusBadge status={String(i.severity)} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{String(i.recommendation)}</p>
                <div className="flex items-center justify-between mt-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {String(i.insight_type || "").replace(/_/g, " ")}
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismiss(String(i.id))}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> At-risk accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {atRisk.length === 0 && (
                <p className="text-sm text-muted-foreground">No high-risk accounts detected.</p>
              )}
              {atRisk.map((c) => (
                <div key={String(c.id)} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <p className="font-medium">{String(c.name)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Health {String(c.health_score ?? "—")} · Churn {String(c.churn_risk ?? 0)}%
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={refreshing === c.id}
                    onClick={() => refreshHealth(String(c.id))}
                  >
                    {refreshing === c.id ? "…" : "Refresh"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Next best actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 list-disc pl-4">
                {sampleNba.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Product recommendations (Education)</p>
                <div className="flex flex-wrap gap-1">
                  {recommendProducts("Education").map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
