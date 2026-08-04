"use client";

import Link from "next/link";
import {
  Warehouse,
  Package,
  ClipboardCheck,
  ArrowRightLeft,
  SlidersHorizontal,
  MapPin,
  Brain,
  ArrowRight,
  QrCode,
  Boxes,
  Gauge,
  BookmarkPlus,
  RefreshCw,
  ClipboardList,
  GitBranch,
  Calculator,
  FileBarChart,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { crudCount } from "@/lib/api/crud-client";
import { formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEntityAll } from "@/hooks/use-entity-all";
import { useEntityList } from "@/hooks/use-entity-query";

const FLOW = [
  "Procurement",
  "Goods Receipt",
  "Quality Inspection",
  "Warehouse Storage",
  "Inventory Control",
  "Production / Sales",
  "Dispatch",
  "Finance",
];

const MODULES = [
  { title: "Stock Control", href: "/dashboard/inventory/control", icon: Gauge, desc: "Available, reserved, safety, ABC/XYZ" },
  { title: "Stock Balances", href: "/dashboard/inventory/balances", icon: Boxes, desc: "On-hand by warehouse, bin & batch" },
  { title: "Serialized Stock", href: "/dashboard/inventory/stock", icon: QrCode, desc: "Reams, cartons & QR chain of custody" },
  { title: "Goods Receipt (GRN)", href: "/dashboard/inventory/grn", icon: ClipboardCheck, desc: "Inbound receiving & QC acceptance" },
  { title: "Reservations", href: "/dashboard/inventory/reservations", icon: BookmarkPlus, desc: "Sales, production, project holds" },
  { title: "Replenishment", href: "/dashboard/inventory/replenishment", icon: RefreshCw, desc: "Reorder · PRs · AI recommendations" },
  { title: "Transfers", href: "/dashboard/inventory/transfers", icon: ArrowRightLeft, desc: "Inter-warehouse movements" },
  { title: "Cycle Counts", href: "/dashboard/inventory/cycle-counts", icon: ClipboardList, desc: "Stocktaking · variances · shrinkage" },
  { title: "Adjustments", href: "/dashboard/inventory/adjustments", icon: SlidersHorizontal, desc: "Write-offs & corrections" },
  { title: "Traceability", href: "/dashboard/inventory/traceability", icon: GitBranch, desc: "Batch & serial end-to-end" },
  { title: "Valuation", href: "/dashboard/inventory/valuation", icon: Calculator, desc: "FIFO / avg cost · inventory value" },
  { title: "Locations", href: "/dashboard/inventory/locations", icon: MapPin, desc: "Warehouses, zones, racks & bins" },
  { title: "Reports", href: "/dashboard/inventory/reports", icon: FileBarChart, desc: "Balance, movement, ABC, reorder" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
}

interface BalanceValueRow {
  total_value: number | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
}

export default function InventoryHubPage() {
  // Reads flow through the hardened CRUD API: tenant/company are derived
  // server-side; every row is permission-checked and dual-key scoped.
  const warehousesQ = useEntityList<{ id: string }>("warehouses", {
    pageSize: 1,
    filters: { is_active: true },
  });
  const balancesQ = useEntityAll<BalanceValueRow>("stock_balances", {
    select: "total_value,quantity_on_hand,quantity_reserved",
    max: 500,
  });
  const grnQ = useEntityList<{ id: string }>("goods_receipts", {
    pageSize: 1,
    filters: { status: ["draft", "pending_inspection", "partially_accepted"] },
  });
  const transfersQ = useEntityList<{ id: string }>("stock_transfers", {
    pageSize: 1,
    filters: { status: ["draft", "in_transit"] },
  });
  const resvQ = useEntityList<{ id: string }>("stock_reservations", {
    pageSize: 1,
    filters: { status: "active" },
  });
  const reamsQ = useEntityList<{ id: string }>("reams", {
    pageSize: 1,
    filters: { inventory_status: "in_warehouse" },
  });
  const insightsQ = useEntityAll<Insight>("inventory_insights", {
    sort: "created_at",
    order: "desc",
    filters: { status: "open" },
    max: 6,
  });
  const productsQ = useQuery({
    queryKey: ["inventory-hub", "products-count"],
    queryFn: () => crudCount("products"),
  });
  const prQ = useQuery({
    queryKey: ["inventory-hub", "pr-count"],
    queryFn: () =>
      crudCount("purchase_requisitions", {
        status: ["draft", "submitted", "approved"],
      }),
  });

  const balances = balancesQ.data ?? [];
  const onHandValue = balances.reduce(
    (s, b) => s + Number(b.total_value || 0),
    0
  );

  // The legacy read pulled every balance row (unbounded) to aggregate on-hand
  // value; the CRUD layer caps page walks at 500 rows, which is more than
  // sufficient for this KPI while keeping the read permission-checked.
  const stats = {
    skus: productsQ.data ?? 0,
    warehouses: warehousesQ.data?.total ?? 0,
    onHandValue,
    openGrn: grnQ.data?.total ?? 0,
    openTransfers: transfersQ.data?.total ?? 0,
    openPr: prQ.data ?? 0,
    activeReservations: resvQ.data?.total ?? 0,
    reamsWh: reamsQ.data?.total ?? 0,
  };
  const insights = insightsQ.data ?? [];

  const loading = [
    warehousesQ,
    balancesQ,
    grnQ,
    transfersQ,
    resvQ,
    reamsQ,
    insightsQ,
    productsQ,
    prQ,
  ].some((q) => q.isLoading);

  if (loading) return <LoadingState message="Loading inventory command centre…" />;

  return (
    <div>
      <PageHeader
        title="Inventory & Stock Management"
        description="Real-time multi-warehouse control · GRN · reservations · replenishment · valuation · traceability"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory/grn">New GRN</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory/replenishment">Replenish</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/inventory/control">Stock control</Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Inventory flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {step}
                </Badge>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mb-2 text-sm font-medium text-muted-foreground">
        Executive / warehouse KPIs
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 mb-6">
        <StatCard title="Active SKUs" value={formatNumber(stats.skus)} icon={Package} />
        <StatCard title="Warehouses" value={formatNumber(stats.warehouses)} icon={Warehouse} />
        <StatCard
          title="Inventory value (UGX)"
          value={formatNumber(Math.round(stats.onHandValue))}
        />
        <StatCard title="Reams in warehouse" value={formatNumber(stats.reamsWh)} icon={QrCode} />
        <StatCard title="Open GRNs" value={formatNumber(stats.openGrn)} />
        <StatCard title="Open transfers" value={formatNumber(stats.openTransfers)} />
        <StatCard title="Open PRs" value={formatNumber(stats.openPr)} />
        <StatCard title="Active reservations" value={formatNumber(stats.activeReservations)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition-colors hover:border-hope-teal/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="rounded-lg bg-hope-navy/10 p-2">
                  <m.icon className="h-5 w-5 text-hope-teal" />
                </div>
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-hope-gold" />
            <CardTitle>AI inventory intelligence</CardTitle>
          </div>
          <Badge variant="outline">Demand · stockout · dead stock · ABC</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open insights. Reorder, stockout, and overstock signals appear here.
            </p>
          ) : (
            insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border p-4 space-y-2 bg-card">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={ins.severity} />
                  <Badge variant="secondary" className="capitalize">
                    {ins.insight_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="font-medium">{ins.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{ins.recommendation}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
