"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformWorkflowsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Platform-level workflow engine, dual-control, and tenant automation"
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Workflow surfaces
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Domain workflows (paper pipeline, onboarding, approvals) run inside
            tenant ERP contexts. The control plane governs dual-control gates
            and job-backed automation.
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Dual control: payroll, identity reset, tenant purge</li>
            <li>Job queue: email outbox, domain event consumers, SLA cron</li>
            <li>Tenant setup wizard progress per org</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/workflows">ERP workflows</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/security/dual-control">Dual control</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/platform/jobs">Jobs</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
