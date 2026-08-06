"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function SopPage() {
  const { auth } = useUser();
  const [cycles, setCycles] = useState<Array<Record<string, unknown>>>([]);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sop_cycles")
      .select("*")
      .order("period_start", { ascending: false });
    setCycles(data ?? []);
    setLoading(false);
  };

  const loadLines = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sop_line_items")
      .select("*, products(name, product_code)")
      .eq("sop_id", id);
    setLines(data ?? []);
    setSelected(id);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    if (!auth) return;
    const crudRes = await crudUpdate("sop_cycles", id, {
        status: "approved",
        approved_by: auth.profile.id,
        approved_at: new Date().toISOString(),
      });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("S&OP plan approved");
      load();
    }
  };

  if (loading) return <LoadingState />;

  const active = cycles[0];

  return (
    <div>
      <PageHeader
        title="Sales & Operations Planning"
        description="Synchronize demand · inventory · production · procurement · financial budgets"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/scm">Hub</Link>
          </Button>
        }
      />

      {active && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <StatCard title="Demand total" value={formatNumber(Number(active.demand_total))} />
          <StatCard title="Supply total" value={formatNumber(Number(active.supply_total))} />
          <StatCard
            title="Capacity util."
            value={`${Number(active.capacity_utilization_pct)}%`}
          />
          <StatCard
            title="Inventory plan"
            value={formatNumber(Math.round(Number(active.inventory_plan_value)))}
          />
        </div>
      )}

      {cycles.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No S&OP cycles"
          description="Create a planning cycle for the quarter"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((c) => (
                  <TableRow
                    key={String(c.id)}
                    className="cursor-pointer"
                    onClick={() => loadLines(String(c.id))}
                  >
                    <TableCell>
                      <div className="font-mono text-sm">{String(c.cycle_code)}</div>
                      <div className="text-sm">{String(c.name)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(String(c.period_start))} →{" "}
                      {formatDate(String(c.period_end))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(c.status)} />
                    </TableCell>
                    <TableCell>
                      {["draft", "review"].includes(String(c.status)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            approve(String(c.id));
                          }}
                        >
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selected ? "Plan lines" : "Select a cycle"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Demand vs supply gaps by product family.
                </p>
              ) : lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line items</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((l) => {
                    const prod = l.products as {
                      name?: string;
                      product_code?: string;
                    } | null;
                    return (
                      <div key={String(l.id)} className="rounded border p-3 text-sm space-y-1">
                        <div className="font-medium">
                          {prod?.product_code} — {prod?.name}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                          <span>Demand: {formatNumber(Number(l.demand_qty))}</span>
                          <span>Supply: {formatNumber(Number(l.supply_qty))}</span>
                          <span>Produce: {formatNumber(Number(l.production_qty))}</span>
                          <span>Purchase: {formatNumber(Number(l.purchase_qty))}</span>
                          <span className="text-amber-700 font-medium">
                            Gap: {formatNumber(Number(l.gap_qty))}
                          </span>
                          <span>End inv: {formatNumber(Number(l.ending_inventory))}</span>
                        </div>
                        {l.notes != null && String(l.notes) !== "" && (
                          <p className="text-xs text-muted-foreground">{String(l.notes)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {active?.executive_notes != null &&
                String(active.executive_notes) !== "" &&
                selected === active.id && (
                <p className="mt-4 text-sm border-t pt-3">
                  <span className="font-medium">Executive notes: </span>
                  {String(active.executive_notes)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
