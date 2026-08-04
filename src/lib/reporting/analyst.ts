/**
 * SecureTrack AI Analyst — rule-based business intelligence engine.
 *
 * Analyzes company KPIs (actual vs target, thresholds, trend deltas) and
 * generates a daily briefing, predictive insights, and recommendations.
 * Insights are persisted to bi_ai_insights (company-scoped) with de-duplication
 * against recent open insights so scheduled regenerations do not spam the feed.
 *
 * All reads are scoped to the authenticated company; no client-supplied
 * company/tenant identifiers are ever used.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantScope } from "@/lib/tenant/context";

export type AnalystInsight = {
  insight_type: string;
  domain: string;
  title: string;
  summary: string;
  recommendation: string;
  confidence: number;
  severity: string;
  impact_score: number;
  horizon: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

export type AnalystResult = {
  briefings: AnalystInsight[];
  predictions: AnalystInsight[];
  recommendations: AnalystInsight[];
};

type KpiSnapshotRow = {
  kpi_id: string;
  snapshot_date: string;
  actual_value?: number | string | null;
};

type KpiRow = {
  id: string;
  kpi_code?: string | null;
  name?: string | null;
  category?: string | null;
  department?: string | null;
  unit?: string | null;
  target_value?: number | string | null;
  actual_value?: number | string | null;
  variance_pct?: number | string | null;
  trend?: string | null;
  threshold_warning?: number | string | null;
  threshold_critical?: number | string | null;
  higher_is_better?: boolean | null;
  data_source?: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function severityFor(
  variancePct: number | null,
  warning: number | null,
  critical: number | null
): string {
  if (variancePct == null) return "info";
  const abs = Math.abs(variancePct);
  if (critical != null && abs >= Math.abs(critical)) return "high";
  if (warning != null && abs >= Math.abs(warning)) return "medium";
  if (abs >= 5) return "low";
  return "info";
}

function trendWord(deltaPct: number | null, higherIsBetter: boolean): string {
  if (deltaPct == null) return "stable";
  if (Math.abs(deltaPct) < 1) return "stable";
  const direction = deltaPct > 0 ? "up" : "down";
  if (higherIsBetter) return direction;
  return direction === "up" ? "down" : "up";
}

/** Analyze the active company and persist newly discovered insights. */
export async function analyzeCompany(opts: {
  admin: SupabaseClient;
  scope: TenantScope;
  horizonDays?: number;
}): Promise<AnalystResult> {
  const { admin, scope } = opts;
  const briefings: AnalystInsight[] = [];
  const predictions: AnalystInsight[] = [];
  const recommendations: AnalystInsight[] = [];

  const { data: kpiRows } = await admin
    .from("bi_kpis")
    .select(
      "id, kpi_code, name, category, department, unit, target_value, actual_value, variance_pct, trend, threshold_warning, threshold_critical, higher_is_better, data_source"
    )
    .eq("company_id", scope.companyId)
    .eq("is_active", true)
    .limit(200);

  const kpis = (kpiRows || []) as unknown as KpiRow[];
  if (!kpis.length) {
    return { briefings, predictions, recommendations };
  }

  // Most recent snapshots per KPI (90-day window) for trend deltas.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const { data: snapRows } = await admin
    .from("bi_kpi_snapshots")
    .select("kpi_id, snapshot_date, actual_value")
    .eq("company_id", scope.companyId)
    .gte("snapshot_date", cutoff.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: false })
    .limit(1000);

  const byKpi = new Map<string, KpiSnapshotRow[]>();
  for (const s of (snapRows || []) as unknown as KpiSnapshotRow[]) {
    const list = byKpi.get(s.kpi_id) || [];
    if (list.length < 2) list.push(s);
    byKpi.set(s.kpi_id, list);
  }

  // De-dupe against existing recent open insights (same title, last 30 days).
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const { data: existingRows } = await admin
    .from("bi_ai_insights")
    .select("title")
    .eq("company_id", scope.companyId)
    .in("status", ["open", "acknowledged"])
    .gte("created_at", recentCutoff.toISOString())
    .limit(200);
  const existingTitles = new Set(
    (existingRows || []).map((r) => String((r as { title: string }).title))
  );

  const seen = new Set<string>();
  const persist: AnalystInsight[] = [];
  const pushInsight = (insight: AnalystInsight, group: AnalystInsight[]) => {
    if (seen.has(insight.title)) return;
    seen.add(insight.title);
    group.push(insight);
    if (!existingTitles.has(insight.title)) persist.push(insight);
  };

  for (const kpi of kpis) {
    const name = kpi.name || kpi.kpi_code || "KPI";
    const target = num(kpi.target_value);
    const actual = num(kpi.actual_value);
    const variancePct = num(kpi.variance_pct);
    const higherIsBetter = kpi.higher_is_better !== false;
    const unit = kpi.unit || "";
    const domain = kpi.category?.toLowerCase() || kpi.department?.toLowerCase() || "general";
    const warning = num(kpi.threshold_warning);
    const critical = num(kpi.threshold_critical);

    const snaps = byKpi.get(kpi.id) || [];
    const prevActual = snaps.length > 1 ? num(snaps[1].actual_value) : null;
    const deltaPct =
      prevActual != null && actual != null && prevActual !== 0
        ? ((actual - prevActual) / Math.abs(prevActual)) * 100
        : null;
    const direction = trendWord(deltaPct, higherIsBetter);

    // Daily briefing: target variance outside thresholds or material delta.
    if (variancePct != null) {
      const severity = severityFor(variancePct, warning, critical);
      if (severity === "high" || severity === "medium" || Math.abs(variancePct) >= 5) {
        const below = variancePct < 0;
        const wording = below
          ? "is running below target"
          : "is running above target";
        pushInsight(
          {
            insight_type: "forecast",
            domain,
            title: `${name} Target Variance`,
            summary: `${name} ${wording} by ${Math.abs(variancePct).toFixed(1)}% (actual ${actual?.toFixed(2) ?? "n/a"}${unit ? " " + unit : ""} vs target ${target?.toFixed(2) ?? "n/a"}).`,
            recommendation: below
              ? `Investigate drivers behind the ${name.toLowerCase()} shortfall and update the forecast.`
              : `Validate whether the ${name.toLowerCase()} target should be revised upward.`,
            confidence: 0.8,
            severity,
            impact_score: Math.min(100, Math.abs(variancePct)),
            horizon: "30d",
            inputs: {
              kpi_code: kpi.kpi_code,
              target_value: target,
              actual_value: actual,
              variance_pct: variancePct,
            },
            outputs: { delta_pct: variancePct, direction: below ? "below" : "above" },
          },
          briefings
        );
      }
    }

    // Predictive: momentum from the snapshot delta.
    if (deltaPct != null && Math.abs(deltaPct) >= 3) {
      const risk = direction === "down";
      pushInsight(
        {
          insight_type: risk ? "risk" : "predictive",
          domain,
          title: `${name} Momentum ${risk ? "Risk" : "Outlook"}`,
          summary: `${name} moved ${direction === "down" ? "down" : "up"} ${Math.abs(deltaPct).toFixed(1)}% versus the prior period, implying continued ${direction === "down" ? "pressure" : "improvement"} if the trend holds.`,
          recommendation: risk
            ? `Model a ${Math.max(5, Math.round(Math.abs(deltaPct) * 0.5))}% downside scenario for ${name.toLowerCase()} over the next period.`
            : `Capture the positive trend by locking in the factors driving ${name.toLowerCase()} performance.`,
          confidence: 0.7,
          severity: risk ? "low" : "info",
          impact_score: Math.min(100, Math.abs(deltaPct)),
          horizon: "30d",
          inputs: {
            kpi_code: kpi.kpi_code,
            prior_actual: prevActual,
            current_actual: actual,
            delta_pct: deltaPct,
          },
          outputs: { projected_direction: direction, delta_pct: deltaPct },
        },
        predictions
      );
    }

    // Recommendations: threshold breach with a clear corrective action.
    if (variancePct != null && critical != null && Math.abs(variancePct) >= Math.abs(critical)) {
      const breach = variancePct < 0 ? "below" : "above";
      pushInsight(
        {
          insight_type: "prescriptive",
          domain,
          title: `Corrective Action: ${name}`,
          summary: `${name} breached the critical threshold (${breach} target by ${Math.abs(variancePct).toFixed(1)}%).`,
          recommendation: `Escalate to the ${domain} owner, apply the corrective action plan, and re-run the KPI calculation after the next close.`,
          confidence: 0.75,
          severity: "high",
          impact_score: Math.min(100, Math.abs(variancePct)),
          horizon: "7d",
          inputs: {
            kpi_code: kpi.kpi_code,
            variance_pct: variancePct,
            threshold_critical: critical,
          },
          outputs: { breach: breach, action: "escalate_and_correct" },
        },
        recommendations
      );
    }
  }

  // Persist newly discovered insights (best-effort, company-scoped).
  for (const insight of persist.slice(0, 24)) {
    try {
      await admin.from("bi_ai_insights").insert({
        company_id: scope.companyId,
        insight_type: insight.insight_type,
        domain: insight.domain,
        title: insight.title,
        summary: insight.summary,
        recommendation: insight.recommendation,
        confidence: insight.confidence,
        severity: insight.severity,
        impact_score: insight.impact_score,
        horizon: insight.horizon,
        inputs: insight.inputs,
        outputs: insight.outputs,
        status: "open",
      });
    } catch {
      /* non-blocking: never fail the analyst run on a single insert */
    }
  }

  return { briefings, predictions, recommendations };
}

/**
 * Build a one-paragraph daily business briefing from the generated groups.
 * Safe to embed in emails / notifications.
 */
export function composeBriefing(result: AnalystResult): string {
  const parts: string[] = [];
  if (result.briefings.length) {
    parts.push(
      `Briefing: ${result.briefings
        .slice(0, 3)
        .map((i) => i.summary)
        .join(" ")}`
    );
  }
  if (result.predictions.length) {
    parts.push(
      `Predictions: ${result.predictions
        .slice(0, 2)
        .map((i) => `${i.title} (${i.horizon})`)
        .join(", ")}`
    );
  }
  if (result.recommendations.length) {
    parts.push(
      `Recommendations: ${result.recommendations
        .slice(0, 2)
        .map((i) => i.recommendation)
        .join(" ")}`
    );
  }
  if (!parts.length) {
    return "Business performance is tracking within expected ranges. No material anomalies detected.";
  }
  return parts.join(" ");
}