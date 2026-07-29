"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { getAdvancedAnalytics } from "@/lib/srm";
import { formatNumber } from "@/lib/utils";

export default function SrmAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdvancedAnalytics>> | null>(null);
  const [drill, setDrill] = useState<{ type: string; key: string } | null>(null);

  useEffect(() => {
    getAdvancedAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingState message="Loading SRM analytics…" />;

  const maxSpend = Math.max(...data.spendBySupplier.map((s) => s.spend), 1);
  const maxCat = Math.max(...data.spendByCategory.map((c) => c.spend), 1);

  return (
    <div>
      <PageHeader
        title="SRM Executive Analytics"
        description="Spend · rankings · contracts · delivery · savings · risk heatmap — interactive drill-down"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">Hub</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/reports">BI</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Top supplier spend" value={formatNumber(data.spendBySupplier[0]?.spend || 0)} />
        <StatCard title="Categories" value={String(data.spendByCategory.length)} />
        <StatCard title="Delivery on-time %" value={`${data.deliveryPerformance.onTimePct}%`} />
        <StatCard title="Procurement savings" value={formatNumber(Math.round(data.totalSavings))} />
      </div>

      {drill && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="p-3 flex justify-between items-center text-sm">
            <span>
              Drill-down: <strong>{drill.type}</strong> → {drill.key}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setDrill(null)}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend by supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.spendBySupplier.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left"
                onClick={() => setDrill({ type: "supplier", key: s.name })}
              >
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="truncate max-w-[60%] font-medium">{s.name}</span>
                  <span>{formatNumber(s.spend)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.round((s.spend / maxSpend) * 100)}%` }}
                  />
                </div>
              </button>
            ))}
            {data.spendBySupplier.length === 0 && (
              <p className="text-sm text-muted-foreground">No spend data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.spendByCategory.map((c) => (
              <button
                key={c.category}
                type="button"
                className="w-full text-left"
                onClick={() => setDrill({ type: "category", key: c.category })}
              >
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
                  <span>{formatNumber(c.spend)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-hope-teal rounded-full"
                    style={{ width: `${Math.round((c.spend / maxCat) * 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.rankings.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-6 justify-center text-[10px]">
                    {i + 1}
                  </Badge>
                  <span className="truncate max-w-[140px]">{r.name}</span>
                </span>
                <span className="font-semibold">{r.score}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract expiry calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {data.contractCalendar.map((c) => (
              <div key={c.id} className="text-sm border-b last:border-0 pb-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium truncate">{c.title}</span>
                  <Badge variant={c.days <= 30 ? "destructive" : c.days <= 90 ? "secondary" : "outline"}>
                    {c.days}d
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {c.end_date.slice(0, 10)} · limit {formatNumber(c.value_limit)}
                </p>
              </div>
            ))}
            {data.contractCalendar.length === 0 && (
              <p className="text-sm text-muted-foreground">No active contracts with end dates</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipments tracked</span>
              <span className="font-semibold">{data.deliveryPerformance.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivered / arrived</span>
              <span className="font-semibold">{data.deliveryPerformance.onTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delayed</span>
              <span className="font-semibold text-destructive">{data.deliveryPerformance.delayed}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${data.deliveryPerformance.onTimePct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {data.deliveryPerformance.onTimePct}% positive status rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procurement savings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.savings.map((s) => (
              <div key={String(s.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium">{String(s.initiative || s.category || "Initiative")}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {String(s.category || "")} · {String(s.period_year)}/{String(s.period_month || "—")}
                  </p>
                </div>
                <span className="font-semibold text-emerald-600">
                  +{formatNumber(Number(s.savings_amount || 0))}
                </span>
              </div>
            ))}
            {data.savings.length === 0 && (
              <p className="text-sm text-muted-foreground">No savings records — apply migration 00046</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier risk heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.riskHeatmap.map((r) => {
                const intensity =
                  r.risk >= 70 ? "bg-red-500/80 text-white" : r.risk >= 45 ? "bg-amber-400/80" : "bg-emerald-500/70 text-white";
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => setDrill({ type: "risk", key: r.name })}
                    className={`rounded-md p-2 text-left ${intensity}`}
                  >
                    <p className="text-[10px] font-medium truncate">{r.name}</p>
                    <p className="text-sm font-bold">R{r.risk}</p>
                    <p className="text-[9px] opacity-80">P{r.performance} · {formatNumber(r.spend)}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Color = disruption risk (green low · amber medium · red high). Click to drill.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top suppliers (quick view)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium">Class</th>
                <th className="pb-2 font-medium text-right">YTD spend</th>
                <th className="pb-2 font-medium text-right">Score</th>
                <th className="pb-2 font-medium text-right">OTD %</th>
                <th className="pb-2 font-medium text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.topSuppliers.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="capitalize text-xs">{s.class}</td>
                  <td className="text-right">{formatNumber(s.spend)}</td>
                  <td className="text-right">{s.score}</td>
                  <td className="text-right">{s.otd}</td>
                  <td className="text-right">{s.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
