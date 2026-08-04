"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Gauge, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/crud-compat";
import { useEntityAll } from "@/hooks/use-entity-all";
import { formatNumber } from "@/lib/utils";

const EM = "—";

interface ProductRef {
  id: string;
  name: string;
  product_code: string;
  reorder_level: number | null;
  safety_stock: number | null;
  min_stock: number | null;
  max_stock: number | null;
  eoq: number | null;
  abc_class: string | null;
  xyz_class: string | null;
}

interface TotalsAccumulator {
  onHand: number;
  reserved: number;
  available: number;
  quarantine: number;
  damaged: number;
  inTransit: number;
  onOrder: number;
  committed: number;
  value: number;
}

export default function StockControlPage() {
  const [search, setSearch] = useState("");

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Product names/levels resolve join-free from the
  // RLS-bound browser client (products.view vs the inventory.view gate).
  const balancesQ = useEntityAll<Record<string, unknown>>("stock_balances", {
    sort: "total_value",
    order: "desc",
    max: 300,
    select: "id,product_id,warehouse_id,quantity_on_hand,quantity_reserved,quantity_available,quantity_quarantine,quantity_damaged,quantity_in_transit,quantity_on_order,quantity_committed,total_value",
  });
  const warehousesQ = useEntityAll<{ id: string; name: string; code: string }>(
    "warehouses",
    { select: "id,name,code", sort: "name" }
  );
  const productsQ = useQuery({
    queryKey: ["stock-control", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code, reorder_level, safety_stock, min_stock, max_stock, eoq, abc_class, xyz_class");
      if (error) throw error;
      return (data ?? []) as ProductRef[];
    },
  });

  const warehouses = warehousesQ.data ?? [];
  const productsMap = useMemo(
    () => new Map((productsQ.data ?? []).map((p) => [p.id, p])),
    [productsQ.data]
  );
  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;
  const loading =
    balancesQ.isPending || warehousesQ.isPending || productsQ.isPending;

  const filtered = useMemo(() => {
    const rows = balancesQ.data ?? [];
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => {
      const p = productsMap.get(String(r.product_id));
      return (
        p?.name?.toLowerCase().includes(s) ||
        p?.product_code?.toLowerCase().includes(s)
      );
    });
  }, [balancesQ.data, search, productsMap]);

  const totals = useMemo(() => {
    return filtered.reduce<TotalsAccumulator>(
      (acc, r) => {
        acc.onHand += Number(r.quantity_on_hand || 0);
        acc.reserved += Number(r.quantity_reserved || 0);
        acc.available += Number(r.quantity_available || 0);
        acc.quarantine += Number(r.quantity_quarantine || 0);
        acc.damaged += Number(r.quantity_damaged || 0);
        acc.inTransit += Number(r.quantity_in_transit || 0);
        acc.onOrder += Number(r.quantity_on_order || 0);
        acc.committed += Number(r.quantity_committed || 0);
        acc.value += Number(r.total_value || 0);
        return acc;
      },
      {
        onHand: 0,
        reserved: 0,
        available: 0,
        quarantine: 0,
        damaged: 0,
        inTransit: 0,
        onOrder: 0,
        committed: 0,
        value: 0,
      }
    );
  }, [filtered]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Stock Control"
        description="Available · reserved · damaged · quarantine · committed · in transit · on order · safety stock · min/max · EOQ · ABC/XYZ"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/inventory/replenishment">Replenishment</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 mb-6">
        <StatCard title="Available" value={formatNumber(totals.available)} icon={Gauge} />
        <StatCard title="Reserved / committed" value={formatNumber(totals.reserved + totals.committed)} />
        <StatCard title="Quarantine + damaged" value={formatNumber(totals.quarantine + totals.damaged)} />
        <StatCard title="In transit / on order" value={formatNumber(totals.inTransit + totals.onOrder)} />
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Gauge} title="No stock control lines" description="Balances appear after GRN acceptance" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>ABC/XYZ</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Safety</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">EOQ</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => {
                const p = productsMap.get(String(r.product_id));
                const onHand = Number(r.quantity_on_hand || 0);
                const safety = Number(p?.safety_stock || 0);
                const reorder = Number(p?.reorder_level || 0);
                const belowSafety = safety > 0 && onHand <= safety;
                const belowReorder = reorder > 0 && onHand <= reorder;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-mono text-sm">{p?.product_code}</div>
                      <div className="text-sm">{p?.name}</div>
                    </TableCell>
                    <TableCell>{warehouseName(r.warehouse_id as string)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="mr-1">
                        {p?.abc_class ?? "C"}
                      </Badge>
                      <Badge variant="secondary">{p?.xyz_class ?? "Z"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(onHand)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.quantity_available || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.quantity_reserved || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(safety)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(reorder)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(p?.eoq || 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(Math.round(Number(r.total_value || 0)))}
                    </TableCell>
                    <TableCell>
                      {belowSafety ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">Below safety</Badge>
                      ) : belowReorder ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">Reorder</Badge>
                      ) : (
                        <Badge variant="secondary">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
