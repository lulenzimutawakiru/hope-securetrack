import { computePriorityFromImpactUrgency } from "./sla";

export interface KbArticle {
  id: string;
  title: string;
  summary?: string | null;
  body: string;
  category?: string | null;
  tags?: string[] | null;
}

export interface AiAssistResult {
  suggestedCategory: string;
  suggestedSubcategory: string | null;
  suggestedServiceType: string;
  suggestedPriority: string;
  suggestedImpact: string;
  suggestedUrgency: string;
  knowledgeMatches: Array<{ id: string; title: string; score: number; snippet: string }>;
  suggestedReply: string;
  shouldCreateTicket: boolean;
  isMajor: boolean;
  tags: string[];
}

const KEYWORDS: Array<{
  keys: string[];
  category: string;
  subcategory: string;
  service: string;
  impact: string;
  urgency: string;
}> = [
  { keys: ["wifi", "wi-fi", "wireless", "network", "vpn", "lan"], category: "network", subcategory: "connectivity", service: "it", impact: "high", urgency: "high" },
  { keys: ["password", "locked out", "login", "mfa", "2fa", "account"], category: "account", subcategory: "password", service: "it", impact: "medium", urgency: "high" },
  { keys: ["printer", "print", "toner", "jam"], category: "hardware", subcategory: "printer", service: "it", impact: "low", urgency: "medium" },
  { keys: ["laptop", "computer", "pc", "desktop", "hardware"], category: "hardware", subcategory: "device", service: "it", impact: "medium", urgency: "medium" },
  { keys: ["server", "outage", "down", "offline", "crash"], category: "server", subcategory: "outage", service: "it", impact: "critical", urgency: "critical" },
  { keys: ["email", "outlook", "mailbox"], category: "software", subcategory: "email", service: "it", impact: "medium", urgency: "medium" },
  { keys: ["leave", "holiday", "payslip", "hr"], category: "hr", subcategory: "inquiry", service: "hr", impact: "low", urgency: "low" },
  { keys: ["invoice", "payment", "payroll", "finance"], category: "finance", subcategory: "inquiry", service: "finance", impact: "medium", urgency: "medium" },
  { keys: ["security", "breach", "phishing", "malware", "virus"], category: "security", subcategory: "incident", service: "security", impact: "critical", urgency: "critical" },
  { keys: ["production", "machine", "factory", "mes", "breakdown"], category: "production", subcategory: "breakdown", service: "maintenance", impact: "high", urgency: "high" },
  { keys: ["warehouse", "stock", "picking", "inventory discrepancy"], category: "warehouse", subcategory: "stock", service: "warehouse", impact: "medium", urgency: "medium" },
  { keys: ["vehicle", "fleet", "truck", "fuel", "accident"], category: "fleet", subcategory: "breakdown", service: "fleet", impact: "high", urgency: "high" },
  { keys: ["delivery", "dispatch", "shipment", "pod"], category: "delivery", subcategory: "issue", service: "customer", impact: "high", urgency: "high" },
  { keys: ["warranty", "return", "counterfeit", "authentication"], category: "customer", subcategory: "warranty", service: "customer", impact: "medium", urgency: "medium" },
  { keys: ["leave", "recruitment", "complaint", "employee"], category: "hr", subcategory: "request", service: "hr", impact: "low", urgency: "medium" },
  { keys: ["plumbing", "electrical", "cleaning", "facilities"], category: "facilities", subcategory: "request", service: "facilities", impact: "low", urgency: "medium" },
];


export function analyzeRequest(
  text: string,
  articles: KbArticle[] = []
): AiAssistResult {
  const lower = text.toLowerCase();
  let match = KEYWORDS.find((k) => k.keys.some((key) => lower.includes(key)));
  if (!match) {
    match = {
      keys: [],
      category: "general",
      subcategory: "other",
      service: "it",
      impact: "medium",
      urgency: "medium",
    };
  }

  const priority = computePriorityFromImpactUrgency(match.impact, match.urgency);
  const isMajor =
    match.impact === "critical" ||
    lower.includes("major") ||
    lower.includes("all users") ||
    lower.includes("entire plant");

  const knowledgeMatches = searchKnowledge(text, articles);

  const canSelfServe =
    knowledgeMatches.length > 0 &&
    knowledgeMatches[0].score >= 0.4 &&
    !isMajor &&
    priority !== "critical";

  const suggestedReply = canSelfServe
    ? `I found a knowledge article that may help: "${knowledgeMatches[0].title}". ${knowledgeMatches[0].snippet.slice(0, 200)}… If this does not resolve your issue, I can open a ticket for you.`
    : `I'll create a ${match.service.toUpperCase()} ticket classified as ${match.category}/${match.subcategory} with priority ${priority}. An agent will respond within the SLA window.`;

  return {
    suggestedCategory: match.category,
    suggestedSubcategory: match.subcategory,
    suggestedServiceType: match.service,
    suggestedPriority: priority,
    suggestedImpact: match.impact,
    suggestedUrgency: match.urgency,
    knowledgeMatches,
    suggestedReply,
    shouldCreateTicket: !canSelfServe || isMajor,
    isMajor,
    tags: match.keys.filter((k) => lower.includes(k)).slice(0, 5),
  };
}

export function searchKnowledge(
  query: string,
  articles: KbArticle[]
): Array<{ id: string; title: string; score: number; snippet: string }> {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);
  return articles
    .map((a) => {
      const hay = `${a.title} ${a.summary || ""} ${a.body} ${(a.tags || []).join(" ")}`.toLowerCase();
      const hits = words.filter((w) => hay.includes(w)).length;
      const score = words.length ? hits / words.length : 0;
      const snippet = (a.summary || a.body || "").replace(/\s+/g, " ").slice(0, 180);
      return { id: a.id, title: a.title, score, snippet };
    })
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function summarizeTicketThread(
  events: Array<{ event_type: string; message?: string | null; created_at?: string }>
): string {
  if (!events.length) return "No activity yet.";
  const comments = events.filter(
    (e) => e.event_type === "comment" || e.event_type === "note" || e.event_type === "status"
  );
  const latest = comments.slice(-5);
  return latest
    .map((e) => `• [${e.event_type}] ${(e.message || "").slice(0, 120)}`)
    .join("\n");
}

export function predictSlaBreach(params: {
  resolveDue?: string | null;
  status?: string;
  priority?: string;
}): { risk: "low" | "medium" | "high"; message: string } {
  if (!params.resolveDue) return { risk: "low", message: "No SLA due date set." };
  if (["resolved", "closed", "archived"].includes(params.status || "")) {
    return { risk: "low", message: "Ticket already resolved/closed." };
  }
  const mins = (new Date(params.resolveDue).getTime() - Date.now()) / 60_000;
  if (mins < 0) return { risk: "high", message: "SLA already breached." };
  if (mins < 30) return { risk: "high", message: `SLA breach in ${Math.round(mins)} minutes.` };
  if (mins < 120) return { risk: "medium", message: `At risk — ${Math.round(mins)} minutes remaining.` };
  return { risk: "low", message: `On track — ${Math.round(mins / 60)} hours remaining.` };
}
