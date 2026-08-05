"use client";

/**
 * System Configuration — no-code platform defaults.
 * Per-tenant branding/sequences live under ERP settings after provision.
 */

import Link from "next/link";
import { Settings2 } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformConfigPage() {
  return (
    <ControlPlaneSectionPage
      title="System Configuration"
      description="No-code configuration engine — general defaults, numbering, workflows, notifications"
      capabilityId="config"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Configurable domains
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">General:</strong> company
              settings, branding, logo, theme, language, currency
            </p>
            <p>
              <strong className="text-foreground">Workflow:</strong> approval
              levels, escalation rules, SLA
            </p>
            <p>
              <strong className="text-foreground">Notifications:</strong>{" "}
              channels and templates (Notification Center)
            </p>
            <p>
              <strong className="text-foreground">Numbering:</strong> invoices,
              POs, assets, employees, tickets, contracts
            </p>
            <p className="text-xs font-mono bg-muted rounded px-2 py-1">
              Example: PO-HDG-2026-000001
            </p>
            <p className="text-xs">
              Defaults are seeded at provision (seedTenantDefaults). Tenant
              admins refine under ERP Settings — not CPanel.
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/provisioning">Provisioning</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/notifications">Notifications</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
