/** AI Customer Intelligence Engine for Hope CRM */

export interface HealthFactors {
  daysSinceLastOrder?: number;
  openTickets?: number;
  overdueAmount?: number;
  nps?: number | null;
  orderCount90d?: number;
  creditUtilization?: number;
}

export interface LeadScoreInput {
  source?: string | null;
  estimated_value?: number | null;
  has_email?: boolean;
  has_phone?: boolean;
  industry?: string | null;
  status?: string | null;
}

export function scoreLead(input: LeadScoreInput): number {
  let score = 20;
  const src = (input.source || "").toLowerCase();
  if (src.includes("referral") || src.includes("tender")) score += 25;
  else if (src.includes("website") || src.includes("trade")) score += 15;
  else if (src.includes("whatsapp") || src.includes("phone")) score += 10;
  else score += 5;

  const val = Number(input.estimated_value || 0);
  if (val >= 100_000_000) score += 25;
  else if (val >= 20_000_000) score += 18;
  else if (val >= 5_000_000) score += 12;
  else if (val > 0) score += 6;

  if (input.has_email) score += 8;
  if (input.has_phone) score += 7;

  const ind = (input.industry || "").toLowerCase();
  if (ind.includes("government") || ind.includes("education") || ind.includes("bank")) {
    score += 10;
  }

  const st = (input.status || "").toLowerCase();
  if (st === "qualified" || st === "proposal") score += 8;
  if (st === "negotiation") score += 12;

  return Math.max(0, Math.min(100, score));
}

export function computeHealthScore(factors: HealthFactors): {
  score: number;
  churn_risk: number;
  engagement: number;
  financial: number;
  support: number;
  next_best_action: string;
} {
  let engagement = 70;
  let financial = 75;
  let support = 80;

  const days = factors.daysSinceLastOrder ?? 45;
  if (days <= 30) engagement = 95;
  else if (days <= 60) engagement = 80;
  else if (days <= 90) engagement = 60;
  else if (days <= 180) engagement = 40;
  else engagement = 20;

  const util = factors.creditUtilization ?? 0.3;
  if (util > 0.9) financial = 35;
  else if (util > 0.7) financial = 55;
  else if (util > 0.4) financial = 75;
  else financial = 90;

  if ((factors.overdueAmount || 0) > 0) financial = Math.max(20, financial - 25);

  const tickets = factors.openTickets ?? 0;
  if (tickets === 0) support = 95;
  else if (tickets === 1) support = 75;
  else if (tickets <= 3) support = 55;
  else support = 30;

  if (factors.nps != null) {
    if (factors.nps >= 9) engagement = Math.min(100, engagement + 10);
    else if (factors.nps <= 6) engagement = Math.max(10, engagement - 15);
  }

  const score = Math.round(engagement * 0.4 + financial * 0.35 + support * 0.25);
  const churn_risk = Math.round(Math.max(0, Math.min(100, 100 - score + (days > 90 ? 15 : 0))));

  let next_best_action = "Maintain regular cadence and monitor pipeline.";
  if (churn_risk >= 60) {
    next_best_action = "High churn risk — schedule account review within 7 days and offer retention package.";
  } else if (financial < 50) {
    next_best_action = "Credit pressure — review outstanding balance and payment plan before new orders.";
  } else if (engagement < 50) {
    next_best_action = "Re-engage with personalized campaign and product demo.";
  } else if ((factors.orderCount90d || 0) >= 3 && score >= 80) {
    next_best_action = "Strong health — pursue upsell / cross-sell of security products.";
  }

  return { score, churn_risk, engagement, financial, support, next_best_action };
}

export function predictChurn(health: number, daysSinceContact: number, openTickets: number): number {
  let risk = 100 - health;
  if (daysSinceContact > 90) risk += 15;
  if (daysSinceContact > 180) risk += 20;
  if (openTickets >= 3) risk += 10;
  return Math.max(0, Math.min(100, risk));
}

export function nextBestActions(ctx: {
  customerName?: string;
  health?: number;
  openOpps?: number;
  overdue?: number;
  loyalty?: string;
}): string[] {
  const actions: string[] = [];
  if ((ctx.overdue || 0) > 0) {
    actions.push("Send payment reminder and escalate credit hold if overdue > 60 days.");
  }
  if ((ctx.health || 70) < 50) {
    actions.push("Book executive check-in with decision maker this week.");
  }
  if ((ctx.openOpps || 0) === 0) {
    actions.push("Identify cross-sell: QR labels, certificates, or secure packaging.");
  } else {
    actions.push("Advance open opportunities — update probability and next meeting.");
  }
  if (["gold", "platinum", "diamond", "vip"].includes((ctx.loyalty || "").toLowerCase())) {
    actions.push("Invite to strategic partner program / co-marketing.");
  }
  actions.push("Log activity on Customer Timeline after every touchpoint.");
  return actions.slice(0, 5);
}

export function forecastPipeline(
  opps: Array<{ expected_value?: number | null; probability?: number | null; stage?: string | null }>
): {
  totalPipeline: number;
  weightedForecast: number;
  commit: number;
  bestCase: number;
  winRateHint: string;
} {
  let totalPipeline = 0;
  let weightedForecast = 0;
  let commit = 0;
  let bestCase = 0;
  let open = 0;
  let won = 0;

  for (const o of opps) {
    const v = Number(o.expected_value || 0);
    const p = Number(o.probability || 0);
    const stage = (o.stage || "").toLowerCase();
    if (stage === "won" || stage === "closed_won") {
      won += 1;
      continue;
    }
    if (stage === "lost" || stage === "closed_lost") continue;
    open += 1;
    totalPipeline += v;
    weightedForecast += (v * p) / 100;
    if (p >= 70 || stage === "negotiation") commit += v;
    if (p >= 40) bestCase += v;
  }

  const winRateHint =
    open + won === 0
      ? "Insufficient closed history — track outcomes for 30 days."
      : `Approx win rate signal: ${Math.round((won / Math.max(1, open + won)) * 100)}% of settled deals.`;

  return { totalPipeline, weightedForecast, commit, bestCase, winRateHint };
}

export function summarizeTimeline(
  events: Array<{ kind?: string; title?: string; body?: string | null; occurred_at?: string }>
): string {
  if (!events.length) return "No timeline activity recorded yet.";
  const recent = events.slice(0, 12);
  const kinds = new Map<string, number>();
  for (const e of recent) {
    const k = e.kind || "note";
    kinds.set(k, (kinds.get(k) || 0) + 1);
  }
  const mix = Array.from(kinds.entries())
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  const highlights = recent
    .slice(0, 4)
    .map((e) => `• ${e.title}${e.body ? `: ${e.body.slice(0, 80)}` : ""}`)
    .join("\n");
  return `AI summary of last ${recent.length} touchpoints (${mix}):\n${highlights}\nRecommendation: capture next action and owner on the account.`;
}

export function recommendProducts(industry?: string | null): string[] {
  const ind = (industry || "").toLowerCase();
  if (ind.includes("education") || ind.includes("school") || ind.includes("university")) {
    return ["Secure exam booklets", "Transcript security paper", "Certificate holograms", "QR authentication labels"];
  }
  if (ind.includes("government") || ind.includes("ministry")) {
    return ["Secure ID print media", "Tamper-evident seals", "High-security certificates", "Audit-ready packaging"];
  }
  if (ind.includes("bank") || ind.includes("finance")) {
    return ["Cheque security paper", "Card carrier forms", "Secure stationery", "Anti-counterfeit labels"];
  }
  if (ind.includes("distribut") || ind.includes("dealer") || ind.includes("retail")) {
    return ["A4 bond paper", "Security labels", "Branded packaging", "POS QR tags"];
  }
  return ["Premium A4 copy paper", "Security labels", "Custom packaging", "QR product authentication"];
}

export function campaignTargetHint(segment: string): string {
  const s = segment.toLowerCase();
  if (s.includes("gov") || s.includes("edu")) {
    return "Prioritize accounts with tenders in next 60 days and dormant schools (no order 90+ days).";
  }
  if (s.includes("channel") || s.includes("dealer")) {
    return "Push restock promos to dealers below 50% of YTD target; attach co-op marketing assets.";
  }
  if (s.includes("vip") || s.includes("strategic")) {
    return "Executive briefing + early access to new security product line; personal AM outreach.";
  }
  return "Segment by recency, frequency, monetary value; suppress customers on credit hold.";
}

export function sentimentFromText(text: string): "positive" | "neutral" | "negative" {
  const t = text.toLowerCase();
  const pos = ["excellent", "great", "good", "thank", "happy", "recommend", "satisfied", "love"];
  const neg = ["bad", "poor", "delay", "late", "complaint", "angry", "issue", "broken", "counterfeit", "refund"];
  let p = 0;
  let n = 0;
  for (const w of pos) if (t.includes(w)) p++;
  for (const w of neg) if (t.includes(w)) n++;
  if (n > p) return "negative";
  if (p > n) return "positive";
  return "neutral";
}
