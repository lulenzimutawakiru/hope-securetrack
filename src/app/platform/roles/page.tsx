"use client";

/**
 * Roles & Permissions - RBAC catalog, platform staff capability matrix,
 * and permissions grouped by ERP module.
 */

import { useEffect, useState } from "react";
import { Shield, KeyRound, Link2, Users, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { RolesMatrix } from "@/lib/platform/admin-console";

export default function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RolesMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/roles");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load roles");
        }
        setData(json.data ?? json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading RBAC catalog..." />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Roles unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="RBAC role catalog, platform staff access matrix, and permission inventory"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Shield className="h-4 w-4" />} label="Roles" value={formatNumber(t.roles)} />
        <MetricCard icon={<KeyRound className="h-4 w-4" />} label="Permissions" value={formatNumber(t.permissions)} />
        <MetricCard icon={<Link2 className="h-4 w-4" />} label="Role-permission links" value={formatNumber(t.role_permissions)} />
        <MetricCard icon={<Users className="h-4 w-4" />} label="Users with roles" value={formatNumber(t.users_with_roles)} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Role catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Permissions</TableHead>
                <TableHead className="text-right">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    {r.description && (
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.slug}</TableCell>
                  <TableCell>
                    {r.is_system ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 text-hope-teal" /> system
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <XCircle className="h-3 w-3" /> custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.is_active ? (
                      <Badge className="text-[10px]">active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(r.permission_count)}</TableCell>
                  <TableCell className="text-right">{formatNumber(r.user_count)}</TableCell>
                </TableRow>
              ))}
              {data.roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No roles defined yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Platform staff access matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Capabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.platform_roles.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-muted-foreground">{r.description}</TableCell>
                    <TableCell className="max-w-xl">
                      <div className="flex flex-wrap gap-1">
                        {r.capabilities.map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Permissions by module</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {data.modules.map((module) => (
              <div key={module} className="rounded-md border px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                  {module}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {data.permissions
                    .filter((p) => p.module === module)
                    .map((p) => (
                      <Badge key={p.id} variant="outline" className="font-mono text-[10px]">
                        {p.slug}
                      </Badge>
                    ))}
                </div>
              </div>
            ))}
            {data.modules.length === 0 && (
              <p className="text-sm text-muted-foreground">No permissions defined yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Snapshot {new Date(data.generated_at).toLocaleString()} - RBAC catalog is
        read-only here; changes flow through the ERP role administration surfaces.
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}