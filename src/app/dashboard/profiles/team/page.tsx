"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Target, Clock, Award } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import type { EmployeeProfile } from "@/lib/profile";

export default function ManagerTeamPage() {
  const { auth } = useUser();
  const [team, setTeam] = useState<EmployeeProfile[]>([]);
  const [leavePending, setLeavePending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      let managerId: string | null = null;

      if (auth?.user?.id) {
        const { data: me } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        managerId = me?.id || null;
        setMyEmployeeId(managerId);
      }

      let query = supabase
        .from("employees")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("last_name")
        .limit(100);

      if (managerId) {
        query = query.eq("manager_employee_id", managerId);
      }

      const { data } = await query;
      let rows = (data as EmployeeProfile[]) || [];

      // If no direct reports, show department peers for managers with profile.manager / hr
      if (rows.length === 0) {
        const { data: all } = await supabase
          .from("employees")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "active")
          .order("last_name")
          .limit(50);
        rows = (all as EmployeeProfile[]) || [];
      }

      setTeam(rows);

      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { count } = await supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .in("employee_id", ids);
        setLeavePending(count ?? 0);
      }
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading team profiles…" />;

  const avgCompletion =
    team.length > 0
      ? team.reduce((s, r) => s + Number(r.profile_completion_pct || 0), 0) / team.length
      : 0;

  return (
    <div>
      <PageHeader
        title="Manager · Team Profiles"
        description="Attendance · performance · skills · leave · workload"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/hr/leave">Leave approvals</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Team members" value={String(team.length)} icon={Users} />
        <StatCard title="Avg completion" value={`${formatNumber(avgCompletion)}%`} icon={Award} />
        <StatCard title="Pending leave" value={String(leavePending)} icon={Clock} />
        <StatCard title="Active" value={String(team.filter((t) => t.status === "active").length)} icon={Target} />
      </div>

      {!myEmployeeId && (
        <Card className="mb-4">
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Your user is not linked to an employee manager record — showing company active employees.
          </CardContent>
        </Card>
      )}

      {team.length === 0 ? (
        <EmptyState title="No team members" description="Assign reporting managers on employee profiles." />
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Direct reports & team</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Leave bal.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.first_name} {r.last_name}</div>
                        <div className="text-xs font-mono text-muted-foreground">{r.employee_number}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.job_title || "—"}</TableCell>
                      <TableCell className="text-sm">{r.department || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, Number(r.profile_completion_pct || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs">{formatNumber(r.profile_completion_pct || 0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatNumber(r.leave_balance_days || 0)}</TableCell>
                      <TableCell><StatusBadge status={r.status || "active"} /></TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/profiles/${r.id}`}>360°</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
