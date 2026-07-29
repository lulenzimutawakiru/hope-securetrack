"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart as LineChartIcon, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { downloadCsv } from "@/lib/documents";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#0B1F3A", "#C9A227", "#0D7377", "#64748B", "#22c55e", "#ef4444"];

export default function AnalyticsStudioPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [verifyData, setVerifyData] = useState<{ name: string; value: number }[]>([]);
  const [kpiTrend, setKpiTrend] = useState<{ name: string; actual: number; target: number }[]>([]);
  const [summary, setSummary] = useState({
    batches: 0,
    qr: 0,
    verifications: 0,
    fraud: 0,
    invoices: 0,
    employees: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const statuses = [
        "draft",
        "in_progress",
        "qc_pending",
        "approved",
        "packed",
        "completed",
      ];
      const statusCounts = await Promise.all(
        statuses.map(async (s) => {
          const { count } = await supabase
            .from("production_batches")
            .select("*", { count: "exact", head: true })
            .eq("production_status", s);
          return { name: s.replace(/_/g, " "), value: count ?? 0 };
        })
      );

      const results = ["genuine", "invalid", "counterfeit", "recalled", "suspicious"];
      const resultCounts = await Promise.all(
        results.map(async (r) => {
          const { count } = await supabase
            .from("verification_logs")
            .select("*", { count: "exact", head: true })
            .eq("result", r);
          return { name: r, value: count ?? 0 };
        })
      );

      const [batches, qr, verifications, fraud, invoices, employees, { data: kpis }] =
        await Promise.all([
          supabase.from("production_batches").select("*", { count: "exact", head: true }),
          supabase.from("qr_codes").select("*", { count: "exact", head: true }),
          supabase.from("verification_logs").select("*", { count: "exact", head: true }),
          supabase
            .from("fraud_alerts")
            .select("*", { count: "exact", head: true })
            .in("status", ["open", "investigating"]),
          supabase.from("invoices").select("*", { count: "exact", head: true }),
          supabase
            .from("employees")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("bi_kpis")
            .select("name, actual_value, target_value")
            .eq("is_active", true)
            .limit(8),
        ]);

      setStatusData(statusCounts.filter((s) => s.value > 0));
      setVerifyData(resultCounts.filter((v) => v.value > 0));
      setKpiTrend(
        (kpis ?? []).map((k) => ({
          name: String(k.name).slice(0, 10),
          actual: Number(k.actual_value) || 0,
          target: Number(k.target_value) || 0,
        }))
      );
      setSummary({
        batches: batches.count ?? 0,
        qr: qr.count ?? 0,
        verifications: verifications.count ?? 0,
        fraud: fraud.count ?? 0,
        invoices: invoices.count ?? 0,
        employees: employees.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const exportCsv = () => {
    downloadCsv(
      `analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Metric", "Value"],
      [
        ["Batches", summary.batches],
        ["QR Codes", summary.qr],
        ["Verifications", summary.verifications],
        ["Open Fraud", summary.fraud],
        ["Invoices", summary.invoices],
        ["Active Employees", summary.employees],
        ...statusData.map((s) => [`Batch: ${s.name}`, s.value]),
        ...verifyData.map((v) => [`Verify: ${v.name}`, v.value]),
      ]
    );
  };

  if (loading) return <LoadingState message="Loading analytics studio…" />;

  return (
    <div>
      <PageHeader
        title="Analytics Studio"
        description="Live operational analytics · drill charts · ad-hoc extracts (legacy production + enterprise KPIs)"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        {[
          ["Batches", summary.batches],
          ["QR codes", summary.qr],
          ["Verifications", summary.verifications],
          ["Fraud open", summary.fraud],
          ["Invoices", summary.invoices],
          ["Employees", summary.employees],
        ].map(([label, val]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatNumber(Number(val))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <LineChartIcon className="h-4 w-4" />
              Production by status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0D7377" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verification outcomes</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verifyData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  label
                >
                  {verifyData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {kpiTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">KPI actual vs target (sample)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#0D7377" strokeWidth={2} />
                <Line type="monotone" dataKey="target" stroke="#C9A227" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
