"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  listOpportunities,
  moveOpportunityStage,
  OPP_STAGES,
  forecastPipeline,
} from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const OPEN_STAGES = OPP_STAGES.filter((s) => s !== "won" && s !== "lost");

export default function CrmPipelinePage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows(await listOpportunities());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = async (stage: string) => {
    if (!dragging) return;
    try {
      await moveOpportunityStage(dragging, stage);
      toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
      setDragging(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  if (loading) return <LoadingState message="Loading pipeline…" />;

  const forecast = forecastPipeline(
    rows.map((r) => ({
      expected_value: Number(r.expected_value),
      probability: Number(r.probability),
      stage: String(r.stage),
    }))
  );

  const byStage = OPEN_STAGES.reduce<Record<string, Array<Record<string, unknown>>>>((acc, s) => {
    acc[s] = rows.filter((r) => String(r.stage) === s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        description="Drag cards between stages · AI-weighted forecast · team performance"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm/opportunities">List view</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm">Hub</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <StatCard title="Pipeline" value={formatNumber(Math.round(forecast.totalPipeline))} />
        <StatCard title="Weighted" value={formatNumber(Math.round(forecast.weightedForecast))} />
        <StatCard title="Commit" value={formatNumber(Math.round(forecast.commit))} />
        <StatCard title="Best case" value={formatNumber(Math.round(forecast.bestCase))} />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
        {OPEN_STAGES.map((stage) => (
          <div
            key={stage}
            className="w-72 shrink-0 rounded-lg border bg-muted/30 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(stage)}
          >
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-semibold capitalize">{stage.replace(/_/g, " ")}</span>
              <Badge variant="secondary" className="text-[10px]">
                {byStage[stage]?.length || 0}
              </Badge>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
              {(byStage[stage] || []).map((card) => (
                <Card
                  key={String(card.id)}
                  draggable
                  onDragStart={() => setDragging(String(card.id))}
                  className="cursor-grab active:cursor-grabbing shadow-sm"
                >
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium leading-snug">
                      {String(card.name)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-1 space-y-1">
                    <p className="text-sm font-semibold">
                      {formatNumber(Number(card.expected_value || 0))}
                    </p>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{String(card.probability || 0)}%</span>
                      <span>
                        {card.expected_close_date
                          ? String(card.expected_close_date).slice(0, 10)
                          : "No date"}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {String(card.opportunity_number)}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {(byStage[stage] || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Drop cards here</p>
              )}
            </div>
            <div className="p-2 border-t text-[10px] text-muted-foreground text-right">
              {formatNumber(
                (byStage[stage] || []).reduce((s, c) => s + Number(c.expected_value || 0), 0)
              )}{" "}
              total
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
