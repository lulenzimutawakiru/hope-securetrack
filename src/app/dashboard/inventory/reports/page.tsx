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
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type ReportKey =
  | "balance"
  | "movement"
  | "reorder"
  | "slow"
  | "expiry"
  | "abc";

export default function InventoryReportsPage() {
  const [report, setReport] = useState<ReportKey>("balance");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async (key: ReportKey) => {
    setLoading(true);
    const supabase = createClient();
    let data: Array<Record<string, unknown>> | null = null;

    if (key === "balance") {
      const res = await supabase
        .from("stock_balances")
        .select(
          "quantity_on_hand, quantity_available, total_value, batch_number, products(product_code, name), warehouses(code, name)"
        )
        .order("total_value", { ascending: false })
        .limit(200);
      data = res.data;
    } else if (key === "movement") {
      const res = await supabase
        .from("inventory_movements")
        .select(
          "movement_type, quantity, qty_decimal, reference_number, performed_at, notes, products(product_code)"
        )
        .order("performed_at", { ascending: false })
        .limit(200);
      data = res.data;
    } else if (key === "reorder") {
      const res = await supabase
        .from("products")
        .select(
          "product_code, name, reorder_level, safety_stock, reorder_qty, eoq, lead_time_days"
        )
        .gt("reorder_level", 0)
        .order("product_code");
      data = res.data;
    } else if (key === "slow") {
      const res = await supabase
        .from("products")
        .select("product_code, name, is_slow_moving, is_dead_stock, abc_class, average_cost")
        .or("is_slow_moving.eq.true,is_dead_stock.eq.true")
        .order("product_code");
      data = res.data;
    } else if (key === "expiry") {
      const res = await supabase
        .from("stock_balances")
        .select(
          "batch_number, expiry_date, quantity_on_hand, products(product_code, name), warehouses(name)"
        )
        .not("expiry_date", "is", null)
        .order("expiry_date")
        .limit(200);
      data = res.data;
    } else {
      const res = await supabase
        .from("products")
        .select(
          "product_code, name, abc_class, xyz_class, annual_usage_value, average_cost, standard_cost"
        )
        .eq("is_active", true)
        .order("abc_class")
        .order("annual_usage_value", { ascending: false })
        .limit(200);
      data = res.data;
    }

    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load(report);
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
    a.download = `inventory-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const reports: { key: ReportKey; title: string; desc: string }[] = [
    { key: "balance", title: "Stock Balance", desc: "On-hand by SKU & warehouse" },
    { key: "movement", title: "Stock Movement", desc: "Ledger of all movements" },
    { key: "reorder", title: "Reorder Report", desc: "Min / safety / EOQ / lead time" },
    { key: "slow", title: "Slow / Dead Stock", desc: "Low turnover analysis" },
    { key: "expiry", title: "Expiry Report", desc: "Batches nearing expiry" },
    { key: "abc", title: "ABC / XYZ Analysis", desc: "Value & demand variability" },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Reports"
        description="Register · balance · ledger · valuation · movements · batch · serial · slow-moving · dead stock · expiry · ABC · cycle variance · reorder · utilization"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {reports.map((r) => (
          <Card
            key={r.key}
            className={`cursor-pointer transition-colors ${
              report === r.key ? "border-hope-teal ring-1 ring-hope-teal/30" : ""
            }`}
            onClick={() => setReport(r.key)}
          >
            <CardHeader className="pb-1 flex flex-row items-center gap-2 space-y-0">
              <FileBarChart className="h-4 w-4 text-hope-teal" />
              <CardTitle className="text-sm">{r.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{r.desc}</CardContent>
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
                {report === "balance" && (
                  <>
                    <TableHead>SKU</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </>
                )}
                {report === "movement" && (
                  <>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Reference</TableHead>
                  </>
                )}
                {report === "reorder" && (
                  <>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                    <TableHead className="text-right">Safety</TableHead>
                    <TableHead className="text-right">EOQ / qty</TableHead>
                    <TableHead className="text-right">Lead days</TableHead>
                  </>
                )}
                {report === "slow" && (
                  <>
                    <TableHead>SKU</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead className="text-right">Avg cost</TableHead>
                  </>
                )}
                {report === "expiry" && (
                  <>
                    <TableHead>Batch</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </>
                )}
                {report === "abc" && (
                  <>
                    <TableHead>SKU</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead>XYZ</TableHead>
                    <TableHead className="text-right">Annual usage value</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm">
                    No rows for this report
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => {
                  const prod = r.products as
                    | { product_code?: string; name?: string }
                    | null
                    | undefined;
                  const wh = r.warehouses as
                    | { name?: string; code?: string }
                    | null
                    | undefined;
                  return (
                    <TableRow key={i}>
                      {report === "balance" && (
                        <>
                          <TableCell>
                            {prod?.product_code ?? "—"}{" "}
                            <span className="text-muted-foreground text-sm">
                              {prod?.name}
                            </span>
                          </TableCell>
                          <TableCell>{wh?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity_on_hand))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity_available))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.total_value)))}
                          </TableCell>
                        </>
                      )}
                      {report === "movement" && (
                        <>
                          <TableCell className="text-sm whitespace-nowrap">
                            {r.performed_at
                              ? formatDateTime(String(r.performed_at))
                              : "—"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.movement_type).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            {(r.products as { product_code?: string } | null)
                              ?.product_code ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Number(r.qty_decimal ?? r.quantity ?? 0)
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {String(r.reference_number ?? "—")}
                          </TableCell>
                        </>
                      )}
                      {report === "reorder" && (
                        <>
                          <TableCell>
                            {String(r.product_code)} — {String(r.name)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.reorder_level))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.safety_stock))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Number(r.eoq || r.reorder_qty || 0)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.lead_time_days || 0))}
                          </TableCell>
                        </>
                      )}
                      {report === "slow" && (
                        <>
                          <TableCell>
                            {String(r.product_code)} — {String(r.name)}
                          </TableCell>
                          <TableCell className="space-x-1">
                            {r.is_slow_moving ? (
                              <Badge variant="secondary">Slow</Badge>
                            ) : null}
                            {r.is_dead_stock ? (
                              <Badge className="bg-red-100 text-red-800">Dead</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>{String(r.abc_class ?? "—")}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.average_cost || 0))}
                          </TableCell>
                        </>
                      )}
                      {report === "expiry" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.batch_number ?? "—")}
                          </TableCell>
                          <TableCell>
                            {prod?.product_code} {prod?.name}
                          </TableCell>
                          <TableCell>{String(r.expiry_date)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.quantity_on_hand))}
                          </TableCell>
                        </>
                      )}
                      {report === "abc" && (
                        <>
                          <TableCell>
                            {String(r.product_code)} — {String(r.name)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{String(r.abc_class)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{String(r.xyz_class)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Math.round(Number(r.annual_usage_value || 0))
                            )}
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
