"use client";

import { useEffect, useState } from "react";
import {
  Factory,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Package,
  Printer,
  Warehouse,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import type { DashboardStats, ProductionBatch, FraudAlert, VerificationLog } from "@/types/database";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { auth } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBatches, setRecentBatches] = useState<ProductionBatch[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<FraudAlert[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      const [
        batchesToday,
        batchesInProgress,
        qrGenerated,
        qrPrinted,
        verificationsToday,
        openFraudAlerts,
        inventoryReams,
        inventoryCartons,
        pendingPrintJobs,
        batches,
        alerts,
        verifications,
      ] = await Promise.all([
        supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .gte("created_at", `${today}T00:00:00`),
        supabase
          .from("production_batches")
          .select("*", { count: "exact", head: true })
          .in("production_status", ["in_progress", "qc_pending"]),
        supabase
          .from("qr_codes")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("qr_codes")
          .select("*", { count: "exact", head: true })
          .in("status", ["printed", "verified", "packed", "dispatched", "sold"]),
        supabase
          .from("verification_logs")
          .select("*", { count: "exact", head: true })
          .gte("verified_at", `${today}T00:00:00`),
        supabase
          .from("fraud_alerts")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "investigating"]),
        supabase
          .from("reams")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_warehouse"),
        supabase
          .from("cartons")
          .select("*", { count: "exact", head: true })
          .eq("inventory_status", "in_warehouse"),
        supabase
          .from("print_jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "queued", "printing"]),
        supabase
          .from("production_batches")
          .select("*, products(name)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("fraud_alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("verification_logs")
          .select("*")
          .order("verified_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        batchesToday: batchesToday.count ?? 0,
        batchesInProgress: batchesInProgress.count ?? 0,
        qrGenerated: qrGenerated.count ?? 0,
        qrPrinted: qrPrinted.count ?? 0,
        verificationsToday: verificationsToday.count ?? 0,
        openFraudAlerts: openFraudAlerts.count ?? 0,
        inventoryReams: inventoryReams.count ?? 0,
        inventoryCartons: inventoryCartons.count ?? 0,
        pendingPrintJobs: pendingPrintJobs.count ?? 0,
      });
      setRecentBatches((batches.data as ProductionBatch[]) ?? []);
      setRecentAlerts((alerts.data as FraudAlert[]) ?? []);
      setRecentVerifications((verifications.data as VerificationLog[]) ?? []);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <LoadingState message="Loading dashboard..." />;

  return (
    <div>
      <PageHeader
        title={`Welcome back${auth ? `, ${auth.profile.first_name}` : ""}`}
        description="Production, authentication, and supply chain overview"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/production">
              <Button>New Batch</Button>
            </Link>
            <Link href="/verify">
              <Button variant="outline">Verify Product</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Batches Today"
          value={formatNumber(stats?.batchesToday ?? 0)}
          description={`${stats?.batchesInProgress ?? 0} in progress`}
          icon={Factory}
        />
        <StatCard
          title="QR Codes"
          value={formatNumber(stats?.qrGenerated ?? 0)}
          description={`${stats?.qrPrinted ?? 0} printed`}
          icon={QrCode}
        />
        <StatCard
          title="Verifications Today"
          value={formatNumber(stats?.verificationsToday ?? 0)}
          icon={ShieldCheck}
        />
        <StatCard
          title="Open Fraud Alerts"
          value={formatNumber(stats?.openFraudAlerts ?? 0)}
          description={stats?.openFraudAlerts ? "Requires attention" : "All clear"}
          icon={AlertTriangle}
          className={stats?.openFraudAlerts ? "border-red-200" : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Warehouse Reams"
          value={formatNumber(stats?.inventoryReams ?? 0)}
          icon={Package}
        />
        <StatCard
          title="Warehouse Cartons"
          value={formatNumber(stats?.inventoryCartons ?? 0)}
          icon={Warehouse}
        />
        <StatCard
          title="Pending Print Jobs"
          value={formatNumber(stats?.pendingPrintJobs ?? 0)}
          icon={Printer}
        />
        <StatCard
          title="System Health"
          value="Operational"
          description="All services online"
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Batches</CardTitle>
            <Link href="/dashboard/production" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batches yet</p>
            ) : (
              recentBatches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{b.batch_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.quantity_reams} reams · {b.product_code}
                    </p>
                  </div>
                  <StatusBadge status={b.production_status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fraud Alerts</CardTitle>
            <Link href="/dashboard/fraud" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent alerts</p>
            ) : (
              recentAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <StatusBadge status={a.severity} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Verifications</CardTitle>
            <Link href="/dashboard/verification" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVerifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verifications yet</p>
            ) : (
              recentVerifications.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs truncate">
                      {v.public_uuid?.slice(0, 8) ?? "—"}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(v.verified_at)} · {v.scan_source}
                    </p>
                  </div>
                  <StatusBadge status={v.result} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
