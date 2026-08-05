"use client";

/**
 * Deployment Center — environments, flags, rollback guidance.
 */

import Link from "next/link";
import { Rocket } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlatformDeployPage() {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV;

  return (
    <ControlPlaneSectionPage
      title="Deployment Center"
      description="Environments, release management, feature flags, rollback, migrations"
      capabilityId="deploy"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-xs text-muted-foreground">
              Current environment:{" "}
              <Badge variant="secondary" className="text-[10px]">
                {env || "unknown"}
              </Badge>
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>Development / Testing / Production on Vercel</li>
              <li>Version control: GitHub + Vercel deployments</li>
              <li>Feature flags: Platform Flags + tenant overrides</li>
              <li>Rollback: Vercel previous deployment promote</li>
              <li>Migrations: supabase migration files + db push in CI</li>
            </ul>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/flags">Feature flags</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/monitoring">Monitoring</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
