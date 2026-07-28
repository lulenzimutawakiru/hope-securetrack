"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

interface Balance {
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  quantity_quarantine: number;
  quantity_damaged: number;
  quantity_in_transit: number;
  quantity_on_order: number;
  quantity_committed: number;
  total_value: number;
  products?: {
    name: string;
    product_code: string;
    reorder_level: number;
    safety_stock: number;
    min_stock: number;
    max_stock: number | null;
    eoq: number | null;
    abc_class: string;
    xyz_class: string;
  } | null;
  warehouses?: { name: string; code: string } | null;
}

export default function StockControlPage() {
  const [rows, setRows] = useState<Balance[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("stock_balances")
        .select(
          `quantity_on_hand, quantity_reserved, quantity_available, quantity_quarantine,
           quantity_damaged, quantity_in_transit, quantity_on_order, quantity_committed, total_value,
           products(name, product_code, reorder_level, safety_stock, min_stock, max_stock, eoq, abc_class, xyz_class),
           warehouses(name, code)`
        )
        .order("total_value", { ascending: false })
        .limit(300);
      setRows((data as unknown as Balance[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.products?.name?.toLowerCase().includes(s) ||
        r.products?.product_code?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
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
                const onHand = Number(r.quantity_on_hand || 0);
                const safety = Number(r.products?.safety_stock || 0);
                const reorder = Number(r.products?.reorder_level || 0);
                const belowSafety = safety > 0 && onHand <= safety;
                const belowReorder = reorder > 0 && onHand <= reorder;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-mono text-sm">{r.products?.product_code}</div>
                      <div className="text-sm">{r.products?.name}</div>
                    </TableCell>
                    <TableCell>{r.warehouses?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="mr-1">
                        {r.products?.abc_class ?? "C"}
                      </Badge>
                      <Badge variant="secondary">{r.products?.xyz_class ?? "Z"}</Badge>
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
                      {formatNumber(Number(r.products?.eoq || 0))}
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
