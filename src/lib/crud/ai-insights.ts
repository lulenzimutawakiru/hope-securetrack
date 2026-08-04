/**
 * Shared rule-based AI insight persistence via CRUD (no browser client).
 */

import { mustCreate, mustList } from "@/lib/crud/domain-helpers";

export type RuleInsight = {
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
  status?: string;
  [key: string]: unknown;
};

/** Persist insights to a module AI table (best-effort). */
export async function persistInsights(
  entity: string,
  insights: RuleInsight[],
  max = 6
): Promise<void> {
  try {
    for (const ins of insights.slice(0, max)) {
      await mustCreate(entity, {
        insight_type: ins.insight_type,
        title: ins.title,
        summary: ins.summary,
        severity: ins.severity,
        score: ins.score,
        recommendations: ins.recommendations || [],
        status: ins.status || "open",
      });
    }
  } catch {
    /* table may lack columns / unregistered */
  }
}

export async function listModuleInsights(entity: string, limit = 40) {
  return mustList(entity, {
    pageSize: limit,
    sort: "created_at",
    order: "desc",
  });
}

export { mustList, mustCreate };
