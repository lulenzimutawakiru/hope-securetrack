"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileBarChart, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type ReportKey = "forecast" | "mrp" | "drp" | "risk" | "kpi" | "bom";

export default function ScmReportsPage() {
  const [report, setReport] = useState<ReportKey>("forecast");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let data: Array<Record<string, unknown>> | null = null;

      if (report === "forecast") {
        const res = await supabase
          .from("demand_forecasts")
          .select("forecast_code, period_start, forecast_qty, confidence_pct, products(product_code)")
          .order("period_start")
          .limit(200);
        data = res.data;
      } else if (report === "mrp") {
        const res = await supabase
          .from("mrp_recommendations")
          .select("item_description, action, quantity, net_requirement, priority, status, due_date")
          .eq("status", "open")
          .limit(200);
        data = res.data;
      } else if (report === "drp") {
        const res = await supabase
          .from("drp_plans")
          .select("plan_code, recommended_qty, status, products(product_code)")
          .limit(100);
        data = res.data;
      } else if (report === "risk") {
        const res = await supabase
          .from("supply_chain_risks")
          .select("risk_code, title, category, risk_level, status, impact_score")
          .order("impact_score", { ascending: false });
        data = res.data;
      } else if (report === "kpi") {
        const res = await supabase
          .from("scm_kpi_snapshots")
          .select("snapshot_date, inventory_turnover, fill_rate_pct, on_time_delivery_pct, forecast_accuracy_pct")
          .order("snapshot_date", { ascending: false });
        data = res.data;
      } else {
        const res = await supabase
          .from("bom_headers")
          .select("bom_code, version, is_active, products(product_code, name)")
          .eq("is_active", true);
        data = res.data;
      }

      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [report]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
    const header = keys.join(",") + "\n";
    const body = rows
      .map((r) =>
        keys
          .map((k) => {
            const v = r[k];
            if (v == null) return "";
            const s = String(v).replace(/"/g, '""');
            return s.includes(",") ? `"${s}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scm-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const cards: { key: ReportKey; title: string; desc: string }[] = [
    { key: "forecast", title: "Demand Forecast", desc: "Planning horizon" },
    { key: "mrp", title: "MRP Report", desc: "Open recommendations" },
    { key: "drp", title: "DRP Report", desc: "Network transfers" },
    { key: "risk", title: "Risk Register", desc: "Resilience" },
    { key: "kpi", title: "KPI Scorecard", desc: "Executive metrics" },
    { key: "bom", title: "BOM Register", desc: "Manufacturing structure" },
  ];

  return (
    <div>
      <PageHeader
        title="SCM Reports"
        description="Demand · supply · MRP · DRP · capacity · scorecard · risk · sustainability · CSV"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm">Hub</Link>
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {cards.map((c) => (
          <Card
            key={c.key}
            className={`cursor-pointer ${report === c.key ? "border-hope-teal ring-1 ring-hope-teal/30" : ""}`}
            onClick={() => setReport(c.key)}
          >
            <CardHeader className="pb-1 flex flex-row items-center gap-2 space-y-0">
              <FileBarChart className="h-4 w-4 text-hope-teal" />
              <CardTitle className="text-sm">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{c.desc}</CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {report === "forecast" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </>
                )}
                {report === "mrp" && (
                  <>
                    <TableHead>Item</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                  </>
                )}
                {report === "drp" && (
                  <>
                    <TableHead>Plan</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "risk" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Impact</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "kpi" && (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Turnover</TableHead>
                    <TableHead className="text-right">OTD</TableHead>
                    <TableHead className="text-right">Fill</TableHead>
                    <TableHead className="text-right">Forecast acc.</TableHead>
                  </>
                )}
                {report === "bom" && (
                  <>
                    <TableHead>BOM</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Version</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No rows
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => {
                  const prod = r.products as { product_code?: string; name?: string } | null;
                  return (
                    <TableRow key={i}>
                      {report === "forecast" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.forecast_code)}
                          </TableCell>
                          <TableCell>{prod?.product_code ?? "—"}</TableCell>
                          <TableCell>
                            {r.period_start ? formatDate(String(r.period_start)) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.forecast_qty))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.confidence_pct))}%
                          </TableCell>
                        </>
                      )}
                      {report === "mrp" && (
                        <>
                          <TableCell>{String(r.item_description)}</TableCell>
                          <TableCell className="capitalize">{String(r.action)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity))}
                          </TableCell>
                          <TableCell className="capitalize">{String(r.priority)}</TableCell>
                          <TableCell>
                            {r.due_date ? formatDate(String(r.due_date)) : "—"}
                          </TableCell>
                        </>
                      )}
                      {report === "drp" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.plan_code)}
                          </TableCell>
                          <TableCell>{prod?.product_code ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.recommended_qty))}
                          </TableCell>
                          <TableCell className="capitalize">{String(r.status)}</TableCell>
                        </>
                      )}
                      {report === "risk" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.risk_code)}
                          </TableCell>
                          <TableCell>{String(r.title)}</TableCell>
                          <TableCell className="capitalize">{String(r.risk_level)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.impact_score))}
                          </TableCell>
                          <TableCell className="capitalize">{String(r.status)}</TableCell>
                        </>
                      )}
                      {report === "kpi" && (
                        <>
                          <TableCell>
                            {r.snapshot_date ? formatDate(String(r.snapshot_date)) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(r.inventory_turnover ?? "—")}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(r.on_time_delivery_pct ?? "—")}%
                          </TableCell>
                          <TableCell className="text-right">
                            {String(r.fill_rate_pct ?? "—")}%
                          </TableCell>
                          <TableCell className="text-right">
                            {String(r.forecast_accuracy_pct ?? "—")}%
                          </TableCell>
                        </>
                      )}
                      {report === "bom" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.bom_code)}
                          </TableCell>
                          <TableCell>
                            {prod?.product_code} — {prod?.name}
                          </TableCell>
                          <TableCell>v{String(r.version)}</TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
