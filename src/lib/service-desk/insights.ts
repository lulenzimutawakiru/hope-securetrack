/**
 * Service Desk executive intelligence.
 *
 * Deterministic, tenant-isolated heuristics over rows that the caller has
 * already fetched through RLS-scoped queries (browser Supabase client scopes
 * every read by company_id, so cross-tenant data can never reach these
 * functions). No server round-trip is required for the command center.
 */

import { minutesUntil } from "./sla";
import { detectSentiment } from "./ai";

export type InsightSeverity = "critical" | "warning" | "info" | "success";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: string;
  action?: string;
}

export interface RecurringIssue {
  category: string;
  subcategory: string;
  count: number;
  openCount: number;
  sample: string;
}

export interface SlaBreachRisk {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  risk: "low" | "medium" | "high";
  minutesRemaining: number | null;
  message: string;
}

export interface AgentWorkload {
  agentId: string;
  agentName: string;
  openCount: number;
  criticalCount: number;
}

export interface KnowledgeGap {
  category: string;
  ticketCount: number;
  articleCount: number;
}

export interface AutomationOpportunity {
  category: string;
  subcategory: string;
  requestCount: number;
  description: string;
}

export interface SlaHealthSnapshot {
  active: number;
  resolved: number;
  met: number;
  breached: number;
  atRisk: number;
  compliancePct: number;
}

const ACTIVE_STATUSES = new Set([
  "new",
  "assigned",
  "acknowledged",
  "investigating",
  "waiting_customer",
  "in_progress",
  "open",
  "pending",
]);

const CLOSED_STATUSES = new Set([
  "resolved",
  "closed",
  "archived",
  "customer_confirmation",
]);

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asBool(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}

function isActive(status: unknown): boolean {
  const s = asString(status).toLowerCase();
  return ACTIVE_STATUSES.has(s);
}

function isClosed(status: unknown): boolean {
  const s = asString(status).toLowerCase();
  return CLOSED_STATUSES.has(s);
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Recurring issue detection: same category/subcategory appearing frequently. */
export function detectRecurringIssues(
  tickets: Array<Record<string, unknown>>,
  threshold = 3
): RecurringIssue[] {
  const groups = new Map<string, { count: number; openCount: number; last: Record<string, unknown> }>();
  for (const t of tickets) {
    if (isClosed(t.status)) continue;
    const category = asString(t.category) || "uncategorized";
    const subcategory = asString(t.subcategory) || "other";
    const key = `${category}|${subcategory}`;
    const g = groups.get(key) ?? { count: 0, openCount: 0, last: t };
    g.count += 1;
    if (isActive(t.status)) g.openCount += 1;
    g.last = t;
    groups.set(key, g);
  }
  return Array.from(groups.entries())
    .map(([key, g]) => {
      const [category, subcategory] = key.split("|");
      return {
        category,
        subcategory,
        count: g.count,
        openCount: g.openCount,
        sample: asString(g.last.subject).slice(0, 120) || "No subject",
      };
    })
    .filter((r) => r.count >= threshold)
    .sort((a, b) => b.count - a.count);
}

/** SLA breach prediction for every active ticket approaching its resolve due. */
export function detectSlaBreachRisks(
  tickets: Array<Record<string, unknown>>,
  atRiskMinutes = 180
): SlaBreachRisk[] {
  const risks: SlaBreachRisk[] = [];
  for (const t of tickets) {
    if (!isActive(t.status)) continue;
    const due = asString(t.sla_resolve_due);
    if (!due) continue;
    const mins = minutesUntil(due);
    const risk: "low" | "medium" | "high" =
      mins == null || mins < 0 ? "high" : mins < atRiskMinutes ? "medium" : "low";
    if (risk === "low") continue;
    risks.push({
      ticketId: asString(t.id),
      ticketNumber: asString(t.ticket_number) || asString(t.id).slice(0, 8),
      subject: asString(t.subject).slice(0, 140),
      priority: asString(t.priority) || "medium",
      risk,
      minutesRemaining: mins,
      message:
        mins != null && mins < 0
          ? `SLA breached ${Math.abs(mins)} min ago`
          : `Resolve due in ${mins} min`,
    });
  }
  return risks.sort((a, b) => (a.minutesRemaining ?? 0) - (b.minutesRemaining ?? 0));
}

/** Agent workload: open + critical ticket counts per assigned agent. */
export function agentWorkload(
  tickets: Array<Record<string, unknown>>,
  agents: Array<Record<string, unknown>> = []
): AgentWorkload[] {
  const names = new Map<string, string>();
  for (const a of agents) {
    const id = asString(a.id);
    if (id) names.set(id, asString(a.name) || asString(a.full_name) || asString(a.email) || "Unnamed agent");
  }
  const counts = new Map<string, { open: number; critical: number }>();
  for (const t of tickets) {
    if (!isActive(t.status)) continue;
    const agentId = asString(t.assigned_to);
    if (!agentId) continue;
    const c = counts.get(agentId) ?? { open: 0, critical: 0 };
    c.open += 1;
    if (asString(t.priority) === "critical") c.critical += 1;
    counts.set(agentId, c);
  }
  return Array.from(counts.entries())
    .map(([agentId, c]) => ({
      agentId,
      agentName: names.get(agentId) || "Unassigned pool",
      openCount: c.open,
      criticalCount: c.critical,
    }))
    .sort((a, b) => b.openCount - a.openCount);
}

/** Knowledge gaps: high-volume categories with few or no KB articles. */
export function detectKnowledgeGaps(
  tickets: Array<Record<string, unknown>>,
  articles: Array<Record<string, unknown>> = []
): KnowledgeGap[] {
  const ticketCounts = new Map<string, number>();
  for (const t of tickets) {
    const category = asString(t.category) || "uncategorized";
    ticketCounts.set(category, (ticketCounts.get(category) ?? 0) + 1);
  }
  const articleCounts = new Map<string, number>();
  for (const a of articles) {
    const category = asString(a.category) || "general";
    articleCounts.set(category, (articleCounts.get(category) ?? 0) + 1);
  }
  return Array.from(ticketCounts.entries())
    .map(([category, ticketCount]) => ({
      category,
      ticketCount,
      articleCount: articleCounts.get(category) ?? 0,
    }))
    .filter((g) => g.ticketCount >= 3 && g.articleCount === 0)
    .sort((a, b) => b.ticketCount - a.ticketCount);
}

/** Automation opportunities: repeatable service requests suited to self-service. */
export function detectAutomationOpportunities(
  tickets: Array<Record<string, unknown>>,
  threshold = 3
): AutomationOpportunity[] {
  const groups = new Map<string, { category: string; subcategory: string; count: number }>();
  const AUTOMATABLE = new Set(["account", "password", "hr", "finance", "procurement", "facilities"]);
  for (const t of tickets) {
    const category = asString(t.category);
    const subcategory = asString(t.subcategory) || "request";
    if (!AUTOMATABLE.has(category)) continue;
    const key = `${category}|${subcategory}`;
    const g = groups.get(key) ?? { category, subcategory, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .filter((g) => g.count >= threshold)
    .map((g) => ({
      category: g.category,
      subcategory: g.subcategory,
      requestCount: g.count,
      description: `Repeatable ${g.subcategory} requests (${g.count}) in ${g.category} - candidate for catalog automation and self-service.`,
    }))
    .sort((a, b) => b.requestCount - a.requestCount);
}

/** SLA health snapshot over resolved + active tickets. */
export function slaHealthSnapshot(
  tickets: Array<Record<string, unknown>>
): SlaHealthSnapshot {
  let active = 0;
  let resolved = 0;
  let met = 0;
  let breached = 0;
  let atRisk = 0;
  for (const t of tickets) {
    if (isClosed(t.status) || asString(t.status) === "resolved") {
      resolved += 1;
      const m = asBool(t.sla_resolve_met);
      if (m === true) met += 1;
      else if (m === false) breached += 1;
      continue;
    }
    if (isActive(t.status)) {
      active += 1;
      const due = asString(t.sla_resolve_due);
      const mins = due ? minutesUntil(due) : null;
      if (mins != null && mins < 0) breached += 1;
      else if (mins != null && mins < 180) atRisk += 1;
    }
  }
  const measured = met + breached;
  return {
    active,
    resolved,
    met,
    breached,
    atRisk,
    compliancePct: measured > 0 ? Math.round((met / measured) * 100) : 100,
  };
}

/** Average first response and resolution times in hours for closed tickets. */
export function responseTimeStats(tickets: Array<Record<string, unknown>>): {
  avgFirstResponseHours: number;
  avgResolutionHours: number;
  measured: number;
} {
  let frSum = 0;
  let frCount = 0;
  let resSum = 0;
  let resCount = 0;
  for (const t of tickets) {
    const created = asString(t.created_at);
    if (!created) continue;
    const createdMs = new Date(created).getTime();
    const fr = asString(t.first_response_at);
    if (fr) {
      frSum += (new Date(fr).getTime() - createdMs) / 3_600_000;
      frCount += 1;
    }
    const res = asString(t.resolved_at);
    if (res) {
      resSum += (new Date(res).getTime() - createdMs) / 3_600_000;
      resCount += 1;
    }
  }
  return {
    avgFirstResponseHours: frCount ? Math.round((frSum / frCount) * 10) / 10 : 0,
    avgResolutionHours: resCount ? Math.round((resSum / resCount) * 10) / 10 : 0,
    measured: Math.max(frCount, resCount),
  };
}

/** Composite executive insight list, ordered by severity. */
export function buildExecutiveInsights(input: {
  tickets: Array<Record<string, unknown>>;
  articles?: Array<Record<string, unknown>>;
  agents?: Array<Record<string, unknown>>;
}): Insight[] {
  const { tickets, articles = [], agents = [] } = input;
  const insights: Insight[] = [];

  const recurring = detectRecurringIssues(tickets);
  for (const r of recurring.slice(0, 3)) {
    insights.push({
      id: `recurring-${r.category}-${r.subcategory}`,
      severity: r.openCount >= 5 ? "critical" : "warning",
      title: "Recurring issue detected",
      description: `${r.category}/${r.subcategory} has ${r.openCount} open of ${r.count} total tickets. Sample: "${r.sample}".`,
      metric: pluralize(r.count, "ticket"),
      action: "Open a problem record and define a known error.",
    });
  }

  const breachRisks = detectSlaBreachRisks(tickets);
  const breached = breachRisks.filter((r) => r.risk === "high");
  if (breached.length > 0) {
    insights.push({
      id: "sla-breaches",
      severity: breached.length >= 3 ? "critical" : "warning",
      title: "SLA breaches / imminent",
      description: `${breached.length} active ${pluralize(breached.length, "ticket")} ${breached.length === 1 ? "is" : "are"} past or within minutes of the resolve deadline.`,
      metric: pluralize(breached.length, "ticket"),
      action: "Escalate to supervisors and assign coverage immediately.",
    });
  }

  const workload = agentWorkload(tickets, agents);
  const top = workload[0];
  if (top && top.openCount >= 8) {
    insights.push({
      id: "workload-imbalance",
      severity: "warning",
      title: "Agent workload imbalance",
      description: `${top.agentName} carries ${top.openCount} open tickets (${top.criticalCount} critical) - the highest load in the pool.`,
      metric: pluralize(top.openCount, "ticket"),
      action: "Re-balance assignments across the team.",
    });
  }

  const gaps = detectKnowledgeGaps(tickets, articles);
  if (gaps.length > 0) {
    insights.push({
      id: "knowledge-gaps",
      severity: "info",
      title: "Knowledge gaps",
      description: `${gaps.length} high-volume categor${gaps.length === 1 ? "y" : "ies"} have no knowledge articles: ${gaps
        .slice(0, 3)
        .map((g) => g.category)
        .join(", ")}.`,
      metric: pluralize(gaps.reduce((s, g) => s + g.ticketCount, 0), "ticket"),
      action: "Author articles to deflect repeat requests.",
    });
  }

  const automations = detectAutomationOpportunities(tickets);
  if (automations.length > 0) {
    insights.push({
      id: "automation-opportunities",
      severity: "success",
      title: "Automation opportunities",
      description: automations
        .slice(0, 2)
        .map((a) => `${a.category}/${a.subcategory} (${a.requestCount})`)
        .join(", "),
      metric: pluralize(automations.reduce((s, a) => s + a.requestCount, 0), "request"),
      action: "Build catalog workflows to auto-fulfill these requests.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-clear",
      severity: "success",
      title: "Service desk healthy",
      description: "No recurring issues, SLA risks or workload imbalances detected in the current window.",
    });
  }

  const rank: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------------------
// Current trends: backlog forecasting, CX intelligence, proactive service
// ---------------------------------------------------------------------------

export interface BacklogDay {
  date: string;
  projectedOpen: number;
  intake: number;
}

export interface BacklogForecast {
  dailyIntake: number;
  dailyClosure: number;
  currentOpen: number;
  days: BacklogDay[];
  summary: string;
}

/** Project the open-ticket backlog for the next N days from observed intake/closure. */
export function forecastBacklog(
  tickets: Array<Record<string, unknown>>,
  days = 14
): BacklogForecast {
  const now = Date.now();
  const dayMs = 86_400_000;
  const intakeByDay = new Map<string, number>();
  const closureByDay = new Map<string, number>();

  for (const t of tickets) {
    const created = asString(t.created_at);
    if (created) {
      const d = new Date(created).toISOString().slice(0, 10);
      intakeByDay.set(d, (intakeByDay.get(d) || 0) + 1);
    }
    const closedAt = asString(t.closed_at) || asString(t.resolved_at);
    if (closedAt) {
      const d = new Date(closedAt).toISOString().slice(0, 10);
      closureByDay.set(d, (closureByDay.get(d) || 0) + 1);
    }
  }

  const last7 = new Date(now - 7 * dayMs).toISOString().slice(0, 10);
  let intakeSum = 0;
  let intakeDays = 0;
  for (const [d, n] of intakeByDay) {
    if (d >= last7) {
      intakeSum += n;
      intakeDays += 1;
    }
  }
  let closureSum = 0;
  let closureDays = 0;
  for (const [d, n] of closureByDay) {
    if (d >= last7) {
      closureSum += n;
      closureDays += 1;
    }
  }
  const dailyIntake = intakeDays ? Math.round((intakeSum / intakeDays) * 10) / 10 : 0;
  const dailyClosure = closureDays ? Math.round((closureSum / closureDays) * 10) / 10 : 0;
  const currentOpen = tickets.filter((t) => isActive(t.status)).length;
  const net = dailyIntake - dailyClosure;

  const daysArr: BacklogDay[] = [];
  let projected = currentOpen;
  for (let k = 1; k <= days; k += 1) {
    const date = new Date(now + k * dayMs).toISOString().slice(0, 10);
    projected = Math.max(0, Math.round(projected + net));
    daysArr.push({ date, projectedOpen: projected, intake: dailyIntake });
  }

  const trend = net > 0.2 ? "growing" : net < -0.2 ? "declining" : "stable";
  const projectedEnd = daysArr.length > 0 ? daysArr[daysArr.length - 1].projectedOpen : currentOpen;
  const summary =
    `Backlog is ${trend}: ${dailyIntake} new vs ${dailyClosure} closed per day. ` +
    `Projected ${currentOpen} open now to ${projectedEnd} in ${days} days.`;
  return { dailyIntake, dailyClosure, currentOpen, days: daysArr, summary };
}

export interface FollowUpItem {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  requester: string;
  reason: string;
  score: number;
}

export interface CxIntelligence {
  csatAverage: number | null;
  csatCount: number;
  npsScore: number | null;
  npsCount: number;
  promoters: number;
  passives: number;
  detractors: number;
  sentimentMix: { positive: number; neutral: number; negative: number; frustrated: number };
  deflectionRate: number | null;
  aiResolved: number;
  aiTicketCreated: number;
  needsFollowUp: FollowUpItem[];
  insights: Insight[];
}

export interface CxIntelligenceInput {
  csat?: Array<Record<string, unknown>>;
  nps?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  aiSessions?: Array<Record<string, unknown>>;
  tickets?: Array<Record<string, unknown>>;
}

/** Voice-of-the-customer intelligence: CSAT, NPS, sentiment, deflection, follow-ups. */
export function cxIntelligence(input: CxIntelligenceInput): CxIntelligence {
  const csat = input.csat || [];
  const nps = input.nps || [];
  const messages = input.messages || [];
  const aiSessions = input.aiSessions || [];
  const tickets = input.tickets || [];
  const insights: Insight[] = [];

  const csatAverage =
    csat.length > 0
      ? Math.round((csat.reduce((s, r) => s + Number(r.score || 0), 0) / csat.length) * 10) / 10
      : null;

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const r of nps) {
    const s = Number(r.score || 0);
    if (s >= 9) promoters += 1;
    else if (s >= 7) passives += 1;
    else detractors += 1;
  }
  const npsScore = nps.length > 0 ? Math.round(((promoters - detractors) / nps.length) * 100) : null;

  const sentimentMix = { positive: 0, neutral: 0, negative: 0, frustrated: 0 };
  for (const m of messages) {
    const body = asString(m.body);
    if (!body) continue;
    const s = detectSentiment(body);
    sentimentMix[s.label] += 1;
  }

  const aiResolved = aiSessions.filter((s) => asString(s.outcome) === "resolved_ai").length;
  const aiTicketCreated = aiSessions.filter((s) => asString(s.outcome) === "ticket_created").length;
  const deflectionRate = aiSessions.length > 0 ? Math.round((aiResolved / aiSessions.length) * 100) : null;

  // Follow-ups: low CSAT or negative/frustrated inbound messages on known tickets
  const byTicket = new Map<string, FollowUpItem>();
  for (const r of csat) {
    const score = Number(r.score || 0);
    if (score >= 3) continue;
    const ticketId = asString(r.ticket_id);
    const existing = byTicket.get(ticketId) || {
      ticketId,
      ticketNumber: "",
      subject: "",
      requester: "",
      reason: "",
      score,
    };
    existing.score = Math.min(existing.score || 5, score);
    existing.reason = `CSAT ${score}/5`;
    byTicket.set(ticketId, existing);
  }
  for (const m of messages) {
    const body = asString(m.body);
    const s = detectSentiment(body);
    if (s.label !== "negative" && s.label !== "frustrated") continue;
    const ticketId = asString(m.ticket_id);
    if (!ticketId) continue;
    const existing = byTicket.get(ticketId) || {
      ticketId,
      ticketNumber: "",
      subject: "",
      requester: "",
      reason: "",
      score: 5,
    };
    existing.reason = `${s.label} message sentiment`;
    existing.score = Math.min(existing.score, s.label === "frustrated" ? 1.5 : 2.5);
    byTicket.set(ticketId, existing);
  }
  for (const t of tickets) {
    const ticketId = asString(t.id);
    const item = byTicket.get(ticketId);
    if (!item) continue;
    item.ticketNumber = asString(t.ticket_number);
    item.subject = asString(t.subject);
    item.requester = asString(t.requester_name);
  }
  const needsFollowUp = Array.from(byTicket.values())
    .filter((x) => x.ticketNumber)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  if (needsFollowUp.length > 0) {
    insights.push({
      id: "cx-follow-up",
      severity: "warning",
      title: "Customer follow-up needed",
      description: `${needsFollowUp.length} ${pluralize(needsFollowUp.length, "customer")} ${
        needsFollowUp.length === 1 ? "has" : "have"
      } low CSAT or negative sentiment that ${needsFollowUp.length === 1 ? "needs" : "need"} an owner to reach out.`,
      metric: pluralize(needsFollowUp.length, "ticket"),
      action: "Assign a callback and add the outcome to the ticket thread.",
    });
  }
  if (csatAverage !== null && csatAverage < 3.5) {
    insights.push({
      id: "cx-csat-risk",
      severity: "critical",
      title: "CSAT trending down",
      description: `Average satisfaction is ${csatAverage}/5 across ${csat.length} responses.`,
      metric: `${csatAverage}/5`,
      action: "Review recent resolutions and coach the affected agents.",
    });
  }
  if (npsScore !== null && detractors > promoters) {
    insights.push({
      id: "cx-nps-detractors",
      severity: "warning",
      title: "NPS detractors outnumber promoters",
      description: `${detractors} detractors vs ${promoters} promoters (NPS ${npsScore}).`,
      metric: `NPS ${npsScore}`,
      action: "Interview detractors and fix the underlying service gaps.",
    });
  }
  if (deflectionRate !== null) {
    if (deflectionRate >= 30) {
      insights.push({
        id: "cx-deflection",
        severity: "success",
        title: "AI deflection is working",
        description: `${deflectionRate}% of AI conversations resolved without an agent.`,
        metric: `${deflectionRate}%`,
        action: "Expand KB coverage to deflect more of the remaining volume.",
      });
    } else if (aiSessions.length >= 5) {
      insights.push({
        id: "cx-deflection-low",
        severity: "info",
        title: "AI deflection opportunity",
        description: `Only ${deflectionRate}% of AI conversations are deflected. ${aiTicketCreated} became tickets.`,
        metric: `${deflectionRate}%`,
        action: "Author knowledge articles for the top intents to lift deflection.",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "cx-clear",
      severity: "success",
      title: "Customer experience healthy",
      description: "No CSAT, NPS, sentiment or deflection risks detected in the current window.",
    });
  }

  return {
    csatAverage,
    csatCount: csat.length,
    npsScore,
    npsCount: nps.length,
    promoters,
    passives,
    detractors,
    sentimentMix,
    deflectionRate,
    aiResolved,
    aiTicketCreated,
    needsFollowUp,
    insights,
  };
}