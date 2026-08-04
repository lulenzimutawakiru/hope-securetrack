"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { downloadCsv, toCsv } from "@/lib/attendance";
import { crudCount, crudList } from "@/lib/api/crud-client";
import { toast } from "sonner";

const REPORTS = [
  { id: "daily", title: "Daily Attendance", table: "attendance_records", cols: ["work_date", "check_in", "check_out", "hours_worked", "late_minutes", "overtime_minutes", "status", "location_name"] },
  { id: "events", title: "Clock Events", table: "att_events", cols: ["event_code", "employee_name", "event_type", "location_name", "method", "verification_status", "distance_m", "event_at"] },
  { id: "violations", title: "Geofence / Fraud Violations", table: "att_violations", cols: ["violation_code", "employee_name", "violation_type", "severity", "status", "details"] },
  { id: "devices", title: "Device Activity", table: "att_devices", cols: ["device_code", "name", "vendor", "status", "last_sync_at", "last_heartbeat_at", "branch_name"] },
  { id: "corrections", title: "Corrections", table: "att_corrections", cols: ["correction_number", "employee_name", "work_date", "status", "reason"] },
  { id: "field", title: "Field Assignments", table: "att_field_assignments", cols: ["assignment_code", "employee_name", "project_code", "customer_name", "status"] },
] as const;

export default function AttendanceReportsPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const next: Record<string, number> = {};
      await Promise.all(
        REPORTS.map(async (r) => {
          try {
            next[r.id] = await crudCount(r.table);
          } catch {
            next[r.id] = 0;
          }
        })
      );
      setCounts(next);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [companyId]);

  const exportReport = async (r: (typeof REPORTS)[number]) => {
    if (!companyId) return;
    try {
      const res = await crudList<Record<string, unknown>>(r.table, {
        page: 1,
        pageSize: 100,
      });
      if (!res.ok) throw new Error(res.error);
      // Walk additional pages up to ~500 rows for CSV
      let rows = res.data.data;
      const total = res.data.total;
      if (total > 100) {
        const pages = Math.min(5, Math.ceil(total / 100));
        for (let p = 2; p <= pages; p++) {
          const more = await crudList<Record<string, unknown>>(r.table, {
            page: p,
            pageSize: 100,
          });
          if (more.ok) rows = rows.concat(more.data.data);
        }
      }
      downloadCsv(
        `attendance-${r.id}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(rows, [...r.cols])
      );
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  if (loading) return <LoadingState message="Loading attendance reports…" />;

  return (
    <div>
      <PageHeader title="Attendance Reports" description="Daily · events · violations · devices · field · CSV export" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{counts[r.id] ?? 0} records</span>
              <Button size="sm" variant="outline" onClick={() => exportReport(r)}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
