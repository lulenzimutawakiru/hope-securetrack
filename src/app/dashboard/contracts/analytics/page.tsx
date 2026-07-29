"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { CONTRACT_DOMAINS, getContractStats } from "@/lib/contracts";
import { formatNumber } from "@/lib/utils";

export default function ContractsAnalyticsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getContractStats>> | null>(null);

  useEffect(() => {
    async function load() {
      const cid = auth?.profile?.company_id;
      if (!cid) {
        setLoading(false);
        return;
      }
      try {
        setStats(await getContractStats(cid));
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [auth]);

  if (loading) return <LoadingState message="Loading contract analytics…" />;

  const max = Math.max(1, ...(stats?.byDomain.map((d) => d.count) || [1]));

  return (
    <div>
      <PageHeader
        title="Contract analytics"
        description="Portfolio value and distribution by domain"
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/contracts/expiring">Expiring view</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Contracts" value={String(stats?.total ?? 0)} icon={BarChart3} />
        <StatCard title="Active" value={String(stats?.active ?? 0)} icon={BarChart3} />
        <StatCard title="Expiring" value={String(stats?.expiring ?? 0)} icon={BarChart3} />
        <StatCard
          title="Portfolio value"
          value={formatNumber(stats?.totalValue ?? 0)}
          icon={BarChart3}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Contracts by domain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(stats?.byDomain || []).map((b) => {
            const meta = CONTRACT_DOMAINS.find((d) => d.key === b.domain)!;
            const pct = Math.round((b.count / max) * 100);
            return (
              <Link key={b.domain} href={meta.href} className="block group">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium group-hover:text-primary">{meta.title}</span>
                  <span className="text-muted-foreground">
                    {b.count} · {formatNumber(b.value)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
