"use client";

/**
 * Module Management — ERP module catalog + enablement model.
 * Per-tenant toggles live on each tenant detail page.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listPlatformModules, type PlatformModule } from "@/lib/platform";
import { ERP_MODULE_CATALOG } from "@/lib/platform/control-plane-registry";

const MODULE_LABELS: Record<string, string> = {
  finance: "Finance",
  hr: "HR",
  payroll: "Payroll",
  crm: "CRM",
  procurement: "Procurement",
  inventory: "Inventory",
  manufacturing: "Manufacturing",
  assets: "Asset Management",
  fleet: "Fleet",
  service_desk: "Service Desk",
  projects: "Projects",
  recruitment: "Recruitment",
  ai_assistant: "AI Assistant",
  sales: "Sales",
  dispatch: "Dispatch",
  attendance: "Attendance",
};

export default function PlatformModulesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformModule[]>([]);

  useEffect(() => {
    listPlatformModules()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading module catalog..." />;

  const dbCodes = new Set(rows.map((r) => r.module_code.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module Management"
        description="Control ERP modules estate-wide. Enable or disable per tenant from Tenant Management."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/platform/tenants">Manage tenants</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Enterprise ERP catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ERP_MODULE_CATALOG.map((code) => (
              <div
                key={code}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {MODULE_LABELS[code] || code}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {code}
                  </p>
                </div>
                <Badge
                  variant={dbCodes.has(code) ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {dbCodes.has(code) ? "in DB" : "catalog"}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Example: Tenant A may have Finance + Payroll + Manufacturing while
            Tenant B has CRM + Inventory + HR only. Isolation is always
            enforced — modules never grant cross-tenant access.
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Platform module registry</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Core</TableHead>
                <TableHead>Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.module_code}>
                  <TableCell className="font-mono text-xs">
                    {r.module_code}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.category || "-"}</TableCell>
                  <TableCell>
                    {r.is_core ? (
                      <Badge className="text-[10px]">core</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.default_enabled === false ? "off" : "on"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No platform_modules rows. Seed catalog or use enterprise
                    codes above during provision.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
