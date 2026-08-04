"use client";

import { useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/crud-compat";
import { useEntityAll } from "@/hooks/use-entity-all";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const EM = "—";

type ReportKey =
  | "balance"
  | "movement"
  | "reorder"
  | "slow"
  | "expiry"
  | "abc";

export default function InventoryReportsPage() {
  const [report, setReport] = useState<ReportKey>("balance");

  // Balance / expiry read stock_balances and movement reads
  // inventory_movements through the hardened CRUD API: tenant/company are
  // derived server-side, every row is permission-checked (inventory.view)
  // and dual-key scoped. Reorder / slow / ABC are product-centric and stay
  // on the RLS-bound browser client (products.view). Product/warehouse
  // names resolve join-free from the reference sets below.
  const balanceQ = useEntityAll<Record<string, unknown>>(
    "stock_balances",
    {
      sort: "total_value",
      order: "desc",
      max: 200,
      select: "id,product_id,warehouse_id,quantity_on_hand,quantity_available,total_value,batch_number",
    },
    { enabled: report === "balance" }
  );
  const movementQ = useEntityAll<Record<string, unknown>>(
    "inventory_movements",
    {
      sort: "performed_at",
      order: "desc",
      max: 200,
      select: "id,product_id,movement_type,quantity,qty_decimal,reference_number,performed_at",
    },
    { enabled: report === "movement" }
  );
  const expiryQ = useEntityAll<Record<string, unknown>>(
    "stock_balances",
    {
      sort: "expiry_date",
      order: "asc",
      max: 1000,
      select: "id,product_id,warehouse_id,batch_number,expiry_date,quantity_on_hand",
    },
    { enabled: report === "expiry" }
  );
  const reorderQ = useQuery({
    queryKey: ["inventory-reports", "reorder"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("product_code, name, reorder_level, safety_stock, reorder_qty, eoq, lead_time_days")
        .gt("reorder_level", 0)
        .order("product_code");
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: report === "reorder",
  });
  const slowQ = useQuery({
    queryKey: ["inventory-reports", "slow"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("product_code, name, is_slow_moving, is_dead_stock, abc_class, average_cost")
        .or("is_slow_moving.eq.true,is_dead_stock.eq.true")
        .order("product_code");
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: report === "slow",
  });
  const abcQ = useQuery({
    queryKey: ["inventory-reports", "abc"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("product_code, name, abc_class, xyz_class, annual_usage_value, average_cost, standard_cost")
        .eq("is_active", true)
        .order("abc_class")
        .order("annual_usage_value", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: report === "abc",
  });

  // Reference sets: products (RLS browser client, role-agnostic read) and
  // warehouses (CRUD) resolve ids on balance / movement / expiry rows.
  const productsRefQ = useQuery({
    queryKey: ["inventory-reports", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, name");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        product_code: string;
        name: string;
      }>;
    },
  });
  const warehousesRefQ = useEntityAll<{ id: string; name: string; code: string }>(
    "warehouses",
    { select: "id,name,code", sort: "name" }
  );

  const productsMap = useMemo(
    () => new Map((productsRefQ.data ?? []).map((p) => [p.id, p])),
    [productsRefQ.data]
  );
  const warehouses = warehousesRefQ.data ?? [];
  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;

  // The active report's rows; expiry strips rows without a batch expiry
  // date (the CRUD engine supports eq/in filters only).
  const rows = useMemo(() => {
    if (report === "balance") return balanceQ.data ?? [];
    if (report === "movement") return movementQ.data ?? [];
    if (report === "expiry") {
      return (expiryQ.data ?? []).filter((r) => r.expiry_date != null);
    }
    if (report === "reorder") return reorderQ.data ?? [];
    if (report === "slow") return slowQ.data ?? [];
    return abcQ.data ?? [];
  }, [
    report,
    balanceQ.data,
    movementQ.data,
    expiryQ.data,
    reorderQ.data,
    slowQ.data,
    abcQ.data,
  ]);

  const activePending =
    report === "balance"
      ? balanceQ.isPending
      : report === "movement"
        ? movementQ.isPending
        : report === "expiry"
          ? expiryQ.isPending
          : report === "reorder"
            ? reorderQ.isPending
            : report === "slow"
              ? slowQ.isPending
              : abcQ.isPending;
  const loading = activePending || productsRefQ.isPending || warehousesRefQ.isPending;

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    // Scalar join ids are internal UUIDs; drop them so exports keep the
    // original column set (product/warehouse names now come from maps).
    const keys = Object.keys(rows[0]).filter(
      (k) =>
        !["id", "product_id", "warehouse_id"].includes(k) &&
        typeof rows[0][k] !== "object"
    );
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
                  const prod = productsMap.get(String(r.product_id));
                  const wh = warehouseName(r.warehouse_id as string);
                  return (
                    <TableRow key={i}>
                      {report === "balance" && (
                        <>
                          <TableCell>
                            {prod?.product_code ?? EM}{" "}
                            <span className="text-muted-foreground text-sm">
                              {prod?.name}
                            </span>
                          </TableCell>
                          <TableCell>{wh}</TableCell>
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
                              : EM}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.movement_type).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            {prod?.product_code ?? EM}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(
                              Number(r.qty_decimal ?? r.quantity ?? 0)
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {String(r.reference_number ?? EM)}
                          </TableCell>
                        </>
                      )}
                      {report === "reorder" && (
                        <>
                          <TableCell>
                            {String(r.product_code)} {EM} {String(r.name)}
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
                            {String(r.product_code)} {EM} {String(r.name)}
                          </TableCell>
                          <TableCell className="space-x-1">
                            {r.is_slow_moving ? (
                              <Badge variant="secondary">Slow</Badge>
                            ) : null}
                            {r.is_dead_stock ? (
                              <Badge className="bg-red-100 text-red-800">Dead</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>{String(r.abc_class ?? EM)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.average_cost || 0))}
                          </TableCell>
                        </>
                      )}
                      {report === "expiry" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.batch_number ?? EM)}
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
                            {String(r.product_code)} {EM} {String(r.name)}
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
