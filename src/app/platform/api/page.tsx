"use client";

/**
 * API Management — gateway controls, rate limits, analytics links.
 */

import Link from "next/link";
import { KeyRound } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS } from "@/lib/platform/control-plane-registry";

export default function PlatformApiPage() {
  return (
    <ControlPlaneSectionPage
      title="API Management"
      description="Enterprise API gateway — keys, OAuth clients, rate limits, webhooks, analytics"
      capabilityId="api"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Gateway controls
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Middleware rate limits: auth vs anonymous vs device APIs (Upstash
              when configured).
            </p>
            <p>
              Idempotency keys on mutative routes via createApiHandler.
            </p>
            <p>
              Client tenant_id spoofing rejected; session tenant is authority.
            </p>
            <p>
              Webhook secrets: BILLING_WEBHOOK_SECRET, provider signatures.
            </p>
            <p>
              OpenAPI:{" "}
              <code className="text-xs">npm run openapi:generate</code>
            </p>
            <div className="pt-2">
              <p className="text-xs font-medium text-foreground mb-1">
                Plan API call limits / day
              </p>
              <ul className="text-xs space-y-0.5">
                {SUBSCRIPTION_PLANS.map((p) => (
                  <li key={p.plan_code}>
                    {p.name}: {p.max_api_calls_day.toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/monitoring">Usage / latency</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/integrations">Integrations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
