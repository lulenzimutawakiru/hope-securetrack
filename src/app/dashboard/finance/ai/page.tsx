"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  listFinanceInsights,
  dismissInsight,
  listCashForecasts,
  listCostRolls,
  getLatestKpis,
  predictCashShortfall,
  costSavingsIdeas,
  forecastRevenue,
  explainFinancials,
} from "@/lib/finance";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function FinanceAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [cashMsg, setCashMsg] = useState("");
  const [savings, setSavings] = useState<string[]>([]);
  const [revForecast, setRevForecast] = useState({ next: 0, trend: "" });
  const [summary, setSummary] = useState("");

  const load = async () => {
    try {
      const [ins, fc, rolls, kpi] = await Promise.all([
        listFinanceInsights(),
        listCashForecasts(),
        listCostRolls(),
        getLatestKpis(),
      ]);
      setInsights(ins);
      const pred = predictCashShortfall(
        fc.map((f) => ({
          forecast_date: String(f.forecast_date),
          projected_balance: Number(f.projected_balance),
          net_flow: Number(f.net_flow),
        }))
      );
      setCashMsg(pred.message);
      setSavings(
        costSavingsIdeas(
          rolls.map((r) => ({
            product_line: r.product_line as string,
            variance_amount: Number(r.variance_amount),
            scrap_cost: Number(r.scrap_cost),
          }))
        )
      );
      if (kpi) {
        setRevForecast(forecastRevenue([Number(kpi.revenue_mtd || 0) * 0.9, Number(kpi.revenue_mtd || 0)]));
        setSummary(
          explainFinancials({
            revenue: Number(kpi.revenue_mtd),
            gross_profit: Number(kpi.gross_profit),
            net_profit: Number(kpi.net_profit),
            cash_position: Number(kpi.cash_position),
            ar_balance: Number(kpi.ar_balance),
            ap_balance: Number(kpi.ap_balance),
            gross_margin_pct: Number(kpi.gross_margin_pct),
          })
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Loading AI finance…" />;

  return (
    <div>
      <PageHeader
        title="AI Finance Assistant"
        description="Cash shortage · fraud · revenue forecast · collections · executive summaries"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/finance">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Cash forecast risk</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{cashMsg}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Revenue forecast (next)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(revForecast.next)}</p>
            <p className="text-xs text-muted-foreground">{revForecast.trend} trend</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Cost savings ideas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs list-disc pl-4 space-y-1">
              {savings.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Executive financial summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{summary}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" /> Active insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 && (
            <p className="text-sm text-muted-foreground">No open insights.</p>
          )}
          {insights.map((i) => (
            <div key={String(i.id)} className="rounded-lg border p-3">
              <div className="flex justify-between gap-2">
                <p className="font-medium text-sm">{String(i.title)}</p>
                <StatusBadge status={String(i.severity)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{String(i.recommendation)}</p>
              <div className="flex justify-between mt-2">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {String(i.insight_type || "").replace(/_/g, " ")}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() =>
                    dismissInsight(String(i.id)).then(() => {
                      toast.success("Dismissed");
                      load();
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
