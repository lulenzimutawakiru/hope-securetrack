import { createClient } from "@/lib/supabase/client";

export type SalesInsight = {
  id?: string;
  insight_type: string;
  title: string;
  summary: string;
  severity: string;
  score?: number;
  recommendations?: string[];
  status?: string;
};

/** Rule-based sales AI insights (extendable to LLM). */
export async function generateSalesInsights(companyId: string): Promise<SalesInsight[]> {
  const sb = createClient();
  const insights: SalesInsight[] = [];

  const [
    { data: opps },
    { data: quotes },
    { data: orders },
    { data: leads },
    { data: returns },
    { data: credit },
  ] = await Promise.all([
    sb
      .from("sales_opportunities")
      .select("stage,expected_value,probability,expected_close_date,name")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("quotations")
      .select("status,total_amount,valid_until,quote_number")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("sales_orders")
      .select("status,total_amount,order_date,credit_approved")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("sales_leads")
      .select("status,estimated_value,source")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(200),
    sb
      .from("sales_returns")
      .select("status,total_amount,reason")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .limit(100),
    sb
      .from("customers")
      .select("credit_status,credit_limit,name")
      .eq("company_id", companyId)
      .in("credit_status", ["hold", "blocked", "watch"])
      .limit(100),
  ]);

  const openOpps = (opps || []).filter((o) => !["won", "lost"].includes(String(o.stage)));
  const negotiation = openOpps.filter((o) => o.stage === "negotiation");
  if (negotiation.length >= 3) {
    const val = negotiation.reduce((s, r) => s + Number(r.expected_value || 0), 0);
    insights.push({
      insight_type: "pipeline",
      title: "Negotiation bottleneck",
      summary: `${negotiation.length} opportunities (UGX ${val.toLocaleString()}) stuck in negotiation.`,
      severity: "high",
      score: 80,
      recommendations: ["Daily deal review", "Escalate stalled deals over 14 days"],
      status: "open",
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiring = (quotes || []).filter(
    (q) => q.status === "sent" && q.valid_until && String(q.valid_until) <= today
  );
  if (expiring.length > 0) {
    insights.push({
      insight_type: "quoting",
      title: "Quotes expiring / expired",
      summary: `${expiring.length} sent quotations have reached or passed validity.`,
      severity: "medium",
      score: 70,
      recommendations: ["Follow up with customers", "Revise and re-send quotes"],
      status: "open",
    });
  }

  const unapprovedCredit = (orders || []).filter(
    (o) => o.credit_approved === false && ["confirmed", "draft"].includes(String(o.status))
  );
  if (unapprovedCredit.length > 0) {
    insights.push({
      insight_type: "credit",
      title: "Orders awaiting credit approval",
      summary: `${unapprovedCredit.length} orders lack credit approval and may delay fulfilment.`,
      severity: "high",
      score: 78,
      recommendations: ["Route to credit desk", "Check customer outstanding balances"],
      status: "open",
    });
  }

  const newLeads = (leads || []).filter((l) => l.status === "new");
  if (newLeads.length >= 5) {
    insights.push({
      insight_type: "leads",
      title: "Unworked lead backlog",
      summary: `${newLeads.length} leads still in new status need first contact.`,
      severity: "medium",
      score: 60,
      recommendations: ["Assign owners", "SLA: first touch within 24h"],
      status: "open",
    });
  }

  const openReturns = (returns || []).filter((r) =>
    ["requested", "approved"].includes(String(r.status))
  );
  if (openReturns.length >= 2) {
    insights.push({
      insight_type: "returns",
      title: "Open RMA volume",
      summary: `${openReturns.length} returns open — monitor quality and logistics cost.`,
      severity: "low",
      score: 45,
      recommendations: ["Root-cause top return reasons", "Link to production NCR if product defect"],
      status: "open",
    });
  }

  if ((credit || []).length > 0) {
    insights.push({
      insight_type: "credit",
      title: "Customers on credit watch/hold",
      summary: `${credit!.length} customers flagged hold/blocked/watch — constrain order risk.`,
      severity: "high",
      score: 75,
      recommendations: ["Review credit limits", "Require COD or prepayment"],
      status: "open",
    });
  }

  if (insights.length === 0) {
    insights.push({
      insight_type: "health",
      title: "Sales engine healthy",
      summary: "No critical pipeline, credit, or quoting anomalies detected from current data.",
      severity: "info",
      score: 90,
      recommendations: ["Keep weekly forecast hygiene", "Refresh targets monthly"],
      status: "open",
    });
  }

  // Persist top insights (best effort)
  for (const [i, ins] of insights.slice(0, 5).entries()) {
    try {
      await sb.from("sales_ai_insights").upsert(
        {
          company_id: companyId,
          insight_code: `AI-RT-${Date.now()}-${i}`,
          insight_type: ins.insight_type,
          title: ins.title,
          summary: ins.summary,
          severity: ins.severity,
          score: ins.score ?? 0,
          recommendations: (ins.recommendations || []).join("; "),
          status: "open",
        },
        { onConflict: "company_id,insight_code", ignoreDuplicates: true }
      );
    } catch {
      /* ignore */
    }
  }

  return insights;
}
