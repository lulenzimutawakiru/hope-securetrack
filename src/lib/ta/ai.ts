import { mustList, persistInsights, type RuleInsight } from "@/lib/crud/ai-insights";

export type TaInsight = RuleInsight;

export async function generateTalentInsights(
  companyId: string
): Promise<TaInsight[]> {
  void companyId;
  const insights: TaInsight[] = [];

  const [apps, vacancies, interviews, offers] = await Promise.all([
    mustList<Record<string, unknown>>("ta_applications", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ta_vacancies", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ta_interviews", { pageSize: 100 }),
    mustList<Record<string, unknown>>("ta_offers", { pageSize: 100 }),
  ]);

  const openApps = apps.filter((a) => a.status === "open");
  const screening = openApps.filter((a) =>
    ["applied", "screen"].includes(String(a.stage_code))
  );
  if (screening.length >= 5) {
    insights.push({
      insight_type: "funnel",
      title: "Screening backlog",
      summary: `${screening.length} applications await screening.`,
      severity: "high",
      score: 78,
      recommendations: [
        "Bulk shortlist high match scores",
        "Assign co-recruiter",
      ],
    });
  }

  const openVacs = vacancies.filter((v) => v.status === "open");
  if (openVacs.length > 0) {
    const lowApp = openVacs.filter(
      (v) => Number(v.applications_count || 0) < 3
    );
    if (lowApp.length > 0) {
      insights.push({
        insight_type: "sourcing",
        title: "Low application volume",
        summary: `${lowApp.length} open vacancies have fewer than 3 applications.`,
        severity: "medium",
        score: 65,
        recommendations: [
          "Boost careers portal features",
          "Engage agencies/referrals",
        ],
      });
    }
  }

  const pendingInterviews = interviews.filter(
    (i) => i.status === "scheduled"
  );
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

  const openOffers = offers.filter(
    (o) => o.status === "issued" && o.candidate_response === "pending"
  );
  if (openOffers.length > 0) {
    insights.push({
      insight_type: "offers",
      title: "Offers awaiting response",
      summary: `${openOffers.length} issued offers pending candidate decision.`,
      severity: "medium",
      score: 70,
      recommendations: [
        "Follow up before expiry",
        "Review compensation competitiveness",
      ],
    });
  }

  if (insights.length === 0) {
    insights.push({
      insight_type: "health",
      title: "Talent pipeline healthy",
      summary: "No critical recruiting bottlenecks detected.",
      severity: "info",
      score: 40,
      recommendations: ["Maintain sourcing cadence"],
    });
  }

  await persistInsights("ta_ai_insights", insights);
  return insights;
}
