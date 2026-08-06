"use client";

/**
 * Subscription & Billing - MRR/ARR, plan mix, renewals, and recent subscriptions.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Wallet,
  RefreshCw,
  AlertTriangle,
  Hourglass,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { BillingOverview, SubscriptionStatus } from "@/lib/platform/admin-console";

const STATUS_ORDER: SubscriptionStatus[] = [
  "active",
  "trial",
  "past_due",
  "suspended",
  "cancelled",
];

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/billing");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load billing");
        }
        setData(json.data ?? json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading billing overview..." />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Billing unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
      </div>
    );
  }

  const cur = data.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription & Billing"
        description="Platform-wide recurring revenue, plan mix, renewals, and subscription lifecycle"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/subscriptions">Subscription plans</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Wallet className="h-4 w-4" />} label="Monthly recurring revenue" value={`${cur} ${formatNumber(data.mrr)}`} />
        <MetricCard icon={<CreditCard className="h-4 w-4" />} label="Annual recurring revenue" value={`${cur} ${formatNumber(data.arr)}`} />
        <MetricCard icon={<RefreshCw className="h-4 w-4" />} label="Renewals next 30 days" value={formatNumber(data.renewals_30d)} />
        <MetricCard icon={<Hourglass className="h-4 w-4" />} label="Trials expiring in 7 days" value={formatNumber(data.trials_expiring_7d)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-xl border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground capitalize">
              {status.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-2xl font-semibold">{data.counts[status] ?? 0}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Revenue by plan <span className="text-xs font-normal text-muted-foreground">active subscriptions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Subscriptions</TableHead>
                <TableHead className="text-right">Monthly revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.per_plan.map((p) => (
                <TableRow key={p.plan}>
                  <TableCell className="font-medium capitalize">{p.plan}</TableCell>
                  <TableCell>{formatNumber(p.count)}</TableCell>
                  <TableCell className="text-right">
                    {cur} {formatNumber(p.mrr)}
                  </TableCell>
                </TableRow>
              ))}
              {data.per_plan.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No active subscriptions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Recent subscriptions <span className="text-xs font-normal text-muted-foreground">latest 12</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <EmptyState
              title="No subscriptions yet"
              description="New tenant signups will appear here as they onboard."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Billing email</TableHead>
                  <TableHead>Period end</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((s, i) => (
                  <TableRow key={`${s.tenant_id}-${i}`}>
                    <TableCell>
                      {s.tenant_id ? (
                        <Link
                          href={`/platform/tenants/${s.tenant_id}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {s.tenant_name || "Unknown tenant"}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unlinked</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{s.plan_code || "starter"}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status || "active"} />
                    </TableCell>
                    <TableCell>{s.seats ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.billing_email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.current_period_end || "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          {data.past_due_tenants} past-due tenant(s)
        </Badge>
        <Badge variant="outline" className="gap-1">
          <RefreshCw className="h-3 w-3 text-hope-teal" />
          {data.renewals_7d} renewals in 7 days
        </Badge>
        <span>Snapshot {new Date(data.generated_at).toLocaleString()}</span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}