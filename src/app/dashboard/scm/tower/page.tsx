"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ControlTowerPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [exceptions, setExceptions] = useState<Array<{ type: string; title: string; status: string; meta?: string }>>([]);
  const [pos, setPos] = useState<Array<Record<string, unknown>>>([]);
  const [shipments, setShipments] = useState<Array<Record<string, unknown>>>([]);
  const [risks, setRisks] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        { data: kpi },
        { data: poRows },
        { data: shipRows },
        { data: riskRows },
        { data: mrpRows },
        { count: openOrders },
        { data: bal },
      ] = await Promise.all([
        supabase
          .from("scm_kpi_snapshots")
          .select("*")
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("purchase_orders")
          .select("po_number, status, total_amount, expected_date, suppliers(name)")
          .not("status", "in", '("closed","cancelled","received")')
          .order("expected_date")
          .limit(8),
        supabase
          .from("inbound_shipments")
          .select("shipment_number, status, eta, carrier_name, tracking_number")
          .in("status", ["in_transit", "booked", "delayed", "customs"])
          .limit(8),
        supabase
          .from("supply_chain_risks")
          .select("title, risk_level, status, category")
          .in("status", ["open", "mitigating"])
          .order("impact_score", { ascending: false })
          .limit(6),
        supabase
          .from("mrp_recommendations")
          .select("item_description, action, quantity, priority, status")
          .eq("status", "open")
          .limit(6),
        supabase
          .from("sales_orders")
          .select("*", { count: "exact", head: true })
          .in("status", ["confirmed", "picking", "dispatched"]),
        supabase.from("stock_balances").select("total_value, quantity_on_hand"),
      ]);

      const invValue = (bal ?? []).reduce((s, b) => s + Number(b.total_value || 0), 0);

      setKpis({
        otd: Number(kpi?.on_time_delivery_pct ?? 0),
        fill: Number(kpi?.fill_rate_pct ?? 0),
        turnover: Number(kpi?.inventory_turnover ?? 0),
        doh: Number(kpi?.days_of_inventory ?? 0),
        stockout: Number(kpi?.stockout_rate_pct ?? 0),
        invValue,
        openOrders: openOrders ?? 0,
      });

      const ex: typeof exceptions = [];
      for (const r of riskRows ?? []) {
        ex.push({
          type: "Risk",
          title: String(r.title),
          status: String(r.risk_level),
          meta: String(r.category),
        });
      }
      for (const m of mrpRows ?? []) {
        if (m.priority === "high") {
          ex.push({
            type: "MRP",
            title: `${String(m.action)} ${String(m.item_description)}`,
            status: "high",
            meta: `Qty ${m.quantity}`,
          });
        }
      }
      for (const s of shipRows ?? []) {
        if (s.status === "delayed") {
          ex.push({
            type: "Shipment",
            title: String(s.shipment_number),
            status: "delayed",
            meta: String(s.carrier_name ?? ""),
          });
        }
      }
      setExceptions(ex.slice(0, 10));
      setPos(poRows ?? []);
      setShipments(shipRows ?? []);
      setRisks(riskRows ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading control tower…" />;

  return (
    <div>
      <PageHeader
        title="Supply Chain Control Tower"
        description="Real-time POs · shipments · inventory · production · risks · exception management"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/scm">Hub</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="OTD %" value={`${kpis.otd}%`} icon={Radar} />
        <StatCard title="Fill rate %" value={`${kpis.fill}%`} />
        <StatCard title="Inventory turnover" value={String(kpis.turnover)} />
        <StatCard title="Days of inventory" value={String(kpis.doh)} />
        <StatCard title="Stockout rate %" value={`${kpis.stockout}%`} />
        <StatCard title="Open customer orders" value={formatNumber(kpis.openOrders)} />
        <StatCard
          title="Inventory value"
          value={formatNumber(Math.round(kpis.invValue))}
        />
        <StatCard title="Active exceptions" value={formatNumber(exceptions.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exception queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical exceptions</p>
            ) : (
              exceptions.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-2 rounded border p-2 text-sm">
                  <div>
                    <Badge variant="outline" className="mr-2">
                      {e.type}
                    </Badge>
                    <span className="font-medium">{e.title}</span>
                    {e.meta ? (
                      <div className="text-xs text-muted-foreground mt-0.5">{e.meta}</div>
                    ) : null}
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open risks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm rounded border p-2">
                <span>{String(r.title)}</span>
                <StatusBadge status={String(r.risk_level)} />
              </div>
            ))}
            {risks.length === 0 && (
              <p className="text-sm text-muted-foreground">No open risks</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-medium mb-2">Purchase orders in flight</h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No open POs
                    </TableCell>
                  </TableRow>
                ) : (
                  pos.map((p, i) => {
                    const sup = p.suppliers as { name?: string } | null;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">
                          {String(p.po_number)}
                        </TableCell>
                        <TableCell>{sup?.name ?? "—"}</TableCell>
                        <TableCell>
                          {p.expected_date ? formatDate(String(p.expected_date)) : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={String(p.status)} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">Inbound shipments</h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      No active shipments
                    </TableCell>
                  </TableRow>
                ) : (
                  shipments.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">
                        {String(s.shipment_number)}
                      </TableCell>
                      <TableCell>{String(s.carrier_name ?? "—")}</TableCell>
                      <TableCell>
                        {s.eta ? formatDate(String(s.eta)) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(s.status)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
