"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listPlans, type PlatformPlan } from "@/lib/platform";
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
          createClient().from("tenant_subscriptions").select("*,tenants(name,slug)").limit(100),
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

  if (loading) return <LoadingState message="Loading subscriptions…" />;

  return (
    <div>
      <PageHeader
        title="Plans & subscriptions"
        description="SaaS billing · seats · module entitlements"
      />

      <h3 className="text-sm font-semibold mb-2">Plans</h3>
      <div className="rounded-lg border mb-8">
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
                <TableCell className="font-mono text-xs">{p.plan_code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.max_users}</TableCell>
                <TableCell>{p.max_companies}</TableCell>
                <TableCell>
                  {p.currency || "USD"} {formatNumber(Number(p.price_monthly || 0))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <h3 className="text-sm font-semibold mb-2">Active subscriptions</h3>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.map((s) => {
              const t = s.tenants as { name?: string; slug?: string } | null;
              return (
                <TableRow key={String(s.id)}>
                  <TableCell>
                    {t?.name || String(s.tenant_id).slice(0, 8)}
                    {t?.slug ? (
                      <span className="text-xs text-muted-foreground ml-1">({t.slug})</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">{String(s.plan_code)}</TableCell>
                  <TableCell>{String(s.seats ?? "—")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{String(s.status)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {subs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                  No subscriptions loaded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
