"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function ValuationPage() {
  const { auth } = useUser();
  const [balances, setBalances] = useState<Array<Record<string, unknown>>>([]);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: snap }] = await Promise.all([
      supabase
        .from("stock_balances")
        .select(
          "quantity_on_hand, unit_cost, total_value, batch_number, products(name, product_code, valuation_method, standard_cost, average_cost, abc_class), warehouses(name)"
        )
        .order("total_value", { ascending: false })
        .limit(300),
      supabase
        .from("inventory_valuations")
        .select("*")
        .order("valuation_date", { ascending: false })
        .limit(20),
    ]);
    setBalances(data ?? []);
    setSnapshots(snap ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const value = balances.reduce((s, b) => s + Number(b.total_value || 0), 0);
    const qty = balances.reduce((s, b) => s + Number(b.quantity_on_hand || 0), 0);
    const aClass = balances.filter((b) => {
      const p = b.products as { abc_class?: string } | null;
      return p?.abc_class === "A";
    });
    const aValue = aClass.reduce((s, b) => s + Number(b.total_value || 0), 0);
    return { value, qty, aValue, aShare: value ? (aValue / value) * 100 : 0 };
  }, [balances]);

  const snapshot = async () => {
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("inventory_valuations").insert({
      company_id: auth.profile.company_id,
      valuation_date: new Date().toISOString().slice(0, 10),
      method: "weighted_average",
      total_qty: totals.qty,
      total_value: totals.value,
      notes: "Manual valuation snapshot",
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Valuation snapshot saved");
      load();
    }
  };

  const exportCsv = () => {
    const header = "SKU,Name,Warehouse,Method,Qty,UnitCost,Value,ABC\n";
    const body = balances
      .map((b) => {
        const p = b.products as {
          product_code?: string;
          name?: string;
          valuation_method?: string;
          abc_class?: string;
        } | null;
        const w = b.warehouses as { name?: string } | null;
        return [
          p?.product_code,
          `"${p?.name ?? ""}"`,
          w?.name,
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
                const p = b.products as {
                  product_code?: string;
                  name?: string;
                  valuation_method?: string;
                  abc_class?: string;
                } | null;
                const w = b.warehouses as { name?: string } | null;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-mono text-sm">{p?.product_code}</div>
                      <div className="text-sm">{p?.name}</div>
                    </TableCell>
                    <TableCell>{w?.name ?? "—"}</TableCell>
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
                    {s.valuation_date ? formatDate(String(s.valuation_date)) : "—"}
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
                  <TableCell className="text-sm">{String(s.notes ?? "—")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
