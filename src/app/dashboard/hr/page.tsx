"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  CalendarDays,
  Wallet,
  Target,
  GraduationCap,
  LogOut,
  UserCircle,
  Brain,
  ArrowRight,
  FileBarChart,
  Briefcase,
  Contact,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const LIFECYCLE = [
  "Plan",
  "Recruit",
  "Hire",
  "Onboard",
  "Perform",
  "Train",
  "Promote",
  "Exit",
];

const MODULES = [
  { title: "Employees", href: "/dashboard/hr/employees", icon: Users, desc: "Master records & directory" },
  { title: "Recruitment", href: "/dashboard/hr/recruitment", icon: UserPlus, desc: "Jobs & applicant pipeline" },
  { title: "Leave", href: "/dashboard/hr/leave", icon: CalendarDays, desc: "Balances & approvals" },
  { title: "Payroll", href: "/dashboard/payroll", icon: Wallet, desc: "Enterprise PAYE · NSSF · payslips" },
  { title: "Performance", href: "/dashboard/hr/performance", icon: Target, desc: "Reviews & OKRs" },
  { title: "Training", href: "/dashboard/hr/training", icon: GraduationCap, desc: "L&D & certifications" },
  { title: "Exit", href: "/dashboard/hr/exit", icon: LogOut, desc: "Clearance & settlements" },
  { title: "Self-Service", href: "/dashboard/hr/self-service", icon: UserCircle, desc: "ESS / MSS portal" },
  { title: "Digital Profiles", href: "/dashboard/profiles", icon: Contact, desc: "360° identity · skills · docs" },
  { title: "Reports", href: "/dashboard/hr/reports", icon: FileBarChart, desc: "Headcount & analytics" },
  { title: "Workforce", href: "/dashboard/workforce", icon: Briefcase, desc: "Shifts · OT · safety" },
  { title: "ID Credentials", href: "/dashboard/credentials", icon: Contact, desc: "Smart badges · access · print" },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
  department: string | null;
}

export default function HrHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    headcount: 0,
    openJobs: 0,
    applicants: 0,
    pendingLeave: 0,
    payrollNet: 0,
    openExits: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        emp,
        jobs,
        apps,
        leave,
        payroll,
        exits,
        { data: ins },
      ] = await Promise.all([
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("job_requisitions")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("job_applicants")
          .select("*", { count: "exact", head: true })
          .not("stage", "in", '("hired","rejected","withdrawn")'),
        supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("payroll_runs")
          .select("net_total")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("employee_exits")
          .select("*", { count: "exact", head: true })
          .neq("status", "completed"),
        supabase
          .from("hr_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        headcount: emp.count ?? 0,
        openJobs: jobs.count ?? 0,
        applicants: apps.count ?? 0,
        pendingLeave: leave.count ?? 0,
        payrollNet: Number(payroll.data?.net_total || 0),
        openExits: exits.count ?? 0,
      });
      setInsights((ins as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading human capital platform…" />;

  return (
    <div>
      <PageHeader
        title="Human Resource Management"
        description="Employee lifecycle · recruitment · leave · payroll · performance · training · ESS"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr/employees">Directory</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/hr/recruitment">Recruit</Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Employee lifecycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {LIFECYCLE.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {step}
                </Badge>
                {i < LIFECYCLE.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard title="Active headcount" value={formatNumber(stats.headcount)} icon={Contact} />
        <StatCard title="Open vacancies" value={formatNumber(stats.openJobs)} icon={UserPlus} />
        <StatCard title="Active applicants" value={formatNumber(stats.applicants)} />
        <StatCard title="Pending leave" value={formatNumber(stats.pendingLeave)} icon={CalendarDays} />
        <StatCard
          title="Last payroll net"
          value={formatNumber(Math.round(stats.payrollNet))}
          icon={Wallet}
        />
        <StatCard title="Open exits" value={formatNumber(stats.openExits)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition-colors hover:border-hope-teal/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="rounded-lg bg-hope-navy/10 p-2">
                  <m.icon className="h-5 w-5 text-hope-teal" />
                </div>
                <div>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-hope-gold" />
            <CardTitle>AI HR intelligence</CardTitle>
          </div>
          <Badge variant="outline">Workforce · turnover · skills</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open HR insights.</p>
          ) : (
            insights.map((ins) => (
              <div key={ins.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={ins.severity} />
                  <Badge variant="secondary" className="capitalize">
                    {ins.insight_type.replace(/_/g, " ")}
                  </Badge>
                  {ins.department && (
                    <Badge variant="outline">{ins.department}</Badge>
                  )}
                  <span className="font-medium">{ins.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{ins.recommendation}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
