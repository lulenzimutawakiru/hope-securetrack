"use client";

/**
 * Usage Metering - seat consumption, modules, and API usage per tenant.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Layers,
  Activity,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
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
import type { UsageOverview } from "@/lib/platform/admin-console";

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/usage");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load usage");
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

  if (loading) return <LoadingState message="Loading usage metering..." />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Usage data unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage Metering"
        description="Consumption across tenants - seats, companies, modules, and API traffic"
        actions={
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            {t.over_capacity} over capacity
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Total users" value={formatNumber(t.users)} />
        <MetricCard icon={<Building2 className="h-4 w-4" />} label="Companies" value={formatNumber(t.companies)} />
        <MetricCard icon={<Layers className="h-4 w-4" />} label="Modules enabled" value={formatNumber(t.modules_enabled)} />
        <MetricCard icon={<Activity className="h-4 w-4" />} label="API requests 30d" value={formatNumber(t.api_requests_30d)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tenant consumption</CardTitle>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <EmptyState
              title="No tenants"
              description="Provisioned tenants will appear here with usage telemetry."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Seat utilization</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Companies</TableHead>
                    <TableHead>Modules</TableHead>
                    <TableHead className="text-right">API 30d</TableHead>
                    <TableHead className="text-right">Error rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.tenant_id ?? r.tenant_slug ?? r.tenant_name ?? "row"}>
                      <TableCell>
                        {r.tenant_id ? (
                          <Link
                            href={`/platform/tenants/${r.tenant_id}`}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            {r.tenant_name || "Unknown tenant"}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{r.tenant_name || "Unlinked"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.tenant_status || "unknown"} />
                      </TableCell>
                      <TableCell className="capitalize">{r.plan_code || "starter"}</TableCell>
                      <TableCell className="min-w-36">
                        <div className="flex items-center gap-2">
                          <Progress value={r.seat_pct ?? 0} className="w-24" />
                          <span className="text-xs text-muted-foreground">
                            {r.users}/{r.seats ?? "∞"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(r.users)}</TableCell>
                      <TableCell>{formatNumber(r.companies)}</TableCell>
                      <TableCell>{formatNumber(r.modules_enabled)}</TableCell>
                      <TableCell className="text-right">{formatNumber(r.api_requests_30d)}</TableCell>
                      <TableCell className="text-right">
                        {r.api_error_rate != null ? `${r.api_error_rate.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Top consumers by API <span className="text-xs font-normal text-muted-foreground">30 days</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.top_by_api.map((r) => (
            <div key={r.tenant_id ?? r.tenant_name ?? "top"} className="rounded-md border px-3 py-2">
              <p className="truncate text-sm font-medium">{r.tenant_name || "Unknown tenant"}</p>
              <p className="text-lg font-semibold">{formatNumber(r.api_requests_30d)}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.api_errors_30d} errors · {r.api_error_rate != null ? `${r.api_error_rate.toFixed(1)}%` : "n/a"}
              </p>
            </div>
          ))}
          {data.top_by_api.length === 0 && (
            <p className="text-sm text-muted-foreground">No API traffic recorded.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Snapshot {new Date(data.generated_at).toLocaleString()} - read-only metering
      </p>
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