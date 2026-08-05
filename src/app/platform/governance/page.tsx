"use client";

import Link from "next/link";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformGovernancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data governance"
        description="Isolation, retention, residency, and export controls for the multi-tenant estate"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" /> Isolation model
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Tenant → Company → Branch · RLS on company_id / tenant_id</p>
            <p>Service-role only via scoped admin + staff cPanel APIs</p>
            <p>Browser writes banned; CRUD engine strips identity fields</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lifecycle & retention</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Soft delete on tenants (deleted_at + cancelled)</p>
            <p>Legal hold / offboarding schedule via platform ops</p>
            <p>Hard delete detaches companies; full purge is dual-control</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="/platform/tenants">Tenant data scopes</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/platform/ops">Offboarding</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/platform/compliance">Compliance</Link>
        </Button>
      </div>
    </div>
  );
}
