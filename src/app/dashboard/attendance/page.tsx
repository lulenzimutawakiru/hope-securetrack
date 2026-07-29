"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock, MapPin, Monitor, AlertTriangle, Users, ArrowRight, ShieldCheck, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { ATT_MENU, getAttendanceDashboard } from "@/lib/attendance";
import { createClient } from "@/lib/supabase/client";

export default function AttendanceDashboardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAttendanceDashboard>> | null>(null);
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);
  const [insights, setInsights] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;

  useEffect(() => {
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      try {
        const sb = createClient();
        const [s, { data: ev }, { data: ai }] = await Promise.all([
          getAttendanceDashboard(companyId),
          sb
            .from("att_events")
            .select("event_code,employee_name,event_type,location_name,verification_status,method,event_at")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("event_at", { ascending: false })
            .limit(8),
          sb
            .from("att_ai_insights")
            .select("title,severity,summary")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        setStats(s);
        setRecent((ev as Array<Record<string, unknown>>) || []);
        setInsights((ai as Array<Record<string, unknown>>) || []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const menu = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ATT_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof ATT_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Workforce Attendance Platform…" />;

  return (
    <div>
      <PageHeader
        title="Workforce Attendance"
        description="Geofence · GPS · Wi-Fi · BLE · QR · NFC · RFID · Biometric terminals · Payroll sync"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/dashboard/attendance/clock"><Clock className="h-4 w-4 mr-1" /> Clock In/Out</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/live"><Activity className="h-4 w-4 mr-1" /> Live</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/attendance/locations"><MapPin className="h-4 w-4 mr-1" /> Locations</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 mb-6">
        <StatCard title="Present now" value={String(stats?.presentNow ?? 0)} icon={Users} />
        <StatCard title="Events today" value={String(stats?.eventsToday ?? 0)} icon={Clock} />
        <StatCard title="Devices online" value={String(stats?.devicesOnline ?? 0)} icon={Monitor} />
        <StatCard title="Devices offline" value={String(stats?.devicesOffline ?? 0)} icon={Monitor} />
        <StatCard title="Pending corrections" value={String(stats?.pendingCorrections ?? 0)} icon={ShieldCheck} />
        <StatCard title="Open violations" value={String(stats?.openViolations ?? 0)} icon={AlertTriangle} />
        <StatCard title="Active sites" value={String(stats?.activeLocations ?? 0)} icon={MapPin} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent clock events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet. Use secure Clock In/Out.</p>
            )}
            {recent.map((e, i) => (
              <div key={i} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{String(e.employee_name)} · {String(e.event_type)}</div>
                  <div className="text-xs text-muted-foreground">
                    {String(e.location_name || "—")} · {String(e.method)} · {String(e.event_at || "").slice(0, 19)}
                  </div>
                </div>
                <Badge variant={String(e.verification_status) === "rejected" ? "destructive" : "outline"}>
                  {String(e.verification_status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">Run AI Attendance Insights for fraud and lateness signals.</p>
            )}
            {insights.map((ins, i) => (
              <div key={i} className="border rounded-md px-3 py-2 text-sm">
                <Badge variant={String(ins.severity) === "critical" ? "destructive" : "outline"} className="mb-1">
                  {String(ins.severity)}
                </Badge>
                <div className="font-medium">{String(ins.title)}</div>
                <p className="text-xs text-muted-foreground">{String(ins.summary)}</p>
              </div>
            ))}
            <Button size="sm" variant="link" className="px-0" asChild>
              <Link href="/dashboard/attendance/ai">Open AI <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3">
        <Input placeholder="Search attendance modules…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      </div>
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <span>{m.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
