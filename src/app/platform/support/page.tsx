"use client";

import Link from "next/link";
import { ControlPlaneSectionPage, AccessMatrixCard } from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformSupportPage() {
  return (
    <ControlPlaneSectionPage
      title="Tenant Support Center"
      description="SaaS operations — tickets, health, usage. Impersonation requires approval + audit."
      capabilityId="support"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Support rules</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>✅ Tenant health checks via tenant detail + command center</p>
            <p>✅ Elevation (break-glass) with reason + duration on Ops</p>
            <p>❌ Silent impersonation is forbidden</p>
            <p>Impersonation must: approval · reason · duration · full audit trail</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/tenants">Tenants</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/ops">Elevation / offboarding</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
