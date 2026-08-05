"use client";

/**
 * Subscription Management — plans, seats, upgrade/downgrade controls.
 * Lifecycle actions (upgrade, suspend, cancel, trial) run on tenant detail.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listPlans, type PlatformPlan } from "@/lib/platform";
import { SUBSCRIPTION_PLANS } from "@/lib/platform/control-plane-registry";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export default function SubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [subs, setSubs] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [p, { data: s }] = await Promise.all([
          listPlans(),
          createClient()
            .from("tenant_subscriptions")
            .select("*,tenants(name,slug,status)")
            .limit(200),
        ]);
        setPlans(p);
        setSubs((s as Array<Record<string, unknown>>) || []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading subscriptions..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Management"
        description="Enterprise SaaS billing — plans, seats, modules, AI usage, and lifecycle"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/tenants">Upgrade / suspend tenants</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((p) => (
          <Card key={p.plan_code}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">{p.name}</CardTitle>
              <p className="text-[11px] text-muted-foreground">
                {p.description}
              </p>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <p>
                Users: <strong>{p.max_users.toLocaleString()}</strong>
              </p>
              <p>
                Companies: <strong>{p.max_companies}</strong>
              </p>
              <p>
                Storage: <strong>{p.max_storage_gb} GB</strong>
              </p>
              <p>
                API / day:{" "}
                <strong>{p.max_api_calls_day.toLocaleString()}</strong>
              </p>
              <p>
                AI tokens / mo:{" "}
                <strong>{p.max_ai_tokens_month.toLocaleString()}</strong>
              </p>
              <p>
                Reports / mo: <strong>{p.max_reports_month}</strong>
              </p>
              <p>
                Automations: <strong>{p.max_automations}</strong>
              </p>
              <p>
                Modules: <strong>{p.modules}</strong>
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {p.features.slice(0, 4).map((f) => (
                  <Badge key={f} variant="outline" className="text-[9px]">
                    {f}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lifecycle operations</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            From each tenant: <strong>Upgrade</strong>,{" "}
            <strong>Downgrade</strong> (plan change), <strong>Suspend</strong>,{" "}
            <strong>Cancel</strong>, <strong>Trial extension</strong>.
          </p>
          <p>
            Invoice history and payment providers are managed under Integration
            Center (MTN MoMo, Airtel Money, Pesapal, etc.).
          </p>
        </CardContent>
      </Card>

      {plans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Database plan catalog
          </h3>
          <div className="rounded-lg border mb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Price / mo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.plan_code}>
                    <TableCell className="font-mono text-xs">
                      {p.plan_code}
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.max_users}</TableCell>
                    <TableCell>{p.max_companies}</TableCell>
                    <TableCell>
                      {p.currency || "USD"}{" "}
                      {formatNumber(Number(p.price_monthly || 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Tenant subscriptions</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => {
                const t = s.tenants as {
                  name?: string;
                  slug?: string;
                  status?: string;
                } | null;
                return (
                  <TableRow key={String(s.id)}>
                    <TableCell>
                      {t?.name || String(s.tenant_id).slice(0, 8)}
                      {t?.slug ? (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({t.slug})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {String(s.plan_code)}
                    </TableCell>
                    <TableCell>{String(s.seats ?? "-")}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {String(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/platform/tenants/${s.tenant_id}`}>
                          Manage
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {subs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No subscriptions loaded (RLS may limit client reads —
                    use tenant directory for staff ops).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
