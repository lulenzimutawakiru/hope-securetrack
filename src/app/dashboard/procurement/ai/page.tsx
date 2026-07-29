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
  listInsights,
  dismissInsight,
  listSuppliers,
  recommendSuppliers,
  negotiationOpportunities,
  detectPriceAnomaly,
  spendForecast,
} from "@/lib/srm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function SrmAiPage() {
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [suppliers, setSuppliers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [i, s] = await Promise.all([listInsights(), listSuppliers({ limit: 100 })]);
      setInsights(i);
      setSuppliers(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Loading AI procurement…" />;

  const recommended = recommendSuppliers(
    suppliers.map((s) => ({
      name: String(s.name),
      category: s.category as string,
      overall_score: Number(s.overall_score),
      risk_score: Number(s.risk_score),
      supplier_class: s.supplier_class as string,
      is_approved_vendor: s.is_approved_vendor as boolean,
    }))
  );

  const topSpender = suppliers
    .slice()
    .sort((a, b) => Number(b.spend_ytd || 0) - Number(a.spend_ytd || 0))[0];

  const nego = topSpender
    ? negotiationOpportunities(Number(topSpender.spend_ytd || 0), Number(topSpender.overall_score || 70))
    : [];

  const priceCheck = detectPriceAnomaly(12500, 10000);
  const forecast = spendForecast(
    suppliers.map((s) => Number(s.spend_ytd || 0) / 12).filter((n) => n > 0).slice(0, 6)
  );

  return (
    <div>
      <PageHeader
        title="AI Procurement Assistant"
        description="Recommend suppliers · predict delays · price anomalies · negotiation · spend forecast"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/procurement">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" /> Active insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">No open insights. Apply migration 00045 for seeds.</p>
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
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissInsight(String(i.id)).then(load)}>
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
                <Sparkles className="h-4 w-4" /> Recommended suppliers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommended.map((r) => (
                <div key={r.name} className="flex justify-between text-sm border-b last:border-0 pb-2">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.reason}</p>
                  </div>
                  <Badge>{r.score}</Badge>
                </div>
              ))}
              {recommended.length === 0 && (
                <p className="text-sm text-muted-foreground">No approved suppliers to rank.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Negotiation opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              {topSpender && (
                <p className="text-xs text-muted-foreground mb-2">
                  Focus: {String(topSpender.name)} · YTD {formatNumber(Number(topSpender.spend_ytd || 0))}
                </p>
              )}
              <ul className="text-sm list-disc pl-4 space-y-1">
                {nego.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Price anomaly demo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className={priceCheck.abnormal ? "text-destructive font-medium" : ""}>
                {priceCheck.message}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                3-month spend forecast: {formatNumber(forecast.projected)} · {forecast.trend}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
