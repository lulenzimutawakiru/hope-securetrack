import fs from "fs";
import path from "path";

const SKIP = new Set(["auth-sheet"]); // specialized QR sheet printer

const entities = [
  "formats", "categories", "templates", "fields", "variables",
  "materials", "stock", "barcodes", "gs1", "security",
  "rules", "batches", "instances", "jobs", "reprints", "approvals",
  "shipping", "pallet", "shelf", "compliance", "printer-profiles",
  "product", "carton", "documents", "notifications", "settings",
  "audit", "insights", "reports", "analytics", "ai",
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
import { generateLabelInsights, type LblInsight } from "@/lib/lbl";
import { toast } from "sonner";

export default function LabelsAiPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<LblInsight[]>([]);
  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      setInsights(await generateLabelInsights(companyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  if (loading) return <LoadingState message="Generating label insights…" />;

  return (
    <div>
      <PageHeader
        title="AI Labels Assistant"
        description="Stock, print quality, reprints and batch insights"
        actions={<Button size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((ins, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />{ins.title}
                </CardTitle>
                <Badge variant="outline">{ins.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{ins.summary}</p>
              {ins.recommendations?.length ? (
                <ul className="list-disc pl-4 space-y-1">
                  {ins.recommendations.map((r, j) => <li key={j}>{r}</li>)}
                </ul>
              ) : null}
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

import { LblEntityPage } from "@/components/lbl/lbl-entity-page";
import { LBL_ENTITIES } from "@/lib/lbl/entities";

export default function Page() {
  const config = LBL_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <LblEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "labels");
fs.mkdirSync(root, { recursive: true });

let n = 0;
for (const slug of entities) {
  if (SKIP.has(slug)) continue;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), pageContent(slug), "utf8");
  n++;
}
console.log("Generated", n, "label entity pages");
