"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { crudCount, crudList } from "@/lib/api/crud-client";
import {
  generateAssetInsights,
  estimateRemainingLife,
  type AssetAiInsight,
} from "@/lib/assets";

export default function AssetAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<AssetAiInsight[]>([]);
  const [sampleRul, setSampleRul] = useState<Array<{ tag: string; name: string; months: number; pct: number }>>([]);

  useEffect(() => {
    async function load() {
      const [
        total,
        assigned,
        missing,
        maintOpen,
        openAlerts,
        assetsRes,
      ] = await Promise.all([
        crudCount("ast_assets"),
        crudCount("ast_assets", { status: "assigned" }),
        crudCount("ast_assets", { status: "missing" }),
        crudCount("ast_maintenance_links", { status: "open" }),
        crudCount("ast_alerts", { status: "open" }),
        crudList<Record<string, unknown>>("ast_assets", {
          page: 1,
          pageSize: 50,
        }),
      ]);

      const list = assetsRes.ok ? assetsRes.data.data : [];
      const now = Date.now();
      const warrantyExpiring = list.filter((a) => {
        if (!a.warranty_end) return false;
        const t = new Date(a.warranty_end).getTime();
        return t > now && t - now < 90 * 24 * 3600 * 1000;
      }).length;
      const totalValue = list.reduce((s, a) => s + Number(a.current_value || 0), 0);
      const underutilized = list.filter((a) => !a.purchase_date).length;

      setInsights(
        generateAssetInsights({
          totalAssets: total ?? 0,
          assigned: assigned ?? 0,
          missing: missing ?? 0,
          maintenanceDue: maintOpen ?? 0,
          warrantyExpiring,
          openAlerts: openAlerts ?? 0,
          underutilized,
          totalValue,
        })
      );

      setSampleRul(
        list.slice(0, 8).map((a) => {
          const r = estimateRemainingLife(a.purchase_date as string | null, 60);
          return {
            tag: String(a.asset_tag),
            name: String(a.name),
            months: r.remainingMonths,
            pct: r.pct,
          };
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI asset assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Asset Assistant"
        description="Predict maintenance · movement · utilization · RUL · budget · duplicates"
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
                <div className="flex flex-wrap gap-1 mt-2">
                  {ins.actions.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/audits">Audits</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/maintenance">Maintenance</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/alerts">Alerts</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/assets/analytics">Analytics</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remaining useful life (sample)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sampleRul.map((r) => (
              <div key={r.tag} className="text-sm">
                <div className="flex justify-between mb-0.5">
                  <span className="font-mono text-xs">{r.tag}</span>
                  <span className="text-xs text-muted-foreground">{r.months} mo · {r.pct}%</span>
                </div>
                <div className="h-1.5 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary/70" style={{ width: `${r.pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.name}</p>
              </div>
            ))}
            {sampleRul.length === 0 && (
              <p className="text-sm text-muted-foreground">Register assets with purchase dates for RUL.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
