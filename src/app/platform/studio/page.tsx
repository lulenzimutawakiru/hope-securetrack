"use client";

/**
 * Customization Studio governance — tenant-level custom fields/forms.
 */

import Link from "next/link";
import { Palette } from "lucide-react";
import {
  ControlPlaneSectionPage,
  AccessMatrixCard,
} from "@/components/platform/control-plane-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformStudioPage() {
  return (
    <ControlPlaneSectionPage
      title="Customization Studio"
      description="Govern tenant customizations — fields, forms, dashboards, reports, workflows"
      capabilityId="studio"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" /> Tenant customization
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Each tenant can customize (within isolation boundaries):</p>
            <ul className="list-disc pl-4 text-xs space-y-1">
              <li>Custom fields (e.g. Patient ID, Machine Number)</li>
              <li>Custom forms and dashboards</li>
              <li>Custom reports and approval rules</li>
              <li>Custom notifications and workflows</li>
            </ul>
            <p className="text-xs">
              Hospital example: Patient ID + Insurance fields. Manufacturing:
              Machine Number + Production Line. Custom data never crosses
              tenants.
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/tenants">Per-tenant controls</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/platform/flags">Feature flags</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <AccessMatrixCard />
      </div>
    </ControlPlaneSectionPage>
  );
}
