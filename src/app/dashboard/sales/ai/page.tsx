"use client";

import { useEffect, useState } from "react";
import { Brain, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { generateSalesInsights, type SalesInsight } from "@/lib/sales";
import { toast } from "sonner";

export default function SalesAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<SalesInsight[]>([]);
  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await generateSalesInsights(companyId);
      setInsights(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  if (loading) return <LoadingState message="Generating sales insights…" />;

  return (
    <div>
      <PageHeader
        title="AI Sales Assistant"
        description="Rule-based pipeline, credit, quoting and lead insights"
        actions={
          <Button size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((ins, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  {ins.title}
                </CardTitle>
                <Badge variant="outline">{ins.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{ins.summary}</p>
              {ins.recommendations?.length ? (
                <ul className="list-disc pl-4 space-y-1">
                  {ins.recommendations.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Type: {ins.insight_type}
                {ins.score != null ? ` · Score ${ins.score}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
