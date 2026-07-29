"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { getLatestKpis, listKpiHistory, listCostRolls, explainFinancials } from "@/lib/finance";
import { formatNumber } from "@/lib/utils";

export default function CfoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [byLine, setByLine] = useState<Array<{ line: string; cost: number; count: number }>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [k, h, rolls] = await Promise.all([
          getLatestKpis(),
          listKpiHistory(6),
          listCostRolls(),
        ]);
        setKpi(k as Record<string, unknown> | null);
        setHistory(h);
        const map = new Map<string, { cost: number; count: number }>();
        for (const r of rolls) {
          const line = String(r.product_line || "other");
          const prev = map.get(line) || { cost: 0, count: 0 };
          map.set(line, {
            cost: prev.cost + Number(r.total_cost || 0),
            count: prev.count + 1,
          });
        }
        setByLine(
          Array.from(map.entries())
            .map(([line, v]) => ({ line, ...v }))
            .sort((a, b) => b.cost - a.cost)
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading CFO dashboard…" />;

  const narrative = kpi
    ? explainFinancials({
        revenue: Number(kpi.revenue_mtd),
        gross_profit: Number(kpi.gross_profit),
        net_profit: Number(kpi.net_profit),
        cash_position: Number(kpi.cash_position),
        ar_balance: Number(kpi.ar_balance),
        ap_balance: Number(kpi.ap_balance),
        gross_margin_pct: Number(kpi.gross_margin_pct),
      })
    : "No KPI snapshot yet — apply migration 00047.";

  return (
    <div>
      <PageHeader
        title="CFO Executive Dashboard"
        description="EBITDA · margins · liquidity · ROA/ROE · working capital · product-line profitability"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance">Hub</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance/reports">Statements</Link>
            </Button>
          </div>
        }
      />

      {!kpi ? (
        <p className="text-sm text-muted-foreground">No KPI snapshot available.</p>
      ) : (
        <>
          <Card className="mb-6 border-hope-teal/30 bg-hope-teal/5">
            <CardContent className="p-4 text-sm">{narrative}</CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="EBITDA" value={formatNumber(Math.round(Number(kpi.ebitda || 0)))} />
            <StatCard title="Gross margin %" value={`${Number(kpi.gross_margin_pct || 0)}%`} />
            <StatCard title="Net margin %" value={`${Number(kpi.net_margin_pct || 0)}%`} />
            <StatCard title="Operating margin %" value={`${Number(kpi.operating_margin_pct || 0)}%`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Current ratio" value={String(Number(kpi.current_ratio || 0).toFixed(2))} />
            <StatCard title="Quick ratio" value={String(Number(kpi.quick_ratio || 0).toFixed(2))} />
            <StatCard title="Debt / Equity" value={String(Number(kpi.debt_to_equity || 0).toFixed(2))} />
            <StatCard title="Working capital" value={formatNumber(Math.round(Number(kpi.working_capital || 0)))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="ROA" value={`${(Number(kpi.roa || 0) * 100).toFixed(1)}%`} />
            <StatCard title="ROE" value={`${(Number(kpi.roe || 0) * 100).toFixed(1)}%`} />
            <StatCard title="CCC (days)" value={String(kpi.cash_conversion_days ?? "—")} />
            <StatCard title="Budget util %" value={`${Number(kpi.budget_utilization_pct || 0)}%`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Cash position" value={formatNumber(Math.round(Number(kpi.cash_position || 0)))} />
            <StatCard title="AR" value={formatNumber(Math.round(Number(kpi.ar_balance || 0)))} />
            <StatCard title="AP" value={formatNumber(Math.round(Number(kpi.ap_balance || 0)))} />
            <StatCard title="Inventory" value={formatNumber(Math.round(Number(kpi.inventory_value || 0)))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <StatCard title="Tax payable" value={formatNumber(Math.round(Number(kpi.tax_payable || 0)))} />
            <StatCard title="Payroll MTD" value={formatNumber(Math.round(Number(kpi.payroll_cost_mtd || 0)))} />
            <StatCard title="Production cost MTD" value={formatNumber(Math.round(Number(kpi.production_cost_mtd || 0)))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Revenue MTD" value={formatNumber(Math.round(Number(kpi.revenue_mtd || 0)))} />
            <StatCard title="Revenue today" value={formatNumber(Math.round(Number(kpi.revenue_today || 0)))} />
            <StatCard title="Expenses today" value={formatNumber(Math.round(Number(kpi.expenses_today || 0)))} />
            <StatCard title="Gross profit" value={formatNumber(Math.round(Number(kpi.gross_profit || 0)))} />
            <StatCard title="Net profit" value={formatNumber(Math.round(Number(kpi.net_profit || 0)))} />
            <StatCard title="Outstanding invoices" value={formatNumber(Math.round(Number(kpi.outstanding_invoices || 0)))} />
            <StatCard title="VAT position" value={formatNumber(Math.round(Number(kpi.vat_position || 0)))} />
            <StatCard title="Bank balances" value={formatNumber(Math.round(Number(kpi.bank_balances || 0)))} />
            <StatCard title="Cost / ream" value={formatNumber(Number(kpi.cost_per_ream || 0))} />
            <StatCard title="Cost / box" value={formatNumber(Number(kpi.cost_per_box || 0))} />
            <StatCard title="Cost / ton" value={formatNumber(Number(kpi.cost_per_ton || 0))} />
            <StatCard title="Factory profit" value={formatNumber(Math.round(Number(kpi.factory_profit || 0)))} />
          </div>

          <div className="flex flex-wrap gap-2 mb-6 text-sm">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/engine">Accounting engine</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/close-checklist">Month-end close</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/inventory-valuation">Inventory valuation</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/production-profit">Production P&amp;L</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/expense-claims">Expenses</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/finance/ai">AI Finance</Link></Button>
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost by product line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byLine.length === 0 && (
              <p className="text-sm text-muted-foreground">No cost rolls — apply migration 00047.</p>
            )}
            {byLine.map((r) => (
              <div key={r.line} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <span className="capitalize">{r.line.replace(/_/g, " ")} ({r.count})</span>
                <span className="font-semibold">{formatNumber(Math.round(r.cost))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPI history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((h) => (
              <div key={String(h.id)} className="flex justify-between text-sm border-b last:border-0 pb-2">
                <span>{h.snapshot_date ? String(h.snapshot_date).slice(0, 10) : "—"}</span>
                <span>
                  NP {formatNumber(Math.round(Number(h.net_profit || 0)))} · EBITDA{" "}
                  {formatNumber(Math.round(Number(h.ebitda || 0)))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
