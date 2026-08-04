"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import {
  generateAuditInsights,
  summarizeAuditTrail,
  correlateEvents,
  explainUnusualActivity,
  generateExecutiveSummary,
  recommendInvestigations,
  generateComplianceEvidenceHints,
  computeSecurityScores,
  type AuditAiInsight,
} from "@/lib/audit";
import { useUser } from "@/hooks/use-user";

export default function AuditAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<AuditAiInsight[]>([]);
  const [summary, setSummary] = useState("");
  const [clusters, setClusters] = useState<Array<{ title: string; detail: string; event_ids: string[] }>>([]);
  const [explain, setExplain] = useState("");
  const [execBrief, setExecBrief] = useState("");
  const [investigations, setInvestigations] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<string[]>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [
        { count: failed },
        { count: highRisk },
        { count: openAlerts },
        { count: openInc },
        { count: sensExp },
        { count: afterExp },
        { count: salary },
        { count: massDel },
        { count: sessions },
        { count: rateLim },
        { data: events },
      ] = await Promise.all([
        sb.from("eal_events").select("*", { count: "exact", head: true }).eq("event_type", "login_failed").gte("created_at", since),
        sb.from("eal_events").select("*", { count: "exact", head: true }).gte("risk_score", 70).gte("created_at", since),
        sb.from("eal_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("eal_incidents").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
        sb.from("eal_exports").select("*", { count: "exact", head: true }).eq("contains_sensitive", true).gte("created_at", since),
        sb.from("eal_exports").select("*", { count: "exact", head: true }).eq("after_hours", true).gte("created_at", since),
        sb.from("eal_events").select("*", { count: "exact", head: true }).ilike("event_type", "%salary%"),
        sb.from("eal_events").select("*", { count: "exact", head: true }).eq("crud_op", "delete").gte("created_at", since),
        sb.from("eal_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("eal_api_calls").select("*", { count: "exact", head: true }).eq("rate_limited", true).gte("created_at", since),
        sb.from("eal_events").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

      const list = (events as Array<Record<string, unknown>>) || [];
      const nightCount = list.filter((e) => {
        const h = new Date(String(e.created_at)).getHours();
        return h >= 22 || h < 5;
      }).length;

      const ins = generateAuditInsights({
        failedLogins24h: failed ?? 0,
        highRiskEvents: highRisk ?? 0,
        openAlerts: openAlerts ?? 0,
        openIncidents: openInc ?? 0,
        sensitiveExports: sensExp ?? 0,
        afterHoursExports: afterExp ?? 0,
        salaryChanges: salary ?? 0,
        massDeletes: massDel ?? 0,
        activeSessions: sessions ?? 0,
        apiRateLimited: rateLim ?? 0,
        nightActivity: nightCount,
      });
      setInsights(ins);
      setSummary(summarizeAuditTrail(list));
      setClusters(correlateEvents(list));
      const top = list.find((e) => Number(e.risk_score) >= 50) || list[0];
      if (top) setExplain(explainUnusualActivity(top));
      setInvestigations(recommendInvestigations(ins));
      setEvidence(generateComplianceEvidenceHints("ISO27001"));

      const scores = await computeSecurityScores(companyId);
      setExecBrief(
        generateExecutiveSummary({
          securityScore: scores.securityScore,
          complianceScore: scores.complianceScore,
          activeIncidents: scores.activeIncidents,
          openAlerts: scores.openAlerts,
          failedLogins24h: scores.failedLogins24h,
          highRiskUserCount: scores.highRiskUsers.length,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  if (loading) return <LoadingState message="Loading AI audit assistant…" />;

  return (
    <div>
      <PageHeader
        title="AI Audit Assistant"
        description="Summarize · fraud patterns · correlate · investigate · insider risk · evidence · executive brief"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Trail summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executive brief</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">{execBrief}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex gap-2 mb-1 flex-wrap">
                  <Badge
                    variant={
                      ins.severity === "critical" || ins.severity === "high"
                        ? "destructive"
                        : ins.severity === "medium"
                          ? "default"
                          : "outline"
                    }
                    className="text-[10px]"
                  >
                    {ins.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">risk {ins.risk_score}</Badge>
                </div>
                <p className="font-medium text-sm">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Correlated clusters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clusters.map((c, i) => (
              <div key={i} className="border rounded p-2 text-sm">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.detail}</p>
                <p className="text-[10px] font-mono mt-1 truncate">{c.event_ids.join(", ")}</p>
              </div>
            ))}
            {clusters.length === 0 && (
              <p className="text-sm text-muted-foreground">No multi-event clusters in sample window.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Explain unusual activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{explain || "No high-risk sample event."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended investigations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {investigations.map((x) => (
              <p key={x} className="text-sm">• {x}</p>
            ))}
            {investigations.length === 0 && (
              <p className="text-sm text-muted-foreground">No high-severity recommendations.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/audit/incidents">Incidents</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/audit/alerts">Alerts</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href="/dashboard/audit/executive">Executive</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Compliance evidence generator (ISO 27001 hints)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
              {evidence.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <Button asChild size="sm" className="mt-3" variant="outline">
              <Link href="/dashboard/audit/packages">Build audit package</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
