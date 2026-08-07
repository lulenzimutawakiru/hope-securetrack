"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Factory,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Package,
  Warehouse,
  Landmark,
  Users,
  ShoppingCart,
  BarChart3,
  Bell,
  Sparkles,
  Car,
  FolderKanban,
  Clock,
  Truck,
  Printer,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { KpiMetric } from "@/components/enterprise/kpi-metric";
import { ModuleTile } from "@/components/enterprise/module-tile";
import { apiGet } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { WelcomeCta } from "./components/welcome-cta";
import { filterAccessibleRoutes } from "@/lib/auth/rbac";
import type { DashboardStats, ProductionBatch, FraudAlert, VerificationLog } from "@/types/database";
import { ENTERPRISE_PIPELINE } from "@/lib/workflows";

const WORKSPACES = [
  { title: "Production", href: "/dashboard/production", icon: Factory, description: "MES · batches · OEE", badge: "Ops", permission: "production.view" },
  { title: "Advanced Labels", href: "/dashboard/labels", icon: Printer, description: "Templates · GS1 · print", badge: "Labels", permission: "lbl.view" },
  { title: "Inventory", href: "/dashboard/inventory", icon: Warehouse, description: "Stock · GRN · transfers", badge: "WMS", permission: "inventory.view" },
  { title: "Finance", href: "/dashboard/finance", icon: Landmark, description: "GL · treasury · costing", badge: "ERP", permission: "finance.view" },
  { title: "Projects", href: "/dashboard/projects", icon: FolderKanban, description: "PPM · Gantt · billing", badge: "PPM", permission: "ppm.view" },
  { title: "Fleet", href: "/dashboard/fleet", icon: Car, description: "Vehicles · GPS · fuel", badge: "TMS", permission: "fleet.view" },
  { title: "Attendance", href: "/dashboard/attendance", icon: Clock, description: "Geofence · biometrics", badge: "WFM", permission: "att.view" },
  { title: "Dispatch", href: "/dashboard/dispatch", icon: Truck, description: "Routes · POD · drivers", badge: "Logistics", permission: "dispatch.view" },
  { title: "Advanced Sales", href: "/dashboard/sales", icon: ShoppingCart, description: "Pipeline · quotes · orders", badge: "Rev", permission: "sales.view" },
  { title: "HR", href: "/dashboard/hr", icon: Users, description: "People · leave · payroll", badge: "HCM", permission: "hr.view" },
  { title: "Reports & BI", href: "/dashboard/reports", icon: BarChart3, description: "KPIs · AI · board packs", badge: "BI", permission: "reports.view" },
  { title: "Security", href: "/dashboard/fraud", icon: ShieldCheck, description: "QR · fraud · verify", badge: "IAM", permission: "fraud.manage" },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Inbox · rules · Resend", badge: "Comms", permission: "notifications.view" },
];

export default function DashboardPage() {
  const { auth, loading: authLoading, hasPermission, isPlatformAdmin } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBatches, setRecentBatches] = useState<ProductionBatch[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<FraudAlert[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const canProduction = hasPermission("production.view") || hasPermission("mes.view");
  const canQr = hasPermission("qr.view");
  const canInventory = hasPermission("inventory.view");
  const canFraud = hasPermission("fraud.manage");
  const canVerify = hasPermission("verification.view");
  const canPrint = hasPermission("print.view") || hasPermission("printing.create") || hasPermission("lbl.view");
  const canReports = hasPermission("reports.view");
  const canAttendance = hasPermission("att.view") || hasPermission("att.clock");
  const canAi = hasPermission("reports.assistant") || hasPermission("reports.ai") || hasPermission("hc.ai");

  const visibleWorkspaces = useMemo(() => {
    if (authLoading) return [];
    if (isPlatformAdmin) return WORKSPACES;
    return WORKSPACES.filter((w) => hasPermission(w.permission));
  }, [authLoading, isPlatformAdmin, hasPermission]);

  const visiblePipeline = useMemo(() => {
    if (authLoading) return [];
    return filterAccessibleRoutes(ENTERPRISE_PIPELINE, auth?.permissions, {
      isPlatformAdmin,
    });
  }, [authLoading, auth?.permissions, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading) return;

    async function load() {
      try {
        const res = await apiGet<{
          batchesToday: number;
          batchesInProgress: number;
          qrGenerated: number;
          qrPrinted: number;
          verificationsToday: number;
          openFraudAlerts: number;
          inventoryReams: number;
          inventoryCartons: number;
          pendingPrintJobs: number;
          recentBatches: ProductionBatch[];
          recentAlerts: FraudAlert[];
          recentVerifications: VerificationLog[];
        }>("/api/v2/dashboard/summary");
        if (!res.ok) throw new Error(res.error);
        setStats({
          batchesToday: res.data.batchesToday,
          batchesInProgress: res.data.batchesInProgress,
          qrGenerated: res.data.qrGenerated,
          qrPrinted: res.data.qrPrinted,
          verificationsToday: res.data.verificationsToday,
          openFraudAlerts: res.data.openFraudAlerts,
          inventoryReams: res.data.inventoryReams,
          inventoryCartons: res.data.inventoryCartons,
          pendingPrintJobs: res.data.pendingPrintJobs,
        });
        setRecentBatches(res.data.recentBatches ?? []);
        setRecentAlerts(res.data.recentAlerts ?? []);
        setRecentVerifications(res.data.recentVerifications ?? []);
      } catch {
        setStats({
          batchesToday: 0,
          batchesInProgress: 0,
          qrGenerated: 0,
          qrPrinted: 0,
          verificationsToday: 0,
          openFraudAlerts: 0,
          inventoryReams: 0,
          inventoryCartons: 0,
          pendingPrintJobs: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [
    authLoading,
    canProduction,
    canQr,
    canInventory,
    canFraud,
    canVerify,
    canPrint,
  ]);

  if (authLoading || loading) {
    return <LoadingState message="Loading your workspace…" />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <section className="hero-band relative overflow-hidden rounded-2xl p-5 sm:p-7 text-white shadow-enterprise-lg">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,39,0.18),transparent_50%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="text-overline text-white/60">SecureTrack ERP</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
              Welcome back
              {auth ? `, ${auth.profile.first_name}` : ""}
            </h1>
            <p className="text-sm sm:text-base text-white/70 max-w-xl">
              Security printing · manufacturing · logistics · finance · people — one enterprise workspace.
              Press{" "}
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-xs">
                ⌘K
              </kbd>{" "}
              to search anything.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/15">
                Multi-company ready
              </Badge>
              <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/15">
                Real-time ops
              </Badge>
              <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/15">
                AI-assisted BI
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canProduction && (
              <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
                <Link href="/dashboard/production">
                  <Factory className="h-4 w-4 mr-2" />
                  New batch
                </Link>
              </Button>
            )}
            {canAttendance && (
              <Button
                asChild
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard/attendance/clock">
                  <Clock className="h-4 w-4 mr-2" />
                  Clock in
                </Link>
              </Button>
            )}
            {canAi && (
              <Button
                asChild
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard/reports/assistant">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI assistant
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/verify">Verify product</Link>
            </Button>
          </div>
        </div>
      </section>

      <WelcomeCta />

      {/* KPIs — only modules the role can access */}
      <section className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 xl:grid-cols-4">
        {canProduction && (
          <KpiMetric
            title="Batches today"
            value={formatNumber(stats?.batchesToday ?? 0)}
            description={`${stats?.batchesInProgress ?? 0} in progress`}
            icon={Factory}
            trend="up"
            trendLabel="Live"
            tone="info"
          />
        )}
        {canQr && (
          <KpiMetric
            title="QR codes"
            value={formatNumber(stats?.qrGenerated ?? 0)}
            description={`${stats?.qrPrinted ?? 0} printed`}
            icon={QrCode}
            tone="default"
          />
        )}
        {canVerify && (
          <KpiMetric
            title="Verifications today"
            value={formatNumber(stats?.verificationsToday ?? 0)}
            icon={ShieldCheck}
            tone="success"
          />
        )}
        {canFraud && (
          <KpiMetric
            title="Open fraud alerts"
            value={formatNumber(stats?.openFraudAlerts ?? 0)}
            description={stats?.openFraudAlerts ? "Requires attention" : "All clear"}
            icon={AlertTriangle}
            tone={stats?.openFraudAlerts ? "danger" : "success"}
            trend={stats?.openFraudAlerts ? "down" : "flat"}
            trendLabel={stats?.openFraudAlerts ? "Action" : "Stable"}
          />
        )}
      </section>

      {(canInventory || canPrint) && (
        <section className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 xl:grid-cols-4">
          {canInventory && (
            <KpiMetric
              title="Warehouse reams"
              value={formatNumber(stats?.inventoryReams ?? 0)}
              icon={Package}
            />
          )}
          {canInventory && (
            <KpiMetric
              title="Warehouse cartons"
              value={formatNumber(stats?.inventoryCartons ?? 0)}
              icon={Warehouse}
            />
          )}
          {canPrint && (
            <KpiMetric
              title="Pending print jobs"
              value={formatNumber(stats?.pendingPrintJobs ?? 0)}
              icon={Printer}
              tone={stats?.pendingPrintJobs ? "warning" : "default"}
            />
          )}
          <KpiMetric
            title="System health"
            value="Operational"
            description="Services online"
            icon={TrendingUp}
            tone="success"
            trend="up"
            trendLabel="99.9%"
          />
        </section>
      )}

      {/* Workspaces */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-overline">Workspaces</p>
            <h2 className="text-lg font-semibold tracking-tight">
              Your modules
            </h2>
          </div>
          {canReports && (
            <Link
              href="/dashboard/reports"
              className="text-xs font-medium text-accent inline-flex items-center gap-1 hover:underline"
            >
              Analytics hub
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {visibleWorkspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border p-4">
            No enterprise modules are assigned to your role yet. Contact an
            administrator if you need access.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleWorkspaces.map(({ permission: _p, ...w }) => (
              <ModuleTile key={w.href} {...w} />
            ))}
          </div>
        )}
      </section>

      {/* Pipeline */}
      {visiblePipeline.length > 0 && (
        <Card className="surface-card border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enterprise production pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {visiblePipeline.map((step) => (
                <Link
                  key={step.stage}
                  href={step.href}
                  className="rounded-xl border bg-muted/30 p-3 hover:bg-muted/60 hover:border-accent/30 transition-colors"
                >
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-caption mt-1 line-clamp-2">{step.description}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity columns */}
      <section className="grid gap-4 lg:grid-cols-3">
        {canProduction && (
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent batches</CardTitle>
            <Link href="/dashboard/production" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batches yet</p>
            ) : (
              recentBatches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{b.batch_number}</p>
                    <p className="text-caption truncate">
                      {b.quantity_reams} reams · {b.product_code}
                    </p>
                  </div>
                  <StatusBadge status={b.production_status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        )}

        {canFraud && (
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Fraud alerts</CardTitle>
            <Link href="/dashboard/fraud" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent alerts</p>
            ) : (
              recentAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <p className="text-caption">{formatDateTime(a.created_at)}</p>
                  </div>
                  <StatusBadge status={a.severity} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        )}

        {canVerify && (
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Verifications</CardTitle>
            <Link href="/dashboard/verification" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentVerifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verifications yet</p>
            ) : (
              recentVerifications.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs truncate">
                      {v.public_uuid?.slice(0, 8) ?? "—"}…
                    </p>
                    <p className="text-caption">
                      {formatDateTime(v.verified_at)} · {v.scan_source}
                    </p>
                  </div>
                  <StatusBadge status={v.result} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        )}
      </section>
    </div>
  );
}
