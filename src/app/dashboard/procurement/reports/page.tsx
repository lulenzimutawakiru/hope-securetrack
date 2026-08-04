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
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type ReportKey = "po" | "pr" | "spend" | "inbound" | "fleet" | "suppliers";

export default function ProcurementReportsPage() {
  const [report, setReport] = useState<ReportKey>("po");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let data: Array<Record<string, unknown>> | null = null;

      if (report === "po") {
        const res = await supabase
          .from("purchase_orders")
          .select("po_number, order_date, total_amount, status, po_type, suppliers(name, code)")
          .order("order_date", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "pr") {
        const res = await supabase
          .from("purchase_requisitions")
          .select("requisition_number, quantity, estimated_total, status, priority, department, products(product_code)")
          .order("created_at", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "spend") {
        const res = await supabase
          .from("purchase_orders")
          .select("total_amount, suppliers(name, code), status")
          .not("status", "eq", "cancelled");
        const bySup: Record<string, { name: string; total: number }> = {};
        for (const r of res.data ?? []) {
          const s = r.suppliers as { name?: string; code?: string } | null;
          const key = s?.code ?? "unknown";
          if (!bySup[key]) bySup[key] = { name: s?.name ?? key, total: 0 };
          bySup[key].total += Number(r.total_amount || 0);
        }
        data = Object.entries(bySup).map(([code, v]) => ({
          code,
          name: v.name,
          total: v.total,
        }));
      } else if (report === "inbound") {
        const res = await supabase
          .from("inbound_shipments")
          .select("shipment_number, carrier_name, status, eta, freight_cost, tracking_number")
          .order("created_at", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "fleet") {
        const res = await supabase
          .from("fleet_vehicles")
          .select("registration, make, model, status, current_odometer, assigned_driver_name")
          .order("registration");
        data = res.data;
      } else {
        const res = await supabase
          .from("suppliers")
          .select("code, name, category, on_time_delivery_pct, overall_score, risk_score")
          .order("overall_score", { ascending: false });
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
    a.download = `procurement-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const cards: { key: ReportKey; title: string; desc: string }[] = [
    { key: "po", title: "Purchase Orders", desc: "PO register" },
    { key: "pr", title: "Requisitions", desc: "PR register" },
    { key: "spend", title: "Spend Analysis", desc: "By supplier" },
    { key: "inbound", title: "Inbound Shipments", desc: "Freight tracking" },
    { key: "fleet", title: "Fleet Utilization", desc: "Vehicle status" },
    { key: "suppliers", title: "Supplier Performance", desc: "KPI scores" },
  ];

  return (
    <div>
      <PageHeader
        title="Procurement & Logistics Reports"
        description="POs · RFQs · spend · GRN · fleet · carrier · delivery performance · CSV export"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/procurement">Hub</Link>
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
                {report === "po" && (
                  <>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "pr" && (
                  <>
                    <TableHead>PR #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Est.</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "spend" && (
                  <>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total spend</TableHead>
                  </>
                )}
                {report === "inbound" && (
                  <>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead className="text-right">Freight</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "fleet" && (
                  <>
                    <TableHead>Reg</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                  </>
                )}
                {report === "suppliers" && (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">OTD %</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Risk</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => {
                  const sup = r.suppliers as { name?: string; code?: string } | null;
                  const prod = r.products as { product_code?: string } | null;
                  return (
                    <TableRow key={i}>
                      {report === "po" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.po_number)}
                          </TableCell>
                          <TableCell>
                            {sup?.code} {sup?.name}
                          </TableCell>
                          <TableCell>
                            {r.order_date ? formatDate(String(r.order_date)) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.total_amount)))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status).replace(/_/g, " ")}
                          </TableCell>
                        </>
                      )}
                      {report === "pr" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.requisition_number)}
                          </TableCell>
                          <TableCell>{prod?.product_code ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.estimated_total)))}
                          </TableCell>
                          <TableCell className="capitalize">{String(r.status)}</TableCell>
                        </>
                      )}
                      {report === "spend" && (
                        <>
                          <TableCell>
                            {String(r.code)} — {String(r.name)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(Math.round(Number(r.total)))}
                          </TableCell>
                        </>
                      )}
                      {report === "inbound" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.shipment_number)}
                          </TableCell>
                          <TableCell>{String(r.carrier_name ?? "—")}</TableCell>
                          <TableCell>
                            {r.eta ? formatDate(String(r.eta)) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.freight_cost)))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status).replace(/_/g, " ")}
                          </TableCell>
                        </>
                      )}
                      {report === "fleet" && (
                        <>
                          <TableCell className="font-mono">
                            {String(r.registration)}
                          </TableCell>
                          <TableCell>
                            {String(r.make ?? "")} {String(r.model ?? "")}
                          </TableCell>
                          <TableCell>{String(r.assigned_driver_name ?? "—")}</TableCell>
                          <TableCell className="capitalize">
                            {String(r.status).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.current_odometer || 0))}
                          </TableCell>
                        </>
                      )}
                      {report === "suppliers" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.code)}
                          </TableCell>
                          <TableCell>{String(r.name)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.on_time_delivery_pct))}%
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.overall_score))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.risk_score))}
                          </TableCell>
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
