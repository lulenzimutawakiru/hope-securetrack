"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCircle, CalendarDays, Wallet, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatDate, formatNumber } from "@/lib/utils";

export default function SelfServicePage() {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [leave, setLeave] = useState<Array<Record<string, unknown>>>([]);
  const [payslips, setPayslips] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // Demo ESS: first active employee as "me"
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("status", "active")
        .order("employee_number")
        .limit(1)
        .maybeSingle();

      if (emp) {
        setEmployee(emp);
        const [{ data: l }, { data: pl }, { data: a }] = await Promise.all([
          supabase
            .from("leave_requests")
            .select("*")
            .eq("employee_id", emp.id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("payroll_lines")
            .select("*, payroll_runs(period_label, pay_date, run_number)")
            .eq("employee_id", emp.id)
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("employee_assets")
            .select("*")
            .eq("employee_id", emp.id)
            .eq("status", "issued"),
        ]);
        setLeave(l ?? []);
        setPayslips(pl ?? []);
        setAssets(a ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading self-service…" />;

  return (
    <div>
      <PageHeader
        title="Employee Self-Service"
        description="Profile · leave · payslips · assets · policies · ESS / MSS portal"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/hr/leave">Apply leave</Link>
            </Button>
          </div>
        }
      />

      {!employee ? (
        <p className="text-sm text-muted-foreground">
          No employee profile linked. Create employees in the directory first.
        </p>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-full bg-hope-navy/10 p-3">
                <UserCircle className="h-8 w-8 text-hope-teal" />
              </div>
              <div>
                <CardTitle>
                  {String(employee.first_name)} {String(employee.last_name)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {String(employee.employee_number)} · {String(employee.job_title ?? "")} ·{" "}
                  {String(employee.department ?? "")}
                </p>
              </div>
              <Badge className="ml-auto capitalize">{String(employee.status)}</Badge>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Email</span>
                <div>{String(employee.email ?? "—")}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Phone</span>
                <div>{String(employee.phone ?? "—")}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Hire date</span>
                <div>
                  {employee.hire_date
                    ? formatDate(String(employee.hire_date))
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Leave balance</span>
                <div>{formatNumber(Number(employee.leave_balance_days || 0))} days</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <CardTitle className="text-base">My leave</CardTitle>
              </CardHeader>
              <CardContent>
                {leave.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No leave history</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leave.map((l) => (
                        <TableRow key={String(l.id)}>
                          <TableCell className="capitalize">
                            {String(l.leave_type)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(String(l.start_date))} →{" "}
                            {formatDate(String(l.end_date))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {String(l.status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Wallet className="h-4 w-4" />
                <CardTitle className="text-base">My payslips</CardTitle>
              </CardHeader>
              <CardContent>
                {payslips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payslips yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payslips.map((p) => {
                        const run = p.payroll_runs as {
                          period_label?: string;
                        } | null;
                        return (
                          <TableRow key={String(p.id)}>
                            <TableCell>{run?.period_label ?? "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatNumber(Number(p.net_pay))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                <Button asChild variant="link" className="px-0 mt-2" size="sm">
                  <Link href="/dashboard/hr/payroll">Open payroll / print</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2">
                <FileText className="h-4 w-4" />
                <CardTitle className="text-base">My assets</CardTitle>
              </CardHeader>
              <CardContent>
                {assets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assets assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assets.map((a) => (
                      <Badge key={String(a.id)} variant="secondary" className="py-1.5">
                        {String(a.asset_type)} · {String(a.asset_tag ?? a.description)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
