"use client";

/**
 * Access Reviews - privileged access attestation for platform staff,
 * MFA posture, and the capability matrix per platform role.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Link2,
  Users,
  Fingerprint,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { AccessReviewSummary } from "@/lib/platform/admin-console";

export default function AccessReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccessReviewSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/platform/access-reviews");
        const json = await res.json();
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error?.message || "Failed to load access reviews");
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

  if (loading) return <LoadingState message="Loading access reviews..." />;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Access reviews unavailable</p>
        <p className="text-muted-foreground mt-1">{error || "No data"}</p>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Reviews"
        description="Privileged platform access attestation - who can reach the control plane"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Platform admins" value={formatNumber(t.platform_admins)} />
        <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Legacy (full access)" value={formatNumber(t.legacy_admins)} />
        <MetricCard icon={<KeyRound className="h-4 w-4" />} label="Without MFA" value={formatNumber(t.without_mfa)} />
        <MetricCard icon={<Link2 className="h-4 w-4" />} label="Roles / Permissions" value={`${formatNumber(t.roles)} / ${formatNumber(t.permissions)}`} />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Platform staff <span className="text-xs font-normal text-muted-foreground">{t.active_users} active users estate-wide</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.staff.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No platform staff"
              description="Staff profiles with platform access will be listed here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right">Capabilities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-medium">{s.name || "Unnamed"}</p>
                        <p className="text-[11px] text-muted-foreground">{s.email || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.role_label}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.is_legacy ? (
                          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> legacy full access
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Fingerprint className="h-3 w-3 text-hope-teal" /> matrix
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.mfa_enabled ? (
                          <Badge className="text-[10px]">enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                            missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.last_login_at ? new Date(s.last_login_at).toLocaleString() : "never"}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(s.capabilities)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Capability matrix by platform role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Capabilities</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.capability_matrix.map((m) => (
                  <TableRow key={m.role}>
                    <TableCell className="font-medium whitespace-nowrap">{m.label}</TableCell>
                    <TableCell className="max-w-xl">
                      <div className="flex flex-wrap gap-1">
                        {m.capabilities.map((c) => (
                          <Badge key={c.id} variant="outline" className="text-[10px]">
                            {c.title}
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

      <p className="text-[10px] text-muted-foreground">
        Snapshot {new Date(data.generated_at).toLocaleString()} - access reviews are
        read-only; attestation workflows are governed by Compliance.
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