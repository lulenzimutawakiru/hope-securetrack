"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useEntityAll } from "@/hooks/use-entity-all";
import { entityKeys } from "@/lib/api/query-keys";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const EM = "—";

interface ProductRef {
  id: string;
  name: string;
  product_code: string;
  valuation_method: string | null;
  standard_cost: number | null;
  average_cost: number | null;
  abc_class: string | null;
}

export default function ValuationPage() {
  const { auth } = useUser();
  const queryClient = useQueryClient();

  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side, every row is permission-checked (inventory.view) and
  // dual-key scoped. Product/warehouse names resolve join-free from the
  // reference sets (products stay on the RLS-bound browser client).
  const balancesQ = useEntityAll<Record<string, unknown>>("stock_balances", {
    sort: "total_value",
    order: "desc",
    max: 300,
    select: "id,product_id,warehouse_id,quantity_on_hand,unit_cost,total_value,batch_number",
  });
  const snapshotsQ = useEntityAll<Record<string, unknown>>("inventory_valuations", {
    sort: "valuation_date",
    order: "desc",
    max: 20,
  });
  const warehousesQ = useEntityAll<{ id: string; name: string }>("warehouses", {
    select: "id,name",
    sort: "name",
  });
  const productsQ = useQuery({
    queryKey: ["inventory-valuation", "products-reference"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code, valuation_method, standard_cost, average_cost, abc_class");
      if (error) throw error;
      return (data ?? []) as ProductRef[];
    },
  });

  const balances = balancesQ.data ?? [];
  const snapshots = snapshotsQ.data ?? [];
  const warehouses = warehousesQ.data ?? [];
  const productsMap = useMemo(
    () => new Map((productsQ.data ?? []).map((p) => [p.id, p])),
    [productsQ.data]
  );
  const warehouseName = (id: string | null | undefined) =>
    warehouses.find((w) => w.id === id)?.name ?? EM;
  const loading =
    balancesQ.isPending ||
    snapshotsQ.isPending ||
    warehousesQ.isPending ||
    productsQ.isPending;

  const totals = useMemo(() => {
    const rows = balancesQ.data ?? [];
    const value = rows.reduce((s, b) => s + Number(b.total_value || 0), 0);
    const qty = rows.reduce((s, b) => s + Number(b.quantity_on_hand || 0), 0);
    const aClass = rows.filter((b) => {
      const p = productsMap.get(String(b.product_id));
      return p?.abc_class === "A";
    });
    const aValue = aClass.reduce((s, b) => s + Number(b.total_value || 0), 0);
    return { value, qty, aValue, aShare: value ? (aValue / value) * 100 : 0 };
  }, [balancesQ.data, productsMap]);

  const snapshot = async () => {
    if (!auth) return;
    const crudRes = await crudCreate("inventory_valuations", {
      company_id: auth.profile.company_id,
      valuation_date: new Date().toISOString().slice(0, 10),
      method: "weighted_average",
      total_qty: totals.qty,
      total_value: totals.value,
      notes: "Manual valuation snapshot",
      created_by: auth.profile.id,
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Valuation snapshot saved");
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("inventory_valuations"),
      });
      queryClient.invalidateQueries({
        queryKey: entityKeys.entity("stock_balances"),
      });
    }
  };

  const exportCsv = () => {
    const header = "SKU,Name,Warehouse,Method,Qty,UnitCost,Value,ABC\n";
    const body = balances
      .map((b) => {
        const p = productsMap.get(String(b.product_id));
        const w = warehouseName(b.warehouse_id as string);
        return [
          p?.product_code,
          `"${p?.name ?? ""}"`,
          w,
          p?.valuation_method,
          b.quantity_on_hand,
          b.unit_cost,
          b.total_value,
          p?.abc_class,
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-valuation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Inventory Valuation"
        description="FIFO · weighted average · specific identification · inventory value · COGS support · landed cost fields"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">Hub</Link>
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button size="sm" onClick={snapshot}>
              Snapshot
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Inventory value (UGX)"
          value={formatNumber(Math.round(totals.value))}
          icon={Calculator}
        />
        <StatCard title="Total quantity" value={formatNumber(totals.qty)} />
        <StatCard
          title="A-class value"
          value={formatNumber(Math.round(totals.aValue))}
        />
        <StatCard
          title="A-class share"
          value={`${totals.aShare.toFixed(1)}%`}
        />
      </div>

      {balances.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No valued stock"
          description="Accept GRNs or post production to build inventory value"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>ABC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b, i) => {
                const p = productsMap.get(String(b.product_id));
                const w = warehouseName(b.warehouse_id as string);
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-mono text-sm">{p?.product_code}</div>
                      <div className="text-sm">{p?.name}</div>
                    </TableCell>
                    <TableCell>{w}</TableCell>
                    <TableCell className="capitalize text-sm">
                      {(p?.valuation_method ?? "weighted_average").replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p?.abc_class ?? "C"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(b.quantity_on_hand))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(b.unit_cost))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(Math.round(Number(b.total_value)))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Valuation snapshots</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No snapshots yet
                </TableCell>
              </TableRow>
            ) : (
              snapshots.map((s) => (
                <TableRow key={String(s.id)}>
                  <TableCell>
                    {s.valuation_date ? formatDate(String(s.valuation_date)) : EM}
                  </TableCell>
                  <TableCell className="capitalize">
                    {String(s.method).replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(s.total_qty))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Math.round(Number(s.total_value)))}
                  </TableCell>
                  <TableCell className="text-sm">{String(s.notes ?? EM)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
