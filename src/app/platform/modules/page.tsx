"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { listPlatformModules, type PlatformModule } from "@/lib/platform";

export default function PlatformModulesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PlatformModule[]>([]);

  useEffect(() => {
    listPlatformModules()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading module catalog…" />;

  return (
    <div>
      <PageHeader
        title="Module catalog"
        description="Enterprise modules available to tenants"
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Core</TableHead>
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.module_code}>
                <TableCell className="font-mono text-xs">{r.module_code}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-xs">{r.category}</TableCell>
                <TableCell>
                  {r.is_core ? <Badge className="text-[10px]">core</Badge> : "—"}
                </TableCell>
                <TableCell>
                  {r.href ? (
                    <Link href={r.href} className="text-xs text-primary underline">
                      Open
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
