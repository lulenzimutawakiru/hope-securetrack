import { mustList, persistInsights, type RuleInsight } from "@/lib/crud/ai-insights";

export type PpmInsight = RuleInsight & {
  id?: string;
  project_code?: string;
  created_at?: string;
};

export async function generatePpmInsights(
  companyId: string
): Promise<PpmInsight[]> {
  void companyId;
  const insights: PpmInsight[] = [];

  const [projects, tasks, risks, issues, budgets] = await Promise.all([
    mustList<Record<string, unknown>>("ppm_projects", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ppm_tasks", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ppm_risks", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ppm_issues", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ppm_budgets", { pageSize: 100 }),
  ]);

  const today = new Date();
  const overdue = tasks.filter((t) => {
    if (!t.due_date || t.status === "done" || t.status === "cancelled")
      return false;
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
      ],
    });
  }

  const lowSpi = projects.filter(
    (p) => Number(p.spi || 1) < 0.9 && p.status === "active"
  );
  if (lowSpi.length > 0) {
    insights.push({
      insight_type: "performance",
      title: `${lowSpi.length} project(s) with SPI < 0.9`,
      summary: "Schedule performance index indicates delay risk.",
      severity: "high",
      score: 78,
      recommendations: ["Recovery plan workshop", "Rebaseline milestones"],
    });
  }

  const openRisks = risks.filter((r) => r.status === "open");
  if (openRisks.length >= 3) {
    insights.push({
      insight_type: "risk",
      title: `${openRisks.length} open project risks`,
      summary: "Risk register needs active mitigation tracking.",
      severity: "warning",
      score: 70,
      recommendations: ["Weekly risk committee", "Link risks to issues"],
    });
  }

  const openIssues = issues.filter((i) =>
    ["open", "in_progress"].includes(String(i.status))
  );
  if (openIssues.length >= 5) {
    insights.push({
      insight_type: "issues",
      title: `${openIssues.length} open issues`,
      summary: "Issue backlog may block delivery milestones.",
      severity: "medium",
      score: 65,
      recommendations: ["Triage by severity", "Assign owners"],
    });
  }

  void budgets;
  await persistInsights("ppm_ai_insights", insights);
  return insights;
}

export async function listPpmInsights(companyId: string) {
  void companyId;
  const { listModuleInsights } = await import("@/lib/crud/ai-insights");
  return listModuleInsights("ppm_ai_insights");
}
