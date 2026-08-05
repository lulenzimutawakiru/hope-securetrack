"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import type { CommandCenterSnapshot } from "@/lib/platform/control-plane";

export default function PlatformCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommandCenterSnapshot | null>(null);

  useEffect(() => {
    fetch("/api/platform/command-center")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading compliance…" />;

  const h = data?.health;
  const s = data?.security;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description="Controls evidence, dual-control, legal hold, and audit posture"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">MFA enforced</p>
            <Badge className="mt-1" variant={h?.mfa_enforced ? "secondary" : "destructive"}>
              {h?.mfa_enforced ? "yes" : "no"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Dual control</p>
            <Badge className="mt-1" variant={h?.dual_control ? "secondary" : "destructive"}>
              {h?.dual_control ? "yes" : "no"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Open security alerts</p>
            <p className="text-2xl font-semibold">{s?.open_alerts ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4" /> Control framework map
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <strong className="text-foreground">Access:</strong> RBAC + RLS +
            platform staff isolation
          </p>
          <p>
            <strong className="text-foreground">Sensitive actions:</strong> MFA
            AAL2 + dual control (payroll, identity, purge)
          </p>
          <p>
            <strong className="text-foreground">Tenant exit:</strong>{" "}
            offboarding schedule, legal hold, purge eligibility
          </p>
          <p>
            <strong className="text-foreground">Evidence:</strong> domain_events,
            audit logs, config change log, SBOM / readiness scripts
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/ops">Offboarding / elevation</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/audit">Audit module</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/governance">Data governance</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
