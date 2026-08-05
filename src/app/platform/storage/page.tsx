"use client";

/**
 * Storage Management — path isolation, retention, encryption guidance.
 */

import Link from "next/link";
import { HardDrive } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS } from "@/lib/platform/control-plane-registry";

export default function PlatformStoragePage() {
  return (
    <ControlPlaneSectionPage
      title="Storage Management"
      description="Documents, images, attachments, contracts, reports — path isolation + retention"
      capabilityId="storage"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Isolation rules
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              All object paths use{" "}
              <code className="text-xs">tenantId/companyId/...</code> via{" "}
              <code className="text-xs">buildIsolatedStoragePath</code>.
            </p>
            <p>
              Cross-tenant reads rejected by{" "}
              <code className="text-xs">assertStoragePathInScope</code>.
            </p>
            <p>
              Encryption: per-tenant key material at provision (vault secret
              once). Storage provider encryption at rest.
            </p>
            <p>
              Virus scanning / retention: configure per environment + Supabase
              policies.
            </p>
            <div className="pt-1">
              <p className="text-xs font-medium text-foreground mb-1">
                Plan storage caps
              </p>
              <ul className="text-xs space-y-0.5">
                {SUBSCRIPTION_PLANS.map((p) => (
                  <li key={p.plan_code}>
                    {p.name}: {p.max_storage_gb} GB
                  </li>
                ))}
              </ul>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/governance">Data governance</Link>
            </Button>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
