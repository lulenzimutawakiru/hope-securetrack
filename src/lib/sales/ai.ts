import { mustList, persistInsights, type RuleInsight } from "@/lib/crud/ai-insights";

export type SalesInsight = RuleInsight;

export async function generateSalesInsights(
  companyId: string
): Promise<SalesInsight[]> {
  void companyId;
  const insights: SalesInsight[] = [];

  const [opps, quotes, orders, leads, returns, credit] = await Promise.all([
    mustList<Record<string, unknown>>("sales_opportunities", { pageSize: 100 }),
    mustList<Record<string, unknown>>("quotations", { pageSize: 100 }),
    mustList<Record<string, unknown>>("sales_orders", { pageSize: 100 }),
    mustList<Record<string, unknown>>("sales_leads", { pageSize: 100 }),
    mustList<Record<string, unknown>>("sales_returns", { pageSize: 100 }),
    mustList<Record<string, unknown>>("customers", {
      pageSize: 100,
      filters: { credit_status: ["hold", "blocked", "watch"] },
    }),
  ]);

  const openOpps = opps.filter(
    (o) => !["won", "lost"].includes(String(o.stage))
  );
  const negotiation = openOpps.filter((o) => o.stage === "negotiation");
  if (negotiation.length >= 3) {
    const val = negotiation.reduce(
      (s, r) => s + Number(r.expected_value || 0),
      0
    );
    insights.push({
      insight_type: "pipeline",
      title: "Negotiation bottleneck",
      summary: `${negotiation.length} opportunities (UGX ${val.toLocaleString()}) stuck in negotiation.`,
      severity: "high",
      score: 80,
      recommendations: [
        "Daily deal review",
        "Escalate stalled deals over 14 days",
      ],
      status: "open",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiring = quotes.filter(
    (q) =>
      q.status === "sent" &&
      q.valid_until &&
      String(q.valid_until) <= today
  );
  if (expiring.length > 0) {
    insights.push({
      insight_type: "quoting",
      title: "Quotes expiring / expired",
      summary: `${expiring.length} sent quotations have reached or passed validity.`,
      severity: "medium",
      score: 70,
      recommendations: [
        "Follow up with customers",
        "Revise and re-send quotes",
      ],
      status: "open",
    });
  }

  const unapprovedCredit = orders.filter(
    (o) =>
      o.credit_approved === false &&
      ["confirmed", "draft"].includes(String(o.status))
  );
  if (unapprovedCredit.length > 0) {
    insights.push({
      insight_type: "credit",
      title: "Orders pending credit approval",
      summary: `${unapprovedCredit.length} order(s) blocked on credit check.`,
      severity: "high",
      score: 82,
      recommendations: ["Finance credit review", "Request deposits"],
      status: "open",
    });
  }

  const openLeads = leads.filter((l) =>
    ["new", "contacted", "qualified"].includes(String(l.status))
  );
  if (openLeads.length >= 10) {
    insights.push({
      insight_type: "leads",
      title: "Lead backlog",
      summary: `${openLeads.length} open leads need progression.`,
      severity: "medium",
      score: 60,
      recommendations: ["Assign owners", "Run conversion campaign"],
      status: "open",
    });
  }

  if (returns.length >= 3) {
    insights.push({
      insight_type: "returns",
      title: "Elevated return volume",
      summary: `${returns.length} recent returns — review quality/fulfillment.`,
      severity: "medium",
      score: 65,
      recommendations: ["Root-cause analysis", "Customer follow-up"],
      status: "open",
    });
  }

  if (credit.length > 0) {
    insights.push({
      insight_type: "credit",
      title: `${credit.length} customers on credit watch/hold`,
      summary: "Credit exposure requires active management.",
      severity: "high",
      score: 78,
      recommendations: ["Review limits", "Collect overdue AR"],
      status: "open",
    });
  }

  await persistInsights("sales_ai_insights", insights);
  return insights;
}
