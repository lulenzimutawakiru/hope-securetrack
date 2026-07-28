"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, LogIn, LogOut } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

interface Attendance {
  id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  method: string | null;
  late_minutes: number | null;
  overtime_minutes: number | null;
  employees?: { first_name: string; last_name: string; employee_number: string } | null;
}

export default function AttendancePage() {
  const { auth } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Attendance[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const [{ data: e }, { data: a }] = await Promise.all([
      supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number")
        .eq("status", "active")
        .order("last_name"),
      supabase
        .from("attendance_records")
        .select(
          "*, employees(first_name,last_name,employee_number)"
        )
        .order("work_date", { ascending: false })
        .order("check_in", { ascending: false })
        .limit(100),
    ]);
    setEmployees((e as Employee[]) ?? []);
    setRows((a as Attendance[]) ?? []);
    if (e?.[0] && !employeeId) setEmployeeId(e[0].id);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clock = async (type: "in" | "out") => {
    if (!auth || !employeeId) {
      toast.error("Select an employee");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* optional GPS */
      }

      const { data: existing } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("work_date", today)
        .maybeSingle();

      if (type === "in") {
        if (existing?.check_in) {
          toast.message("Already clocked in today");
          return;
        }
        // Late if after 08:15
        const hour = new Date().getHours();
        const min = new Date().getMinutes();
        const late = hour > 8 || (hour === 8 && min > 15) ? (hour - 8) * 60 + Math.max(0, min - 15) : 0;

        if (existing) {
          await supabase
            .from("attendance_records")
            .update({
              check_in: now,
              method: lat ? "mobile_gps" : "web",
              check_in_lat: lat ?? null,
              check_in_lng: lng ?? null,
              late_minutes: late,
              status: late > 0 ? "late" : "present",
            })
            .eq("id", existing.id);
        } else {
          const { error } = await supabase.from("attendance_records").insert({
            company_id: auth.profile.company_id,
            employee_id: employeeId,
            work_date: today,
            check_in: now,
            method: lat ? "mobile_gps" : "web",
            check_in_lat: lat ?? null,
            check_in_lng: lng ?? null,
            late_minutes: late,
            status: late > 0 ? "late" : "present",
          });
          if (error) throw error;
        }
        toast.success("Clocked in");
      } else {
        if (!existing?.check_in) {
          toast.error("No clock-in found for today");
          return;
        }
        if (existing.check_out) {
          toast.message("Already clocked out");
          return;
        }
        const inTime = new Date(existing.check_in).getTime();
        const outTime = Date.now();
        const workedMin = Math.max(0, Math.round((outTime - inTime) / 60000));
        const overtime = Math.max(0, workedMin - 8 * 60);

        const { error } = await supabase
          .from("attendance_records")
          .update({
            check_out: now,
            check_out_lat: lat ?? null,
            check_out_lng: lng ?? null,
            productive_minutes: workedMin,
            overtime_minutes: overtime,
            status: "present",
          })
          .eq("id", existing.id);
        if (error) throw error;

        // Labor cost snapshot (simple)
        const { data: emp } = await supabase
          .from("employees")
          .select("hourly_rate, department, cost_center")
          .eq("id", employeeId)
          .single();
        const rate = Number(emp?.hourly_rate || 15000);
        const regH = Math.min(8, workedMin / 60);
        const otH = overtime / 60;
        await supabase.from("labor_cost_entries").insert({
          company_id: auth.profile.company_id,
          employee_id: employeeId,
          work_date: today,
          department: emp?.department || null,
          cost_center: emp?.cost_center || null,
          regular_hours: Number(regH.toFixed(2)),
          overtime_hours: Number(otH.toFixed(2)),
          regular_cost: Number((regH * rate).toFixed(2)),
          overtime_cost: Number((otH * rate * 1.5).toFixed(2)),
          total_cost: Number((regH * rate + otH * rate * 1.5).toFixed(2)),
          currency: "UGX",
          source: "attendance",
        });

        toast.success(
          overtime > 0
            ? `Clocked out · OT ${overtime} min`
            : "Clocked out"
        );
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attendance failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => r.work_date === today).length;
  const lateCount = rows.filter((r) => (r.late_minutes || 0) > 0).length;

  return (
    <div>
      <PageHeader
        title="Attendance Management"
        description="Web, GPS mobile check-in · late · OT · ready for biometric / RFID / QR devices"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={busy || !employeeId} onClick={() => clock("in")}>
              <LogIn className="mr-2 h-4 w-4" /> Clock in
            </Button>
            <Button
              variant="outline"
              disabled={busy || !employeeId}
              onClick={() => clock("out")}
            >
              <LogOut className="mr-2 h-4 w-4" /> Clock out
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Records" value={formatNumber(rows.length)} icon={ClipboardCheck} />
        <StatCard title="Today" value={formatNumber(todayCount)} />
        <StatCard title="Late events" value={formatNumber(lateCount)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance yet"
          description="Clock in employees or connect biometric / QR terminals"
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>OT</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.work_date)}</TableCell>
                  <TableCell>
                    {r.employees
                      ? `${r.employees.first_name} ${r.employees.last_name}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.check_in ? formatDateTime(r.check_in) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.check_out ? formatDateTime(r.check_out) : "—"}
                  </TableCell>
                  <TableCell className="capitalize text-xs">
                    {(r.method || "web").replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>{r.late_minutes || 0}m</TableCell>
                  <TableCell>{r.overtime_minutes || 0}m</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status || "present"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
