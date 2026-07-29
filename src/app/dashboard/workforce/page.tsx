"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CalendarClock,
  ClipboardCheck,
  Timer,
  HardHat,
  MapPin,
  Coins,
  Brain,
  GraduationCap,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

const MODULES = [
  {
    title: "Shifts & Scheduling",
    href: "/dashboard/workforce/shifts",
    icon: CalendarClock,
    desc: "Templates, assignments, coverage",
  },
  {
    title: "Enterprise Attendance",
    href: "/dashboard/attendance",
    icon: ClipboardCheck,
    desc: "Geofence clock · devices · AI",
  },
  {
    title: "Legacy attendance",
    href: "/dashboard/workforce/attendance",
    icon: ClipboardCheck,
    desc: "Simple clock list (legacy)",
  },
  {
    title: "Overtime",
    href: "/dashboard/workforce/overtime",
    icon: Timer,
    desc: "Requests, approvals, cost",
  },
  {
    title: "Skills & Training",
    href: "/dashboard/workforce/skills",
    icon: GraduationCap,
    desc: "Skills matrix, certifications",
  },
  {
    title: "Safety & PPE",
    href: "/dashboard/workforce/safety",
    icon: HardHat,
    desc: "Inductions, PPE, incidents",
  },
  {
    title: "Field Workforce",
    href: "/dashboard/workforce/field",
    icon: MapPin,
    desc: "Jobs, GPS, mobile work",
  },
  {
    title: "Labor Costs",
    href: "/dashboard/workforce/costs",
    icon: Coins,
    desc: "Shift & department costing",
  },
  {
    title: "Employees (HR)",
    href: "/dashboard/hr",
    icon: Users,
    desc: "Master data & leave",
  },
];

interface Insight {
  id: string;
  title: string;
  recommendation: string;
  severity: string;
  insight_type: string;
  department: string | null;
  work_date: string | null;
}

export default function WorkforceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    employees: 0,
    active: 0,
    presentToday: 0,
    pendingOt: 0,
    openIncidents: 0,
    fieldJobs: 0,
  });
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [
        emp,
        active,
        present,
        ot,
        incidents,
        field,
        { data: insightData },
      ] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase
          .from("employees")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("work_date", today),
        supabase
          .from("overtime_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("safety_incidents")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("field_jobs")
          .select("*", { count: "exact", head: true })
          .in("status", ["assigned", "en_route", "on_site"]),
        supabase
          .from("workforce_insights")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setStats({
        employees: emp.count ?? 0,
        active: active.count ?? 0,
        presentToday: present.count ?? 0,
        pendingOt: ot.count ?? 0,
        openIncidents: incidents.count ?? 0,
        fieldJobs: field.count ?? 0,
      });
      setInsights((insightData as Insight[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingState message="Loading workforce intelligence…" />;

  const attendanceRate =
    stats.active > 0
      ? Math.min(100, Math.round((stats.presentToday / stats.active) * 100))
      : 0;

  return (
    <div>
      <PageHeader
        title="Workforce Management"
        description="Hope Design Group Ltd — Security Printing · Manufacturing · Engineering · Multi-site WFM"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/workforce/attendance">
              <Button>Clock attendance</Button>
            </Link>
            <Link href="/dashboard/workforce/shifts">
              <Button variant="outline">Schedule shifts</Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-lg border bg-gradient-to-r from-hope-navy to-hope-teal text-white p-4 mb-6 text-sm">
        <p className="font-semibold text-hope-gold">Enterprise WFM Architecture</p>
        <p className="text-white/70 mt-1 text-xs sm:text-sm">
          HR Master → Planning → Shift Scheduling → Attendance → Productivity →
          Payroll integration → Executive analytics · Cloud / Hybrid / Offline-ready
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
        <StatCard title="Workforce" value={formatNumber(stats.employees)} icon={Users} />
        <StatCard title="Active" value={formatNumber(stats.active)} />
        <StatCard title="Present today" value={formatNumber(stats.presentToday)} />
        <StatCard title="Attendance %" value={`${attendanceRate}%`} />
        <StatCard title="Pending OT" value={formatNumber(stats.pendingOt)} icon={Timer} />
        <StatCard
          title="Open safety"
          value={formatNumber(stats.openIncidents)}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-hope-teal" />
              AI Workforce Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open insights. Insights appear as attendance and leave patterns
                accumulate.
              </p>
            ) : (
              insights.map((i) => (
                <div key={i.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{i.title}</p>
                    <StatusBadge status={i.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i.recommendation}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {i.department && (
                      <Badge variant="outline" className="text-[10px]">
                        {i.department}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {i.insight_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Field jobs active</span>
              <span className="font-semibold">{stats.fieldJobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sites</span>
              <span className="font-semibold">Multi-branch</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compliance</span>
              <span className="font-semibold text-hope-teal">Uganda labour</span>
            </div>
            <Link href="/dashboard/hr">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Open HR master data
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className="group rounded-xl border p-4 hover:border-hope-teal/50 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-hope-teal" />
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="font-semibold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
