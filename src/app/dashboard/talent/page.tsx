"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Briefcase, UserPlus, Calendar, FileSignature, ClipboardList,
  ArrowRight, Brain, Target, Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { TA_MENU, getTalentDashboardStats } from "@/lib/ta";
import { createClient } from "@/lib/supabase/crud-compat";
import { formatNumber } from "@/lib/utils";

const QUICK = [
  { title: "ATS Pipeline", href: "/dashboard/talent/ats", icon: Target, desc: "Kanban hiring stages" },
  { title: "Vacancies", href: "/dashboard/talent/vacancies", icon: Briefcase, desc: "Open roles" },
  { title: "Applications", href: "/dashboard/talent/applications", icon: ClipboardList, desc: "Applicant tracking" },
  { title: "Candidates", href: "/dashboard/talent/candidates", icon: Users, desc: "Talent database" },
  { title: "Interviews", href: "/dashboard/talent/interviews", icon: Calendar, desc: "Schedule & score" },
  { title: "Offers", href: "/dashboard/talent/offers", icon: FileSignature, desc: "Offer management" },
  { title: "Onboarding", href: "/dashboard/talent/onboarding", icon: UserPlus, desc: "Digital onboarding" },
  { title: "Careers portal", href: "/careers", icon: Sparkles, desc: "Public jobs site" },
];

export default function TalentDashboardPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getTalentDashboardStats>> | null>(null);
  const [recentApps, setRecentApps] = useState<Array<Record<string, unknown>>>([]);
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
        const [s, { data: apps }, { data: ai }] = await Promise.all([
          getTalentDashboardStats(companyId),
          sb
            .from("ta_applications")
            .select("id,application_number,candidate_name,vacancy_title,stage_code,match_score,status")
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(8),
          sb
            .from("ta_ai_insights")
            .select("title,severity,summary,score")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(4),
        ]);
        setStats(s);
        setRecentApps((apps as Array<Record<string, unknown>>) || []);
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
    return TA_MENU.filter(
      (m) => !s || m.title.toLowerCase().includes(s) || m.group.toLowerCase().includes(s)
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, (typeof TA_MENU)[number][]>();
    for (const m of menu) {
      const list = map.get(m.group) || [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [menu]);

  if (loading) return <LoadingState message="Loading Talent Acquisition…" />;

  return (
    <div>
      <PageHeader
        title="Talent Acquisition"
        description="Workforce planning · ATS · Careers · Assessments · Offers · Onboarding · AI"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/careers">Careers portal</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/talent/ai">
                <Brain className="h-4 w-4 mr-1" /> AI
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/talent/ats">
                <Target className="h-4 w-4 mr-1" /> ATS Pipeline
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-gradient-to-r from-[#0B1F3A] to-[#0d2847] text-white p-4 mb-6">
        <p className="text-[#C9A227] text-[11px] font-semibold uppercase tracking-wider">
          Hire-to-onboard lifecycle
        </p>
        <p className="text-white/70 text-sm mt-1 max-w-3xl">
          Plan → Requisition → Vacancy → Apply → Screen → Assess → Interview → Verify → Offer → Onboard → HR/Payroll/Identity.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 mb-6">
        <StatCard title="Open vacancies" value={String(stats?.openVacancies ?? 0)} icon={Briefcase} />
        <StatCard title="Open applications" value={String(stats?.applications ?? 0)} icon={ClipboardList} />
        <StatCard title="Interviews (7d)" value={String(stats?.interviewsThisWeek ?? 0)} icon={Calendar} />
        <StatCard title="Offers pending" value={String(stats?.offersPending ?? 0)} icon={FileSignature} />
        <StatCard title="Hires (month)" value={String(stats?.hiresThisMonth ?? 0)} icon={UserPlus} />
        <StatCard title="Requisitions pending" value={String(stats?.requisitionsPending ?? 0)} icon={Target} />
        <StatCard title="Avg match score" value={String(stats?.avgMatchScore ?? 0)} icon={Sparkles} />
        <StatCard title="Onboarding tasks" value={String(stats?.onboardingOpen ?? 0)} icon={Users} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {QUICK.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full hover:border-primary/40 transition-colors">
              <CardContent className="pt-4 flex gap-3 items-start">
                <m.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent applications</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/talent/applications">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              recentApps.map((a) => (
                <div
                  key={String(a.id)}
                  className="flex items-center justify-between border-b pb-2 last:border-0 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {String(a.application_number)}
                    </p>
                    <p className="font-medium truncate">{String(a.candidate_name)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {String(a.vacancy_title || "—")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="outline">{String(a.stage_code)}</Badge>
                    <p className="text-[11px] mt-1">Match {formatNumber(Number(a.match_score || 0))}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">AI insights</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/dashboard/talent/ai">Open</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No insights yet. Open the AI assistant to generate them.
              </p>
            ) : (
              insights.map((ins, i) => (
                <div key={i} className="border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{String(ins.severity)}</Badge>
                    <span className="text-sm font-medium">{String(ins.title)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{String(ins.summary || "")}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Input
        className="max-w-sm mb-3"
        placeholder="Filter talent modules…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="space-y-6">
        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((m) => (
                <Link
                  key={m.href + m.title}
                  href={m.href}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
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
