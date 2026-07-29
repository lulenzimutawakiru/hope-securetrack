"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listSchedules } from "@/lib/communications";
import { formatDate } from "@/lib/utils";

export default function ScheduledPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    listSchedules(auth.profile.company_id)
      .then((d) => setRows(d as Array<Record<string, unknown>>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading schedules…" />;

  return (
    <div>
      <PageHeader
        title="Scheduled Communications"
        description="Monthly statements · payslips · renewals · KPI reports"
      />
      {rows.length === 0 ? (
        <EmptyState title="No schedules" description="Seeded schedules appear after migration." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Cron / Next</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.schedule_code)}</TableCell>
                  <TableCell className="text-sm font-medium">{String(r.name)}</TableCell>
                  <TableCell className="text-xs">{String(r.schedule_type)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.channel)}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {String(r.cron_expression || "—")}
                    <br />
                    {r.next_run_at ? formatDate(String(r.next_run_at)) : ""}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{String(r.status)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
