"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileSignature, ArrowRight, AlertTriangle, CheckCircle2, FileText, Landmark,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  CONTRACT_DOMAINS,
  CONTRACTS_MENU,
  getContractStats,
  listAllContracts,
  type UnifiedContract,
} from "@/lib/contracts";
import { formatDate, formatNumber } from "@/lib/utils";

export default function ContractsHubPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getContractStats>> | null>(null);
  const [recent, setRecent] = useState<UnifiedContract[]>([]);

  useEffect(() => {
    async function load() {
      const cid = auth?.profile?.company_id;
      if (!cid) {
        setLoading(false);
        return;
      }
      try {
        const [s, all] = await Promise.all([
          getContractStats(cid),
          listAllContracts(cid),
        ]);
        setStats(s);
        setRecent(all.slice(0, 10));
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [auth]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CONTRACTS_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof CONTRACTS_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading contracts command center…" />;

  return (
    <div>
      <PageHeader
        title="Contracts command center"
        description="Sales · billing · CRM · procurement · government — drill into any agreement"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/contracts/expiring">
                <AlertTriangle className="h-4 w-4 mr-1" /> Expiring
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/contracts/analytics">Analytics</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/contracts/sales">
                <FileSignature className="h-4 w-4 mr-1" /> Sales contracts
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-gradient-to-r from-[#0B1F3A] to-[#0d2847] text-white p-4 mb-6">
        <p className="text-[#C9A227] text-[11px] font-semibold uppercase tracking-wider">
          Contract lifecycle
        </p>
        <p className="text-white/70 text-sm mt-1 max-w-3xl">
          Draft → Negotiate → Active → Milestone / consumption → Renew or expire.
          Open any contract number for party details, lines, milestones, and related module links.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard title="Total" value={String(stats?.total ?? 0)} icon={FileText} />
        <StatCard title="Active" value={String(stats?.active ?? 0)} icon={CheckCircle2} />
        <StatCard title="Draft" value={String(stats?.draft ?? 0)} icon={FileSignature} />
        <StatCard title="Expiring (60d)" value={String(stats?.expiring ?? 0)} icon={AlertTriangle} />
        <StatCard title="Expired" value={String(stats?.expired ?? 0)} icon={AlertTriangle} />
        <StatCard
          title="Portfolio value"
          value={formatNumber(stats?.totalValue ?? 0)}
          icon={Landmark}
        />
      </div>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Domain drill-down
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CONTRACT_DOMAINS.map((d) => {
            const bucket = stats?.byDomain.find((b) => b.domain === d.key);
            return (
              <Link key={d.key} href={d.href}>
                <Card className="h-full hover:border-primary/40 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{d.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{d.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <Badge variant="secondary">{bucket?.count ?? 0} contracts</Badge>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(bucket?.value ?? 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent contracts</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/contracts/sales">Browse sales</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contracts yet across domains.</p>
            ) : (
              recent.map((c) => (
                <Link
                  key={`${c.domain}-${c.id}`}
                  href={c.href}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {c.contract_number}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {c.domain}
                      </Badge>
                    </div>
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {c.party}
                      {c.end_date ? ` · ends ${formatDate(c.end_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={c.status === "active" ? "default" : "secondary"}
                    >
                      {c.status}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick paths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {[
              ["/dashboard/contracts/sales", "Sales contracts"],
              ["/dashboard/contracts/billing", "Billing contracts"],
              ["/dashboard/contracts/procurement", "Procurement contracts"],
              ["/dashboard/contracts/expiring", "Expiring soon"],
              ["/dashboard/sales/contract-lines", "Sales lines"],
              ["/dashboard/sales/rebates", "Rebates"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded border px-2 py-1.5 hover:bg-muted/40"
              >
                {label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Input
        className="max-w-md mb-4"
        placeholder="Filter contract modules…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {group}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link key={m.href + m.title} href={m.href}>
                  <Card className="h-full hover:border-primary/40 transition-colors">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
