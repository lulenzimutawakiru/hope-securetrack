"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { KpiMetric } from "@/components/enterprise/kpi-metric";
import {
  EnterpriseDataGrid,
  type DataGridColumn,
} from "@/components/enterprise/data-grid";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

interface BalanceRow {
  id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  quantity_quarantine: number;
  unit_cost: number;
  total_value: number;
  batch_number: string | null;
  products?: { name: string; product_code: string; item_category: string; uom: string } | null;
  warehouses?: { name: string; code: string } | null;
  warehouse_bins?: { code: string } | null;
}

export default function StockBalancesPage() {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [whFilter, setWhFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    let q = supabase
      .from("stock_balances")
      .select(
        "*, products(name, product_code, item_category, uom), warehouses(name, code), warehouse_bins(code)"
      )
      .order("updated_at", { ascending: false })
      .limit(1000);

    if (whFilter !== "all") q = q.eq("warehouse_id", whFilter);

    const [{ data }, { data: wh }] = await Promise.all([
      q,
      supabase.from("warehouses").select("id,name").eq("is_active", true).order("name"),
    ]);
    setRows((data as BalanceRow[]) ?? []);
    setWarehouses(wh ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whFilter]);

  const totalQty = rows.reduce((s, r) => s + Number(r.quantity_on_hand || 0), 0);
  const totalVal = rows.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const quarantine = rows.reduce((s, r) => s + Number(r.quantity_quarantine || 0), 0);

  const columns = useMemo<DataGridColumn<BalanceRow>[]>(
    () => [
      {
        id: "sku",
        header: "SKU",
        defaultPinned: "left",
        accessorFn: (r) => r.products?.product_code ?? "—",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.products?.product_code ?? "—"}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        accessorFn: (r) => r.products?.name ?? "—",
        cell: ({ row }) => (
          <span className="font-medium text-sm">
            {row.original.products?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "warehouse",
        header: "Warehouse",
        accessorFn: (r) => r.warehouses?.name ?? "—",
      },
      {
        id: "bin",
        header: "Bin",
        accessorFn: (r) => r.warehouse_bins?.code ?? "—",
      },
      {
        accessorKey: "batch_number",
        header: "Batch",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "quantity_on_hand",
        header: "On hand",
        cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
      },
      {
        accessorKey: "quantity_reserved",
        header: "Reserved",
        cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
      },
      {
        accessorKey: "quantity_available",
        header: "Available",
        cell: ({ getValue }) => (
          <span className="font-medium">{formatNumber(Number(getValue() ?? 0))}</span>
        ),
      },
      {
        accessorKey: "quantity_quarantine",
        header: "Quarantine",
        cell: ({ getValue }) => formatNumber(Number(getValue() ?? 0)),
      },
      {
        accessorKey: "total_value",
        header: "Value (UGX)",
        cell: ({ getValue }) => formatNumber(Math.round(Number(getValue() ?? 0))),
      },
    ],
    []
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Balances"
        description="Enterprise grid · on-hand · reserved · quarantine · virtual scroll · export"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/boards">Boards</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiMetric title="Lines" value={formatNumber(rows.length)} icon={Boxes} />
        <KpiMetric title="Total on hand" value={formatNumber(totalQty)} />
        <KpiMetric
          title="Inventory value"
          value={formatNumber(Math.round(totalVal))}
          description="UGX"
        />
        <KpiMetric
          title="Quarantine qty"
          value={formatNumber(quarantine)}
          tone={quarantine > 0 ? "warning" : "default"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={whFilter} onValueChange={setWhFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Warehouse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EnterpriseDataGrid
        data={rows}
        columns={columns}
        storageKey="grid:stock-balances"
        height={520}
        exportFilename="stock-balances"
        emptyMessage="No stock balance lines"
      />
    </div>
  );
}
