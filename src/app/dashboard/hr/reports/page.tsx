"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileBarChart, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { downloadCsv } from "@/lib/documents";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

type ReportKey =
  | "directory"
  | "leave"
  | "payroll"
  | "recruitment"
  | "training"
  | "turnover";

export default function HrReportsPage() {
  const [report, setReport] = useState<ReportKey>("directory");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let data: Array<Record<string, unknown>> | null = null;

      if (report === "directory") {
        const res = await supabase
          .from("employees")
          .select(
            "employee_number, first_name, last_name, department, job_title, status, hire_date, salary"
          )
          .order("last_name")
          .limit(300);
        data = res.data;
      } else if (report === "leave") {
        const res = await supabase
          .from("leave_requests")
          .select(
            "leave_type, start_date, end_date, days, status, employees(employee_number, first_name, last_name)"
          )
          .order("start_date", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "payroll") {
        const res = await supabase
          .from("payroll_runs")
          .select(
            "run_number, period_label, employee_count, gross_total, net_total, status"
          )
          .order("period_start", { ascending: false });
        data = res.data;
      } else if (report === "recruitment") {
        const res = await supabase
          .from("job_applicants")
          .select(
            "applicant_number, first_name, last_name, stage, email, job_requisitions(title)"
          )
          .order("created_at", { ascending: false })
          .limit(200);
        data = res.data;
      } else if (report === "training") {
        const res = await supabase
          .from("training_enrollments")
          .select(
            "status, completed_at, training_courses(course_code, title), employees(employee_number, first_name)"
          )
          .limit(200);
        data = res.data;
      } else {
        const res = await supabase
          .from("employee_exits")
          .select(
            "exit_number, exit_type, status, last_working_day, employees(employee_number, first_name, last_name)"
          )
          .order("created_at", { ascending: false });
        data = res.data;
      }

      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, [report]);

  const exportCsv = () => {
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object");
    downloadCsv(
      `hr-${report}-${new Date().toISOString().slice(0, 10)}.csv`,
      keys,
      rows.map((r) => keys.map((k) => r[k] as string | number | null))
    );
    toast.success("CSV exported");
  };

  const cards: { key: ReportKey; title: string; desc: string }[] = [
    { key: "directory", title: "Employee Register", desc: "Headcount directory" },
    { key: "leave", title: "Leave Report", desc: "Requests & status" },
    { key: "payroll", title: "Payroll Report", desc: "Run totals" },
    { key: "recruitment", title: "Recruitment", desc: "Applicant pipeline" },
    { key: "training", title: "Training", desc: "Enrollments" },
    { key: "turnover", title: "Exit / Turnover", desc: "Separations" },
  ];

  return (
    <div>
      <PageHeader
        title="HR Reports"
        description="Directory · leave · payroll · recruitment · training · turnover · CSV"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {cards.map((c) => (
          <Card
            key={c.key}
            className={`cursor-pointer ${report === c.key ? "border-hope-teal ring-1 ring-hope-teal/30" : ""}`}
            onClick={() => setReport(c.key)}
          >
            <CardHeader className="pb-1 flex flex-row items-center gap-2 space-y-0">
              <FileBarChart className="h-4 w-4 text-hope-teal" />
              <CardTitle className="text-sm">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{c.desc}</CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {report === "directory" && (
                  <>
                    <TableHead>Emp #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hire</TableHead>
                  </>
                )}
                {report === "leave" && (
                  <>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "payroll" && (
                  <>
                    <TableHead>Run</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Headcount</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "recruitment" && (
                  <>
                    <TableHead>App #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Stage</TableHead>
                  </>
                )}
                {report === "training" && (
                  <>
                    <TableHead>Employee</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
                {report === "turnover" && (
                  <>
                    <TableHead>Exit #</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Last day</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => {
                  const emp = r.employees as {
                    employee_number?: string;
                    first_name?: string;
                    last_name?: string;
                  } | null;
                  const jr = r.job_requisitions as { title?: string } | null;
                  const course = r.training_courses as {
                    course_code?: string;
                    title?: string;
                  } | null;
                  return (
                    <TableRow key={i}>
                      {report === "directory" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.employee_number)}
                          </TableCell>
                          <TableCell>
                            {String(r.first_name)} {String(r.last_name)}
                          </TableCell>
                          <TableCell>{String(r.department ?? "—")}</TableCell>
                          <TableCell>{String(r.job_title ?? "—")}</TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                          <TableCell>
                            {r.hire_date ? formatDate(String(r.hire_date)) : "—"}
                          </TableCell>
                        </>
                      )}
                      {report === "leave" && (
                        <>
                          <TableCell>
                            {emp?.employee_number} {emp?.first_name}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.leave_type)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(String(r.start_date))} →{" "}
                            {formatDate(String(r.end_date))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.days))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "payroll" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.run_number)}
                          </TableCell>
                          <TableCell>{String(r.period_label)}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Number(r.employee_count))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.gross_total)))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(Math.round(Number(r.net_total)))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "recruitment" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.applicant_number)}
                          </TableCell>
                          <TableCell>
                            {String(r.first_name)} {String(r.last_name)}
                          </TableCell>
                          <TableCell>{jr?.title ?? "—"}</TableCell>
                          <TableCell className="capitalize">
                            {String(r.stage)}
                          </TableCell>
                        </>
                      )}
                      {report === "training" && (
                        <>
                          <TableCell>
                            {emp?.employee_number} {emp?.first_name}
                          </TableCell>
                          <TableCell>
                            {course?.course_code} {course?.title}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                      {report === "turnover" && (
                        <>
                          <TableCell className="font-mono text-sm">
                            {String(r.exit_number)}
                          </TableCell>
                          <TableCell>
                            {emp?.employee_number} {emp?.first_name}{" "}
                            {emp?.last_name}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.exit_type).replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            {r.last_working_day
                              ? formatDate(String(r.last_working_day))
                              : "—"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(r.status)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
