"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function DrpPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("drp_plans")
      .select(
        "*, products(name, product_code), from_wh:warehouses!drp_plans_from_warehouse_id_fkey(name, code), to_wh:warehouses!drp_plans_to_warehouse_id_fkey(name, code)"
      )
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const crudRes = await crudUpdate("drp_plans", id, { status });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`DRP ${status}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Distribution Requirements Planning"
        description="Warehouse replenishment · inter-warehouse transfers · stock balancing · regional demand"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/scm">Hub</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/inventory/transfers">Execute transfer</Link>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No DRP plans"
          description="Network balancing recommendations appear after planning runs"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>From → To</TableHead>
                <TableHead className="text-right">From stock</TableHead>
                <TableHead className="text-right">To stock</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Recommend</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const prod = r.products as { name?: string; product_code?: string } | null;
                const fromWh = r.from_wh as { name?: string; code?: string } | null;
                const toWh = r.to_wh as { name?: string; code?: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.plan_code)}
                    </TableCell>
                    <TableCell>
                      {prod?.product_code}{" "}
                      <span className="text-muted-foreground text-sm">{prod?.name}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {fromWh?.code ?? "—"} → {toWh?.code ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.current_stock_from))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.current_stock_to))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.forecast_demand_to))}
                    </TableCell>
                    <TableCell className="text-right font-medium text-hope-teal">
                      {formatNumber(Number(r.recommended_qty))}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.period_start ? formatDate(String(r.period_start)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="space-x-1">
                      {r.status === "proposed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(String(r.id), "approved")}
                        >
                          Approve
                        </Button>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" onClick={() => setStatus(String(r.id), "transferred")}>
                          Mark transferred
                        </Button>
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
