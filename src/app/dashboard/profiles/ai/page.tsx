"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import {
  generateProfileInsights,
  suggestMissingFields,
  type EmployeeProfile,
  type ProfileAiInsight,
} from "@/lib/profile";

type RowInsight = {
  employee: EmployeeProfile;
  insights: ProfileAiInsight[];
};

export default function ProfileAiPage() {
  const [rows, setRows] = useState<RowInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: employees } = await supabase
        .from("employees")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("profile_completion_pct", { ascending: true })
        .limit(40);

      const list = (employees as EmployeeProfile[]) || [];
      const results: RowInsight[] = [];

      for (const emp of list) {
        const [{ count: skillCount }, { data: skills }, { data: certs }] = await Promise.all([
          supabase.from("profile_skills").select("*", { count: "exact", head: true }).eq("employee_id", emp.id),
          supabase.from("profile_skills").select("skill_name,skill_category,level_score").eq("employee_id", emp.id),
          supabase
            .from("profile_certifications")
            .select("certificate_name,expiry_date")
            .eq("employee_id", emp.id),
        ]);

        const insights = generateProfileInsights({
          employee: emp,
          ctx: {
            skillCount: skillCount ?? 0,
            certCount: certs?.length ?? 0,
            docCount: 0,
          },
          skills: (skills || []) as Array<{
            skill_name: string;
            skill_category: string;
            level_score: number;
          }>,
          certs: (certs || []) as Array<{ certificate_name: string; expiry_date?: string | null }>,
        });

        results.push({ employee: emp, insights });
      }

      setRows(results);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Running AI profile analysis…" />;

  const high = rows.flatMap((r) =>
    r.insights
      .filter((i) => i.severity === "high")
      .map((i) => ({ ...i, emp: r.employee }))
  );
  const medium = rows.flatMap((r) =>
    r.insights
      .filter((i) => i.severity === "medium")
      .map((i) => ({ ...i, emp: r.employee }))
  );

  return (
    <div>
      <PageHeader
        title="AI Profile Assistant"
        description="Completion gaps · skill gaps · training · career · retention risk"
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> High priority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {high.slice(0, 15).map((i, idx) => (
              <InsightCard key={idx} title={i.title} detail={i.detail} emp={i.emp} severity="high" actions={i.actions} />
            ))}
            {high.length === 0 && <p className="text-sm text-muted-foreground">No high-priority items.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {medium.slice(0, 15).map((i, idx) => (
              <InsightCard key={idx} title={i.title} detail={i.detail} emp={i.emp} severity="medium" actions={i.actions} />
            ))}
            {medium.length === 0 && <p className="text-sm text-muted-foreground">No medium items.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Completion focus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {rows
              .filter((r) => Number(r.employee.profile_completion_pct || 0) < 80)
              .slice(0, 12)
              .map((r) => {
                const missing = suggestMissingFields(r.employee, {
                  skillCount: 0,
                });
                return (
                  <div key={r.employee.id} className="border rounded-md p-2.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {r.employee.first_name} {r.employee.last_name}
                      </span>
                      <span className="text-xs">{r.employee.profile_completion_pct || 0}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Missing: {missing.slice(0, 4).join(", ") || "recalculate completion"}
                    </p>
                    <Button asChild size="sm" variant="link" className="px-0 h-auto mt-1">
                      <Link href={`/dashboard/profiles/${r.employee.id}`}>Open profile</Link>
                    </Button>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Workforce AI summary
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Analyzed {rows.length} active profiles. High-priority signals: {high.length}. Medium: {medium.length}.
          </p>
          <p>
            Recommendations: drive profile completion above 85%, renew expiring certificates within 30 days,
            close technical skill gaps for manufacturing & quality roles, and schedule manager 1:1s for
            attendance risk flags.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InsightCard({
  title,
  detail,
  emp,
  severity,
  actions,
}: {
  title: string;
  detail: string;
  emp: EmployeeProfile;
  severity: string;
  actions: string[];
}) {
  return (
    <div className="border rounded-md p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{title}</span>
        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{severity}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
      <p className="text-xs mt-1">
        {emp.first_name} {emp.last_name} · {emp.employee_number}
      </p>
      {actions[0] && <p className="text-xs text-primary mt-1">→ {actions[0]}</p>}
      <Button asChild size="sm" variant="link" className="px-0 h-auto">
        <Link href={`/dashboard/profiles/${emp.id}`}>View</Link>
      </Button>
    </div>
  );
}
