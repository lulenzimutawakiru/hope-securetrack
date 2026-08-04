"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import {
  generatePackagingInsights,
  recommendPackaging,
  type PkgAiInsight,
} from "@/lib/packaging";

export default function PkgAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PkgAiInsight[]>([]);
  const [units, setUnits] = useState("500");
  const [recommendation, setRecommendation] = useState("");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { count: openWo },
        { data: mats },
        { count: downtime },
        { count: defects },
        { count: pendingQc },
        { count: cartons },
      ] = await Promise.all([
        sb.from("pkg_work_orders").select("*", { count: "exact", head: true }).in("status", ["released", "in_progress"]),
        sb.from("pkg_materials").select("stock_qty,reorder_level"),
        sb.from("pkg_lines").select("*", { count: "exact", head: true }).eq("status", "downtime"),
        sb.from("pkg_qc_checks").select("*", { count: "exact", head: true }).eq("overall_status", "fail"),
        sb.from("pkg_work_orders").select("*", { count: "exact", head: true }).eq("status", "qc"),
        sb.from("cartons").select("*", { count: "exact", head: true }),
      ]);
      const lowMaterials = (mats || []).filter(
        (m) => Number(m.stock_qty) <= Number(m.reorder_level)
      ).length;
      setInsights(
        generatePackagingInsights({
          openWorkOrders: openWo ?? 0,
          lowMaterials,
          lineDowntime: downtime ?? 0,
          defectsToday: defects ?? 0,
          pendingQc: pendingQc ?? 0,
          unitsPackedToday: (cartons ?? 0) * 5,
          cartonUtilization: 0.85,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI packaging…" />;

  return (
    <div>
      <PageHeader
        title="AI Packaging Assistant"
        description="Waste reduction · material forecast · carton utilization · green packing"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex gap-2 mb-1">
                  <Badge
                    variant={ins.severity === "high" ? "destructive" : ins.severity === "medium" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {ins.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.type}</Badge>
                </div>
                <p className="font-medium text-sm">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/packaging/materials">Materials</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/packaging/cartonization">Cartonization</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/packaging/floor">Floor</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommend packaging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Labelish />
            <Input type="number" value={units} onChange={(e) => setUnits(e.target.value)} />
            <Button
              size="sm"
              onClick={() => setRecommendation(recommendPackaging(Number(units) || 0))}
            >
              Recommend
            </Button>
            {recommendation && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">{recommendation}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Labelish() {
  return <label className="text-sm font-medium">Units to pack (reams)</label>;
}
