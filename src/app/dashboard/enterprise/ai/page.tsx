"use client";

import { useEffect, useState } from "react";
import { Sparkles, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listAiInsights, generateCorporateInsights, resolveInsight,
} from "@/lib/enterprise-company";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function EnterpriseAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setInsights((await listAiInsights(auth.profile.company_id)) as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const run = async () => {
    if (!auth) return;
    setBusy(true);
    try {
      const created = await generateCorporateInsights(auth.profile.company_id);
      toast.success(`Generated ${created.length} insight(s)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading AI corporate assistant…" />;

  const open = insights.filter((i) => i.status === "open").length;

  return (
    <div>
      <PageHeader
        title="AI Corporate Assistant"
        description="Branch performance · cost · profitability · workforce · compliance · strategy"
        actions={
          <Button size="sm" onClick={run} disabled={busy}>
            <Sparkles className="h-4 w-4 mr-1" />
            {busy ? "Analyzing…" : "Run analysis"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Open insights" value={String(open)} icon={Sparkles} />
        <StatCard title="Total" value={String(insights.length)} icon={CheckCircle} />
      </div>

      {insights.length === 0 ? (
        <EmptyState title="No insights yet" description="Run analysis against live enterprise structure." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((i) => (
            <Card key={i.id as string}>
              <CardHeader className="pb-2">
                <div className="flex justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{String(i.title)}</CardTitle>
                  <Badge variant={i.severity === "critical" || i.severity === "warning" ? "destructive" : "outline"}>
                    {String(i.severity)}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {String(i.insight_type)} · score {String(i.score ?? "—")} · {formatDate(String(i.created_at))}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{String(i.summary)}</p>
                {Array.isArray(i.recommendations) && (
                  <ul className="text-xs list-disc pl-4 space-y-0.5">
                    {(i.recommendations as string[]).map((r) => <li key={r}>{r}</li>)}
                  </ul>
                )}
                {i.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resolveInsight(i.id as string);
                      toast.success("Resolved");
                      load();
                    }}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolve
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
