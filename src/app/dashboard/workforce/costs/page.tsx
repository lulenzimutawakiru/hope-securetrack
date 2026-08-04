"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";

export default function LaborCostsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("labor_cost_entries")
        .select("*, employees(first_name,last_name,department)")
        .order("work_date", { ascending: false })
        .limit(200);
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total_cost || 0), 0);
    const ot = rows.reduce((s, r) => s + Number(r.overtime_cost || 0), 0);
    const hours = rows.reduce(
      (s, r) => s + Number(r.regular_hours || 0) + Number(r.overtime_hours || 0),
      0
    );
    return { total, ot, hours };
  }, [rows]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Labor Cost Management"
        description="Cost per shift, department, and production line — Finance / payroll ready (UGX)"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard
          title="Total labor cost"
          value={`UGX ${formatNumber(Math.round(totals.total))}`}
          icon={Coins}
        />
        <StatCard
          title="Overtime cost"
          value={`UGX ${formatNumber(Math.round(totals.ot))}`}
        />
        <StatCard title="Hours logged" value={formatNumber(Math.round(totals.hours))} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No labor cost entries"
          description="Clock-out from Attendance automatically posts cost snapshots"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Reg h</TableHead>
                <TableHead>OT h</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const emp = r.employees as {
                  first_name: string;
                  last_name: string;
                  department: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>{formatDate(String(r.work_date))}</TableCell>
                    <TableCell>
                      {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                    </TableCell>
                    <TableCell>
                      {String(r.department || emp?.department || "—")}
                    </TableCell>
                    <TableCell>{String(r.regular_hours)}</TableCell>
                    <TableCell>{String(r.overtime_hours)}</TableCell>
                    <TableCell>
                      {String(r.currency || "UGX")}{" "}
                      {formatNumber(Number(r.total_cost || 0))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
