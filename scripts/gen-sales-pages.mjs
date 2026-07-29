import fs from "fs";
import path from "path";

// Specialized pages already exist — do not overwrite
const SKIP = new Set([
  "orders",
  "quotations",
  "pipeline",
  "commissions",
  "credit",
  "returns",
]);

const entities = [
  "leads",
  "opportunities",
  "activities",
  "call-logs",
  "competitors",
  "price-lists",
  "price-items",
  "discount-rules",
  "promotions",
  "quote-lines",
  "order-lines",
  "approvals",
  "blanket-orders",
  "credit-holds",
  "payment-terms",
  "contracts",
  "contract-lines",
  "rebates",
  "territories",
  "teams",
  "channels",
  "visit-plans",
  "samples",
  "field-map",
  "forecasts",
  "targets",
  "commission-accrual",
  "return-lines",
  "support",
  "documents",
  "proposals",
  "insights",
  "notifications",
  "settings",
  "audit",
  "live",
  "quote-to-cash",
  "reports",
  "analytics",
  "ai",
];

function pageContent(key) {
  if (key === "ai") {
    return `"use client";

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
                {ins.score != null ? \` · Score \${ins.score}\` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
`;
  }

  return `"use client";

import { SalesEntityPage } from "@/components/sales/sales-entity-page";
import { SALES_ENTITIES } from "@/lib/sales/entities";

export default function Page() {
  const config = SALES_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <SalesEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "sales");
fs.mkdirSync(root, { recursive: true });

let n = 0;
for (const slug of entities) {
  if (SKIP.has(slug)) continue;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), pageContent(slug), "utf8");
  n++;
}
console.log("Generated", n, "sales entity pages (skipped specialized:", [...SKIP].join(", "), ")");
