"use client";

import { useEffect, useState } from "react";
import { Landmark, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";
import {
  agingBucket,
  detectDuplicateInvoices,
  forecastRevenue,
  summarizeCustomerAccount,
} from "@/lib/billing";
import { Badge } from "@/components/ui/badge";

export default function CfoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    revenue: 0,
    openAr: 0,
    collectionRate: 0,
    overdue: 0,
    pendingApproval: 0,
    cashMtd: 0,
  });
  const [forecast, setForecast] = useState<number[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ a: string; b: string; reason: string }>>([]);
  const [topRisk, setTopRisk] = useState<
    Array<{ name: string; risk: number; outstanding: number; actions: string[] }>
  >([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const startMonth = new Date();
      startMonth.setDate(1);
      const [{ data: inv }, { data: pays }, { data: custs }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id,invoice_number,customer_id,status,total_amount,amount_paid,tax_amount,due_date,invoice_date,approval_status,customers(name)")
          .limit(3000),
        supabase
          .from("invoice_payments")
          .select("amount,payment_date")
          .gte("payment_date", startMonth.toISOString().slice(0, 10)),
        supabase.from("customers").select("id,name,credit_limit,risk_score").eq("is_active", true).limit(100),
      ]);

      const invoices = inv || [];
      const open = invoices.filter((i) => !["paid", "void", "cancelled"].includes(String(i.status)));
      const openAr = open.reduce(
        (s, i) => s + Number(i.total_amount) - Number(i.amount_paid || 0),
        0
      );
      const billed = invoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
      const collected = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
      const cashMtd = (pays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const overdue = open.filter((i) => {
        const b = agingBucket(i.due_date as string | null, String(i.status));
        return b !== "current" && b !== "paid";
      }).length;
      const pendingApproval = invoices.filter((i) =>
        String(i.approval_status || "").startsWith("pending")
      ).length;

      // monthly series last 6 months for forecast
      const months: number[] = [];
      for (let m = 5; m >= 0; m--) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const sum = invoices
          .filter((i) => String(i.invoice_date || "").startsWith(key))
          .reduce((s, i) => s + Number(i.total_amount || 0), 0);
        months.push(sum);
      }

      setForecast(forecastRevenue(months, 3));
      setDuplicates(
        detectDuplicateInvoices(
          invoices.map((i) => ({
            id: String(i.id),
            customer_id: i.customer_id as string | null,
            total_amount: Number(i.total_amount),
            invoice_date: String(i.invoice_date),
            invoice_number: String(i.invoice_number),
          }))
        ).slice(0, 10)
      );

      const riskList = (custs || [])
        .map((c) => {
          const cinvoices = invoices.filter((i) => i.customer_id === c.id);
          const summary = summarizeCustomerAccount({
            customer_name: c.name,
            invoices: cinvoices.map((i) => ({
              status: String(i.status),
              total_amount: Number(i.total_amount),
              amount_paid: Number(i.amount_paid || 0),
              due_date: i.due_date as string | null,
            })),
            credit_limit: Number(c.credit_limit || 0),
            risk_score: Number(c.risk_score ?? 50),
          });
          return {
            name: c.name,
            risk: summary.late_payment_risk,
            outstanding: summary.outstanding,
            actions: summary.collection_actions.slice(0, 2),
          };
        })
        .filter((r) => r.outstanding > 0)
        .sort((a, b) => b.risk - a.risk)
        .slice(0, 8);

      setTopRisk(riskList);
      setKpis({
        revenue: billed,
        openAr,
        collectionRate: billed > 0 ? (collected / billed) * 100 : 0,
        overdue,
        pendingApproval,
        cashMtd,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading CFO dashboard…" />;

  return (
    <div>
      <PageHeader
        title="CFO Dashboard"
        description="Revenue · receivables · cash · collection rate · AI risk · forecast"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard title="Billed revenue" value={formatNumber(Math.round(kpis.revenue))} icon={TrendingUp} />
        <StatCard title="Open AR" value={formatNumber(Math.round(kpis.openAr))} icon={Wallet} />
        <StatCard title="Cash collected MTD" value={formatNumber(Math.round(kpis.cashMtd))} icon={Landmark} />
        <StatCard title="Collection rate" value={`${kpis.collectionRate.toFixed(1)}%`} icon={TrendingUp} />
        <StatCard title="Overdue invoices" value={String(kpis.overdue)} icon={AlertTriangle} />
        <StatCard title="Pending approvals" value={String(kpis.pendingApproval)} icon={Landmark} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue forecast (next 3 months)</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {forecast.map((v, i) => (
              <div key={i} className="flex-1 rounded-lg border p-4 text-center">
                <p className="text-xs text-muted-foreground">M+{i + 1}</p>
                <p className="text-lg font-bold">{formatNumber(v)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Possible duplicate invoices (AI)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {duplicates.length === 0 ? (
              <p className="text-muted-foreground">No duplicates detected</p>
            ) : (
              duplicates.map((d, i) => (
                <div key={i} className="flex justify-between gap-2 border-b pb-1">
                  <span className="font-mono text-xs">{d.a} ↔ {d.b}</span>
                  <span className="text-xs text-muted-foreground">{d.reason}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top collection risks (AI)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRisk.map((r) => (
            <div key={r.name} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{r.name}</div>
                <div className="flex gap-2">
                  <Badge variant={r.risk >= 70 ? "destructive" : "secondary"}>
                    Risk {r.risk}
                  </Badge>
                  <Badge variant="outline">{formatNumber(Math.round(r.outstanding))} AR</Badge>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                {r.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
          {topRisk.length === 0 && (
            <p className="text-sm text-muted-foreground">No open customer balances.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
