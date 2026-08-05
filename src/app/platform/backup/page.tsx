"use client";

/**
 * Backup and Disaster Recovery control surface.
 */

import Link from "next/link";
import { Archive } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformBackupPage() {
  return (
    <ControlPlaneSectionPage
      title="Backup and Disaster Recovery"
      description="Automatic backups, restore points, verification — RPO/RTO visibility"
      capabilityId="backup"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-4 w-4" /> Recovery posture
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">RPO:</strong> Supabase
              continuous backups (point-in-time where plan allows) + object
              storage versioning when enabled.
            </p>
            <p>
              <strong className="text-foreground">RTO:</strong> Restore via
              managed platform tools; tenant soft-delete preserves data for
              controlled recovery.
            </p>
            <p>
              <strong className="text-foreground">Verification:</strong> Run
              periodic restore drills in non-prod; document evidence in
              Compliance.
            </p>
            <p>
              <strong className="text-foreground">Tenant exit:</strong>{" "}
              Offboarding + legal hold on Ops before purge.
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/ops">Offboarding</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/governance">Data governance</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
