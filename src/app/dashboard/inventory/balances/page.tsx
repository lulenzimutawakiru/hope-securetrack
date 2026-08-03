"use client";

import { useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { useEntityAll } from "@/hooks/use-entity-all";

interface BalanceRow {
  id: string;
  product_id: string | null;
  warehouse_id: string | null;
  bin_id: string | null;
  batch_number: string | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
  quantity_available: number | null;
  quantity_quarantine: number | null;
  unit_cost: number | null;
  total_value: number | null;
  /** Resolved client-side reference labels (the CRUD surface is join-free). */
  product_code?: string | null;
  product_name?: string | null;
  warehouse_name?: string | null;
  bin_code?: string | null;
}

interface ProductRef {
  id: string;
  name: string;
  product_code: string;
  item_category: string;
  uom: string;
}

export default function StockBalancesPage() {
  const [whFilter, setWhFilter] = useState("all");

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, rows are permission-checked and dual-key (tenant + company)
  // scoped. The legacy query used PostgREST joins (products, warehouses,
  // warehouse_bins); the CRUD surface is join-free, so reference labels are
  // resolved client-side from CRUD reads (warehouses and warehouse_bins gate
  // on inventory.view) plus the RLS-bound browser client for products, whose
  // CRUD read gate (products.view) the warehouse roles here may not hold.
  const balancesQ = useEntityAll<BalanceRow>("stock_balances", {
    sort: "updated_at",
    order: "desc",
    max: 1000,
    filters: whFilter !== "all" ? { warehouse_id: whFilter } : undefined,
  });
  const warehousesQ = useEntityAll<{ id: string; name: string }>("warehouses", {
    select: "id,name",
    sort: "name",
    filters: { is_active: true },
  });
  const binsQ = useEntityAll<{ id: string; code: string }>("warehouse_bins", {
    select: "id,code",
  });
  const productsQ = useQuery({
    queryKey: ["stock-balances", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_code,item_category,uom");
      if (error) throw error;
      return (data ?? []) as ProductRef[];
    },
  });

  const rows = balancesQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const bins = binsQ.data ?? [];
  const products = productsQ.data ?? [];
  const warehousesMap = new Map(warehouses.map((w) => [w.id, w]));
  const binsMap = new Map(bins.map((b) => [b.id, b]));
  const productsMap = new Map(products.map((p) => [p.id, p]));

  const totalQty = rows.reduce((s, r) => s + Number(r.quantity_on_hand || 0), 0);
  const totalVal = rows.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const quarantine = rows.reduce((s, r) => s + Number(r.quantity_quarantine || 0), 0);

  // Resolve reference labels inline: the CRUD surface is join-free, and the
  // 1000-row map is trivial to recompute per render (no memo needed).
  const resolvedRows = rows.map((r) => ({
    ...r,
    product_code: productsMap.get(r.product_id ?? "")?.product_code ?? null,
    product_name: productsMap.get(r.product_id ?? "")?.name ?? null,
    warehouse_name: warehousesMap.get(r.warehouse_id ?? "")?.name ?? null,
    bin_code: binsMap.get(r.bin_id ?? "")?.code ?? null,
  }));

  const columns = useMemo<DataGridColumn<BalanceRow>[]>(
    () => [
      {
        id: "sku",
        header: "SKU",
        defaultPinned: "left",
        accessorKey: "product_code",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        id: "product",
        header: "Product",
        accessorKey: "product_name",
        cell: ({ getValue }) => (
          <span className="font-medium text-sm">
            {String(getValue() ?? "—")}
          </span>
        ),
      },
      {
        id: "warehouse",
        header: "Warehouse",
        accessorFn: (r) => r.warehouse_name ?? "—",
      },
      {
        id: "bin",
        header: "Bin",
        accessorFn: (r) => r.bin_code ?? "—",
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

  if (balancesQ.isLoading) return <LoadingState />;

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
        data={resolvedRows}
        columns={columns}
        storageKey="grid:stock-balances"
        height={520}
        exportFilename="stock-balances"
        emptyMessage="No stock balance lines"
      />
    </div>
  );
}
