"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
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
} from "recharts";

const COLORS = ["#0B1F3A", "#C9A227", "#0D7377", "#64748B", "#22c55e", "#ef4444"];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [verifyData, setVerifyData] = useState<{ name: string; value: number }[]>([]);
  const [summary, setSummary] = useState({
    batches: 0,
    qr: 0,
    verifications: 0,
    fraud: 0,
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

      const [batches, qr, verifications, fraud] = await Promise.all([
        supabase.from("production_batches").select("*", { count: "exact", head: true }),
        supabase.from("qr_codes").select("*", { count: "exact", head: true }),
        supabase.from("verification_logs").select("*", { count: "exact", head: true }),
        supabase
          .from("fraud_alerts")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
      ]);

      setStatusData(statusCounts.filter((s) => s.value > 0));
      setVerifyData(resultCounts.filter((r) => r.value > 0));
      setSummary({
        batches: batches.count ?? 0,
        qr: qr.count ?? 0,
        verifications: verifications.count ?? 0,
        fraud: fraud.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const exportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total Batches", summary.batches],
      ["Total QR Codes", summary.qr],
      ["Total Verifications", summary.verifications],
      ["Open Fraud Alerts", summary.fraud],
      ...statusData.map((s) => [`Batch: ${s.name}`, s.value]),
      ...verifyData.map((v) => [`Verify: ${v.name}`, v.value]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `securetrack-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Production, verification, and fraud overview"
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(summary.batches)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(summary.qr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(summary.verifications)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(summary.fraud)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Production by Status
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0D7377" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification Results</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {verifyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verifyData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
