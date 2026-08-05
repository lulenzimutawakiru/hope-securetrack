"use client";

/**
 * Shared layout for Enterprise Control Plane section pages.
 */

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CONTROL_PLANE_CAPABILITIES,
  ACCESS_MATRIX,
} from "@/lib/platform/control-plane-registry";

export function ControlPlaneSectionPage({
  title,
  description,
  capabilityId,
  children,
  actions,
}: {
  title: string;
  description: string;
  capabilityId?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const cap = capabilityId
    ? CONTROL_PLANE_CAPABILITIES.find((c) => c.id === capabilityId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />
      {cap && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px] capitalize">
            Layer: {cap.layer}
          </Badge>
          {cap.roles.map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px]">
              {r}
            </Badge>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

export function AccessMatrixCard() {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm font-medium mb-2">Access matrix (CPanel)</p>
        <ul className="space-y-1 text-xs">
          {ACCESS_MATRIX.map((row) => (
            <li
              key={row.role}
              className="flex justify-between gap-2 border-b py-1 last:border-0"
            >
              <span className="font-medium">{row.role}</span>
              <span className="text-muted-foreground text-right">
                {row.access}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground mt-3">
          ❌ Tenant admins and ERP users never access the Control Plane. ❌ No
          cross-tenant visibility. ❌ No unlogged mutations. ❌ No raw SQL.
        </p>
        <Button size="sm" variant="outline" className="mt-2" asChild>
          <Link href="/platform">Command Center</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
