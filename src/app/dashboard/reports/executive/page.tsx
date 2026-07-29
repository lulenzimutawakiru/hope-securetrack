"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const AUDIENCES = [
  { key: "ceo", label: "CEO" },
  { key: "md", label: "Managing Director" },
  { key: "board", label: "Board" },
  { key: "investor", label: "Investor" },
  { key: "executive", label: "Executive" },
];

export default function ExecutiveCenterPage() {
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState("executive");
  const [kpis, setKpis] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [dashboards, setDashboards] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: k }, { data: i }, { data: d }] = await Promise.all([
        supabase
          .from("bi_kpis")
          .select("*")
          .eq("is_active", true)
          .is("deleted_at", null)
          .in("category", ["financial", "sales", "production", "quality"])
          .order("name")
          .limit(12),
        supabase
          .from("bi_ai_insights")
          .select("*")
          .eq("status", "open")
          .in("severity", ["high", "critical"])
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("bi_dashboards")
          .select("*")
          .in("audience", ["ceo", "md", "board", "investor", "executive"])
          .is("deleted_at", null)
          .order("sort_order"),
      ]);
      setKpis(k ?? []);
      setInsights(i ?? []);
      setDashboards(d ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading executive pack…" />;

  const filteredDash = dashboards.filter(
    (d) => audience === "executive" || String(d.audience) === audience
  );

  return (
    <div>
      <PageHeader
        title="Executive Decision Center"
        description="CEO · MD · Board · Investor packs — strategic KPIs and critical AI signals"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reports">Hub</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/reports/dashboards">All dashboards</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {AUDIENCES.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={audience === a.key ? "default" : "outline"}
            onClick={() => setAudience(a.key)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-[#0d2847] text-white p-5 mb-6">
        <p className="text-hope-gold text-xs font-semibold uppercase tracking-wide flex items-center gap-2">
          <Crown className="h-3.5 w-3.5" />
          Hope Design Group Ltd — Executive pack
        </p>
        <p className="text-sm text-white/80 mt-2">
          Security Printing · Paper Manufacturing · Engineering · Commercial Printing
        </p>
        <p className="text-xs text-white/50 mt-1">
          Viewing: {AUDIENCES.find((a) => a.key === audience)?.label}
        </p>
      </div>

      <h3 className="text-sm font-semibold mb-3">Strategic KPIs</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {kpis.map((k) => (
          <Card key={String(k.id)}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground">{String(k.name)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(Number(k.actual_value))}
                <span className="text-xs ml-1 font-normal text-muted-foreground">
                  {String(k.unit ?? "")}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Target {formatNumber(Number(k.target_value))} · var{" "}
                {formatNumber(Number(k.variance_pct))}% · {String(k.trend)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="text-sm font-semibold mb-3">Critical AI signals</h3>
      <div className="grid gap-3 mb-8">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high/critical open insights.</p>
        ) : (
          insights.map((i) => (
            <Card key={String(i.id)}>
              <CardContent className="pt-4 flex flex-wrap gap-2 items-start">
                <StatusBadge status={String(i.severity)} />
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium text-sm">{String(i.title)}</p>
                  <p className="text-xs text-muted-foreground">{String(i.recommendation ?? "")}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {String(i.insight_type)}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <h3 className="text-sm font-semibold mb-3">Linked dashboards</h3>
      <div className="flex flex-wrap gap-2">
        {(filteredDash.length ? filteredDash : dashboards).map((d) => (
          <Link key={String(d.id)} href="/dashboard/reports/dashboards">
            <Badge variant="secondary" className="py-1.5 px-3 cursor-pointer hover:bg-muted">
              {String(d.name)}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
