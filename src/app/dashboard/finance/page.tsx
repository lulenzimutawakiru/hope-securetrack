"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Landmark, ArrowRight, Brain, LineChart, CheckSquare, Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { getFinanceDashboard, FINANCE_MENU } from "@/lib/finance";
import { formatNumber } from "@/lib/utils";

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

export default function FinanceHubPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({
    accounts: 0,
    journals: 0,
    openAp: 0,
    openAr: 0,
    bankBalances: 0,
    cashPosition: 0,
    assetBookValue: 0,
    budgetUtil: 0,
    pendingApprovals: 0,
  });
  const [kpi, setKpi] = useState<Record<string, unknown> | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const d = await getFinanceDashboard();
        setStats({
          accounts: d.accounts,
          journals: d.journals,
          openAp: d.openAp,
          openAr: d.openAr,
          bankBalances: d.bankBalances,
          cashPosition: d.cashPosition,
          assetBookValue: d.assetBookValue,
          budgetUtil: d.budgetUtil,
          pendingApprovals: d.pendingApprovals,
        });
        setKpi(d.kpi as Record<string, unknown> | null);
        setInsights((d.insights as Insight[]) || []);
      } catch {
        /* migration pending */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return FINANCE_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof FINANCE_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Enterprise Finance Platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Finance & Accounting"
        description="GL · AR/AP · Treasury · FP&A · Manufacturing Costing · Tax · Multi-company · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance/cfo"><LineChart className="h-4 w-4 mr-1" /> Cockpit</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/finance/ai"><Brain className="h-4 w-4 mr-1" /> AI</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/finance/journals"><Landmark className="h-4 w-4 mr-1" /> GL</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
        <StatCard title="COA Accounts" value={String(stats.accounts)} icon={Landmark} />
        <StatCard title="Journals" value={String(stats.journals)} icon={Landmark} />
        <StatCard title="Open AR" value={formatNumber(stats.openAr)} icon={Wallet} />
        <StatCard title="Open AP" value={formatNumber(stats.openAp)} icon={Wallet} />
        <StatCard title="Bank Balances" value={formatNumber(stats.bankBalances)} icon={Wallet} />
        <StatCard title="Cash Position" value={formatNumber(stats.cashPosition)} icon={Wallet} />
        <StatCard title="Asset Book Value" value={formatNumber(stats.assetBookValue)} icon={Landmark} />
        <StatCard title="Budget Util %" value={String(stats.budgetUtil)} icon={LineChart} />
        <StatCard title="Pending Approvals" value={String(stats.pendingApprovals)} icon={CheckSquare} />
        {kpi != null && (
          <StatCard title="EBITDA (KPI)" value={formatNumber(Number(kpi.ebitda || 0))} icon={LineChart} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI finance insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">No open insights. Run AI Finance for forecasts and risk signals.</p>
            )}
            {insights.map((ins) => (
              <div key={ins.id} className="border rounded-md px-3 py-2 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={ins.severity === "critical" ? "destructive" : "outline"}>{ins.severity}</Badge>
                  <span className="font-medium">{ins.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ins.recommendation}</p>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/finance/ai">Open AI Finance <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["/dashboard/finance/coa", "Chart of Accounts"],
              ["/dashboard/finance/journals", "Journal Entries"],
              ["/dashboard/finance/ar", "Accounts Receivable"],
              ["/dashboard/finance/ap", "Accounts Payable"],
              ["/dashboard/finance/treasury", "Treasury"],
              ["/dashboard/finance/costing", "Mfg Costing"],
              ["/dashboard/finance/budgets", "Budgets"],
              ["/dashboard/finance/tax", "Tax"],
              ["/dashboard/finance/approvals", "Approvals"],
              ["/dashboard/finance/reports", "Reports"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded border px-2 py-1.5 hover:bg-muted/50">
                {label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <Input
          placeholder="Search finance modules…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <span>{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
