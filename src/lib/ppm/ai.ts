import { createClient } from "@/lib/supabase/client";

export type PpmInsight = {
  id?: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
  project_code?: string;
  status?: string;
  created_at?: string;
};

export async function generatePpmInsights(companyId: string): Promise<PpmInsight[]> {
  const sb = createClient();
  const insights: PpmInsight[] = [];

  const [
    { data: projects },
    { data: tasks },
    { data: risks },
    { data: issues },
    { data: budgets },
  ] = await Promise.all([
    sb
      .from("ppm_projects")
      .select("project_code,name,status,health,spi,cpi,percent_complete,end_date,budget_planned,budget_actual,earned_value")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("ppm_tasks")
      .select("status,due_date,percent_complete,project_code,name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(300),
    sb
      .from("ppm_risks")
      .select("status,risk_score,title,project_code")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("ppm_issues")
      .select("status,severity,title,project_code")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("ppm_budgets")
      .select("planned_amount,actual_amount,project_code,category")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
  ]);

  const today = new Date();
  const overdue = (tasks || []).filter((t) => {
    if (!t.due_date || t.status === "done" || t.status === "cancelled") return false;
    return new Date(String(t.due_date)) < today;
  });
  if (overdue.length > 0) {
    insights.push({
      insight_type: "schedule",
      title: `${overdue.length} overdue task(s)`,
      summary: "Schedule risk elevated — replan critical path or add capacity.",
      severity: overdue.length >= 5 ? "critical" : "warning",
      score: Math.min(95, 55 + overdue.length * 4),
      recommendations: [
        "Re-sequence non-critical work",
        "Escalate blockers daily",
        "Update SPI/CPI on affected projects",
      ],
    });
  }

  const lowSpi = (projects || []).filter((p) => Number(p.spi || 1) < 0.9 && p.status === "active");
  if (lowSpi.length > 0) {
    insights.push({
      insight_type: "schedule",
      title: `${lowSpi.length} project(s) SPI below 0.9`,
      summary: "Schedule Performance Index indicates delivery lag vs plan.",
      severity: "warning",
      score: 80,
      recommendations: [
        "Protect critical path tasks",
        "Freeze scope changes",
        "Add surge resources for next 2 sprints",
      ],
      project_code: String(lowSpi[0].project_code || ""),
    });
  }

  const lowCpi = (projects || []).filter((p) => Number(p.cpi || 1) < 0.9 && p.status === "active");
  if (lowCpi.length > 0) {
    insights.push({
      insight_type: "budget",
      title: `${lowCpi.length} project(s) CPI below 0.9`,
      summary: "Cost Performance Index signals budget pressure vs earned value.",
      severity: "warning",
      score: 78,
      recommendations: [
        "Review open purchase commitments",
        "Audit timesheet burn rates",
        "Run contingency draw analysis",
      ],
    });
  }

  const overBudget = (budgets || []).filter(
    (b) => Number(b.planned_amount || 0) > 0 && Number(b.actual_amount || 0) > Number(b.planned_amount) * 1.05
  );
  if (overBudget.length > 0) {
    insights.push({
      insight_type: "budget",
      title: `${overBudget.length} budget line(s) over plan`,
      summary: "Actuals exceed planned by >5% on one or more cost categories.",
      severity: "critical",
      score: 85,
      recommendations: [
        "Raise change request for budget",
        "Halt discretionary spend",
        "Notify finance sponsor",
      ],
    });
  }

  const openHighRisks = (risks || []).filter(
    (r) => r.status === "open" && Number(r.risk_score || 0) >= 12
  );
  if (openHighRisks.length > 0) {
    insights.push({
      insight_type: "risk",
      title: `${openHighRisks.length} high-score open risk(s)`,
      summary: "Risk register requires active mitigation before next steering.",
      severity: "critical",
      score: 88,
      recommendations: [
        "Assign mitigation owners this week",
        "Add contingency tasks to plan",
        "Report to sponsor board",
      ],
    });
  }

  const openIssues = (issues || []).filter((i) => ["open", "escalated"].includes(String(i.status)));
  if (openIssues.length > 0) {
    insights.push({
      insight_type: "issues",
      title: `${openIssues.length} open issue(s)`,
      summary: "Issue backlog may block milestone acceptance.",
      severity: openIssues.length >= 5 ? "warning" : "info",
      score: 70,
      recommendations: [
        "Triage severity daily",
        "Link issues to change requests if scope-related",
      ],
    });
  }

  const red = (projects || []).filter((p) => p.health === "red");
  if (red.length > 0) {
    insights.push({
      insight_type: "portfolio",
      title: `${red.length} red-health project(s)`,
      summary: "Portfolio health degraded — executive intervention recommended.",
      severity: "critical",
      score: 92,
      recommendations: [
        "Convene recovery workshop",
        "Rebaseline schedule and budget",
        "Communicate to customer sponsors",
      ],
    });
  }

  insights.push({
    insight_type: "forecast",
    title: "Completion forecast refresh",
    summary: `Tracking ${projects?.length || 0} projects. Use earned value (EV=${Math.round(
      (projects || []).reduce((s, p) => s + Number(p.earned_value || 0), 0)
    ).toLocaleString()}) for executive status.`,
    severity: "info",
    score: 60,
    recommendations: [
      "Update percent complete weekly",
      "Publish branded status PDF to stakeholders",
    ],
  });

  try {
    for (const ins of insights.slice(0, 8)) {
      await sb.from("ppm_ai_insights").insert({
        company_id: companyId,
        insight_type: ins.insight_type,
        title: ins.title,
        summary: ins.summary,
        severity: ins.severity,
        score: ins.score,
        recommendations: ins.recommendations || [],
        project_code: ins.project_code || null,
        status: "open",
      });
    }
  } catch {
    /* non-blocking */
  }

  return insights;
}

export async function listPpmInsights(companyId: string) {
  const { data, error } = await createClient()
    .from("ppm_ai_insights")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}
