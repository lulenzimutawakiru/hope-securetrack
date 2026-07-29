"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Users, Award, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import type { EmployeeProfile } from "@/lib/profile";

export default function ProfileAnalyticsPage() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [skills, setSkills] = useState<Array<{ skill_name: string; skill_category: string }>>([]);
  const [certs, setCerts] = useState<Array<{ status: string; expiry_date: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: emp }, { data: sk }, { data: ce }] = await Promise.all([
        supabase.from("employees").select("*").is("deleted_at", null).limit(1000),
        supabase.from("profile_skills").select("skill_name,skill_category").limit(2000),
        supabase.from("profile_certifications").select("status,expiry_date").limit(1000),
      ]);
      setEmployees((emp as EmployeeProfile[]) || []);
      setSkills((sk as typeof skills) || []);
      setCerts((ce as typeof certs) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const avg =
      total > 0
        ? employees.reduce((s, e) => s + Number(e.profile_completion_pct || 0), 0) / total
        : 0;
    const incomplete = employees.filter((e) => Number(e.profile_completion_pct || 0) < 70).length;

    const byDept: Record<string, number> = {};
    for (const e of employees) {
      const d = e.department || "Unassigned";
      byDept[d] = (byDept[d] || 0) + 1;
    }

    const skillDist: Record<string, number> = {};
    for (const s of skills) {
      skillDist[s.skill_name] = (skillDist[s.skill_name] || 0) + 1;
    }
    const topSkills = Object.entries(skillDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const catDist: Record<string, number> = {};
    for (const s of skills) {
      catDist[s.skill_category] = (catDist[s.skill_category] || 0) + 1;
    }

    const now = Date.now();
    const expiring = certs.filter((c) => {
      if (!c.expiry_date) return false;
      const d = new Date(c.expiry_date).getTime() - now;
      return d >= 0 && d <= 30 * 864e5;
    }).length;
    const expired = certs.filter(
      (c) => c.status === "expired" || (c.expiry_date && new Date(c.expiry_date).getTime() < now)
    ).length;

    return {
      total,
      active,
      avg,
      incomplete,
      byDept: Object.entries(byDept).sort((a, b) => b[1] - a[1]),
      topSkills,
      catDist: Object.entries(catDist),
      expiring,
      expired,
      certTotal: certs.length,
    };
  }, [employees, skills, certs]);

  if (loading) return <LoadingState message="Loading profile analytics…" />;

  return (
    <div>
      <PageHeader
        title="Profile Analytics"
        description="Headcount · completion · skills distribution · certifications"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard title="Total employees" value={String(analytics.total)} icon={Users} />
        <StatCard title="Active users" value={String(analytics.active)} icon={Users} />
        <StatCard title="Avg completion" value={`${formatNumber(analytics.avg)}%`} icon={BarChart3} />
        <StatCard title="Below 70%" value={String(analytics.incomplete)} icon={FileWarning} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">By department</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.byDept.map(([d, n]) => (
              <div key={d} className="flex justify-between text-sm">
                <span>{d}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
            {analytics.byDept.length === 0 && (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top skills</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {analytics.topSkills.map(([name, n]) => (
              <div key={name} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{name}</span>
                <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(100, (n / Math.max(1, analytics.topSkills[0]?.[1] || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-xs">{n}</span>
              </div>
            ))}
            {analytics.topSkills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills recorded</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Certifications</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><Award className="h-4 w-4" /> Total</span>
              <span className="font-medium">{analytics.certTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Expiring ≤ 30 days</span>
              <span className="font-medium text-amber-600">{analytics.expiring}</span>
            </div>
            <div className="flex justify-between">
              <span>Expired</span>
              <span className="font-medium text-destructive">{analytics.expired}</span>
            </div>
            <div className="pt-2 border-t space-y-1">
              <div className="text-xs text-muted-foreground mb-1">Skill categories</div>
              {analytics.catDist.map(([c, n]) => (
                <div key={c} className="flex justify-between capitalize">
                  <span>{c}</span>
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Completion bands</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const bands = [
              { label: "90–100%", min: 90, max: 101 },
              { label: "70–89%", min: 70, max: 90 },
              { label: "50–69%", min: 50, max: 70 },
              { label: "0–49%", min: 0, max: 50 },
            ];
            return (
              <div className="grid sm:grid-cols-4 gap-3">
                {bands.map((b) => {
                  const n = employees.filter((e) => {
                    const p = Number(e.profile_completion_pct || 0);
                    return p >= b.min && p < b.max;
                  }).length;
                  return (
                    <div key={b.label} className="rounded-lg border p-4 text-center">
                      <div className="text-2xl font-semibold">{n}</div>
                      <div className="text-xs text-muted-foreground">{b.label}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
