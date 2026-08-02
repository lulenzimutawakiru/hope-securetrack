"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function PeriodsPage() {
  const { auth } = useUser();
  const [years, setYears] = useState<Array<Record<string, unknown>>>([]);
  const [periods, setPeriods] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: y }, { data: p }] = await Promise.all([
      supabase.from("fiscal_years").select("*").order("start_date", { ascending: false }),
      supabase
        .from("fiscal_periods")
        .select("*")
        .order("period_number"),
    ]);
    setYears(y ?? []);
    setPeriods(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setPeriodStatus = async (
    id: string,
    status: "open" | "soft_close" | "closed" | "locked"
  ) => {
    const supabase = createClient();
    const patch: Record<string, unknown> = { status };
    if (status === "closed" || status === "locked") {
      patch.closed_at = new Date().toISOString();
      patch.closed_by = auth?.profile.id;
    }
    const crudRes = await crudUpdate("fiscal_periods", id, patch);
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success(`Period ${status.replace(/_/g, " ")}`);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Fiscal Periods"
        description="Open Â· soft close Â· close Â· lock Â· reopen with approval"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/finance">Hub</Link>
          </Button>
        }
      />

      <h3 className="font-medium mb-2">Fiscal years</h3>
      {years.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No fiscal years"
          description="Seeded with FY2026 on install"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={String(y.id)}>
                  <TableCell className="font-medium">{String(y.name)}</TableCell>
                  <TableCell>{formatDate(String(y.start_date))}</TableCell>
                  <TableCell>{formatDate(String(y.end_date))}</TableCell>
                  <TableCell>{y.is_current ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <StatusBadge status={String(y.status)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Accounting periods</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((p) => (
              <TableRow key={String(p.id)}>
                <TableCell>{String(p.period_number)}</TableCell>
                <TableCell>{String(p.name)}</TableCell>
                <TableCell>{formatDate(String(p.start_date))}</TableCell>
                <TableCell>{formatDate(String(p.end_date))}</TableCell>
                <TableCell>
                  <StatusBadge status={String(p.status)} />
                </TableCell>
                <TableCell className="space-x-1">
                  {p.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPeriodStatus(String(p.id), "closed")}
                    >
                      Close
                    </Button>
                  )}
                  {p.status === "closed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPeriodStatus(String(p.id), "open")}
                      >
                        Reopen
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setPeriodStatus(String(p.id), "locked")}
                      >
                        Lock
                      </Button>
                    </>
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
