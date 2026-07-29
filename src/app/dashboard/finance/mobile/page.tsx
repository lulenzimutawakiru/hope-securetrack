"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  BookOpen,
  Banknote,
  Receipt,
  FileText,
  Factory,
  Scale,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getFinanceDashboard, listApprovals, listCashForecasts } from "@/lib/finance";
import { formatNumber } from "@/lib/utils";

export default function FinanceMobilePage() {
  const [loading, setLoading] = useState(true);
  const [cash, setCash] = useState(0);
  const [ar, setAr] = useState(0);
  const [ap, setAp] = useState(0);
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [forecast, setForecast] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [d, a, f] = await Promise.all([
          getFinanceDashboard(),
          listApprovals({ status: "pending" }),
          listCashForecasts(),
        ]);
        setCash(d.cashPosition);
        setAr(d.openAr);
        setAp(d.openAp);
        setApprovals(a.slice(0, 6));
        setForecast(f.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading mobile finance…" />;

  const actions = [
    { href: "/dashboard/finance/approvals", icon: CheckSquare, label: "Approve" },
    { href: "/dashboard/finance/journals", icon: BookOpen, label: "Journal" },
    { href: "/dashboard/finance/cash", icon: Banknote, label: "Cash" },
    { href: "/dashboard/finance/ap", icon: Receipt, label: "AP" },
    { href: "/dashboard/finance/ar", icon: FileText, label: "AR" },
    { href: "/dashboard/finance/costing", icon: Factory, label: "Cost" },
    { href: "/dashboard/finance/tax", icon: Scale, label: "Tax" },
    { href: "/dashboard/finance/cfo", icon: LineChart, label: "CFO" },
  ];

  return (
    <div className="max-w-lg mx-auto pb-24 px-1">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b -mx-1 px-3 py-3 mb-4">
        <h1 className="text-lg font-bold">Mobile Finance</h1>
        <p className="text-xs text-muted-foreground">Approve · cash · journals · offline PWA</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Cash</p>
            <p className="text-sm font-bold">{formatNumber(Math.round(cash))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">AR</p>
            <p className="text-sm font-bold">{formatNumber(Math.round(ar))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">AP</p>
            <p className="text-sm font-bold">{formatNumber(Math.round(ap))}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1 rounded-xl border p-3 hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-medium">{a.label}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pending approvals</h2>
      <div className="space-y-2 mb-6">
        {approvals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">No pending items</p>
        )}
        {approvals.map((a) => (
          <Link key={String(a.id)} href="/dashboard/finance/approvals">
            <Card className="mb-2 hover:border-primary/40">
              <CardContent className="p-3 flex justify-between gap-2">
                <div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {String(a.entity_type)}
                  </Badge>
                  <p className="font-mono text-xs mt-1">{String(a.entity_ref)}</p>
                </div>
                <p className="text-sm font-semibold">{formatNumber(Number(a.amount || 0))}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Cash forecast</h2>
      <div className="space-y-2">
        {forecast.map((f) => (
          <Card key={String(f.id)}>
            <CardContent className="p-3 flex justify-between text-sm">
              <span>{f.forecast_date ? String(f.forecast_date).slice(0, 10) : "—"}</span>
              <span className={Number(f.net_flow || 0) < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>
                {formatNumber(Number(f.net_flow || 0))}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Button asChild className="w-full" size="sm">
          <Link href="/dashboard/finance">Open full Finance hub</Link>
        </Button>
      </div>
    </div>
  );
}
