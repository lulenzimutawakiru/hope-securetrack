"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listFeatureFlags } from "@/lib/platform";

export default function FeatureFlagsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    listFeatureFlags()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading feature flags…" />;

  return (
    <div>
      <PageHeader
        title="Feature flags"
        description="Global flags · per-tenant overrides via tenant_feature_flags"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Default</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id || r.flag_key)}>
                <TableCell className="font-mono text-xs">{String(r.flag_key)}</TableCell>
                <TableCell>{String(r.name)}</TableCell>
                <TableCell className="text-xs">{String(r.category)}</TableCell>
                <TableCell>
                  <Badge variant={r.default_enabled ? "secondary" : "outline"} className="text-[10px]">
                    {r.default_enabled ? "on" : "off"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
