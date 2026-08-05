"use client";

/**
 * AI Administration Center — providers, limits, tenant isolation, audit.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";
import { SUBSCRIPTION_PLANS } from "@/lib/platform/control-plane-registry";

export default function PlatformAiPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/platform/command-center")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading AI administration..." />;

  const aiOn = data?.health.ai_configured;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Administration Center"
        description="Providers, models, token limits, prompt policies, and tenant AI isolation"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" /> Gateway status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={aiOn ? "secondary" : "outline"}>
                {aiOn ? "API key configured" : "Not configured"}
              </Badge>
              <Badge variant="outline">
                Model:{" "}
                {process.env.NEXT_PUBLIC_SECURETRACK_AI_MODEL ||
                  "server-side only"}
              </Badge>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>
                Providers: SpaceXAI / OpenAI-compatible via SECURETRACK_AI_* or
                OPENAI_* / XAI_*
              </li>
              <li>Estate kill-switch: SECURETRACK_AI_DISABLED=true</li>
              <li>
                Tenant flags (ai.copilot, ai.assistant) under Feature Flags
              </li>
              <li>
                Sensitive AI actions require human approval (lib/ai/governance)
              </li>
              <li>AI audit: domain_events + module-specific AI logs</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/flags">Tenant AI flags</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/security">Security Center</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Isolation (mandatory)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">AI cannot access another tenant.</strong>{" "}
              Context is stamped with session tenant_id + company_id via{" "}
              <code className="text-xs">assertAiContextIsolation</code> and{" "}
              <code className="text-xs">isolationNamespaces().ai</code>.
            </p>
            <p>
              Namespace pattern:{" "}
              <code className="text-xs">{"ai:t:{tenantId}:c:{companyId}"}</code>
            </p>
            <p>
              Token budgets inherit plan entitlements (Starter through
              Government). Exceeding limits is enforced at gateway policy layer.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Plan AI token limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {SUBSCRIPTION_PLANS.map((p) => (
              <div key={p.plan_code} className="rounded border p-3">
                <p className="font-medium capitalize">{p.name}</p>
                <p className="text-muted-foreground mt-1">
                  {p.max_ai_tokens_month.toLocaleString()} tokens / month
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
