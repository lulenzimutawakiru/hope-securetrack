"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    let q = supabase
      .from("stock_balances")
      .select(
        "*, products(name, product_code, item_category, uom), warehouses(name, code), warehouse_bins(code)"
      )
      .order("updated_at", { ascending: false })
      .limit(500);

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

  if (loading) return <LoadingState />;

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.products?.name?.toLowerCase().includes(s) ||
      r.products?.product_code?.toLowerCase().includes(s) ||
      r.batch_number?.toLowerCase().includes(s)
    );
  });

  const totalQty = filtered.reduce((s, r) => s + Number(r.quantity_on_hand || 0), 0);
  const totalVal = filtered.reduce((s, r) => s + Number(r.total_value || 0), 0);
  const quarantine = filtered.reduce((s, r) => s + Number(r.quantity_quarantine || 0), 0);

  return (
    <div>
      <PageHeader
        title="Stock Balances"
        description="On-hand · reserved · available · quarantine · batch & bin location"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/inventory">Back to hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Lines" value={formatNumber(filtered.length)} icon={Boxes} />
        <StatCard title="Total on hand" value={formatNumber(totalQty)} />
        <StatCard title="Inventory value (UGX)" value={formatNumber(Math.round(totalVal))} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, name, batch…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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

      {quarantine > 0 && (
        <p className="text-sm text-amber-700 mb-3">
          Quarantine quantity across view: {formatNumber(quarantine)}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock balances"
          description="Balances appear after GRN acceptance or production output"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">
                    {r.products?.product_code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.products?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {(r.products?.item_category ?? "").replace(/_/g, " ")} ·{" "}
                      {r.products?.uom ?? "EA"}
                    </div>
                  </TableCell>
                  <TableCell>{r.warehouses?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {r.warehouse_bins?.code ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {r.batch_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.quantity_on_hand))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.quantity_available))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(r.unit_cost))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(Math.round(Number(r.total_value)))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
