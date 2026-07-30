import { createClient } from "@/lib/supabase/client";

export type TaInsight = {
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
};

export async function generateTalentInsights(companyId: string): Promise<TaInsight[]> {
  const sb = createClient();
  const insights: TaInsight[] = [];

  const [
    { data: apps },
    { data: vacancies },
    { data: interviews },
    { data: offers },
  ] = await Promise.all([
    sb.from("ta_applications").select("stage_code,status,match_score,vacancy_code").eq("company_id", companyId).is("deleted_at", null).limit(300),
    sb.from("ta_vacancies").select("status,title,applications_count").eq("company_id", companyId).is("deleted_at", null).limit(100),
    sb.from("ta_interviews").select("status,scheduled_at").eq("company_id", companyId).is("deleted_at", null).limit(100),
    sb.from("ta_offers").select("status,candidate_response").eq("company_id", companyId).is("deleted_at", null).limit(100),
  ]);

  const openApps = (apps || []).filter((a) => a.status === "open");
  const screening = openApps.filter((a) => ["applied", "screen"].includes(String(a.stage_code)));
  if (screening.length >= 5) {
    insights.push({
      insight_type: "funnel",
      title: "Screening backlog",
      summary: `${screening.length} applications await screening.`,
      severity: "high",
      score: 78,
      recommendations: ["Bulk shortlist high match scores", "Assign co-recruiter"],
    });
  }

  const openVacs = (vacancies || []).filter((v) => v.status === "open");
  if (openVacs.length > 0) {
    const lowApp = openVacs.filter((v) => Number(v.applications_count || 0) < 3);
    if (lowApp.length > 0) {
      insights.push({
        insight_type: "sourcing",
        title: "Low application volume",
        summary: `${lowApp.length} open vacancies have fewer than 3 applications.`,
        severity: "medium",
        score: 65,
        recommendations: ["Boost careers portal features", "Engage agencies/referrals"],
      });
    }
  }

  const pendingInterviews = (interviews || []).filter((i) => i.status === "scheduled");
  if (pendingInterviews.length >= 3) {
    insights.push({
      insight_type: "interviews",
      title: "Upcoming interview load",
      summary: `${pendingInterviews.length} interviews scheduled — ensure panel readiness.`,
      severity: "info",
      score: 55,
      recommendations: ["Send calendar reminders", "Share scorecards"],
    });
  }

  const openOffers = (offers || []).filter((o) => o.status === "issued" && o.candidate_response === "pending");
  if (openOffers.length > 0) {
    insights.push({
      insight_type: "offers",
      title: "Offers awaiting response",
      summary: `${openOffers.length} issued offers pending candidate decision.`,
      severity: "medium",
      score: 70,
      recommendations: ["Follow up before expiry", "Review compensation competitiveness"],
    });
  }

  if (insights.length === 0) {
    insights.push({
      insight_type: "health",
      title: "Recruitment pipeline healthy",
      summary: "No critical funnel or offer risks detected from current data.",
      severity: "info",
      score: 90,
      recommendations: ["Keep weekly hiring stand-up", "Refresh job ads monthly"],
    });
  }

  for (const [i, ins] of insights.slice(0, 5).entries()) {
    try {
      await sb.from("ta_ai_insights").insert({
        company_id: companyId,
        insight_code: `AI-TA-RT-${Date.now()}-${i}`,
        insight_type: ins.insight_type,
        title: ins.title,
        summary: ins.summary,
        severity: ins.severity,
        score: ins.score ?? 0,
        recommendations: (ins.recommendations || []).join("; "),
        status: "open",
      });
    } catch {
      /* ignore */
    }
  }

  return insights;
}
