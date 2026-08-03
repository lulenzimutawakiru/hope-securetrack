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


// ---------------------------------------------------------------------------
// AI Virtual Agent v2 - sentiment, intent, auto-reply, CSAT prediction
// ---------------------------------------------------------------------------

export type SentimentLabel = "positive" | "neutral" | "negative" | "frustrated";

export interface SentimentResult {
  label: SentimentLabel;
  /** -1 (very negative) .. +1 (very positive) */
  score: number;
  indicators: string[];
}

export type IntentLabel =
  | "report_incident"
  | "request_fulfillment"
  | "question"
  | "complaint"
  | "escalation_request"
  | "acknowledgement"
  | "greeting";

export interface IntentResult {
  intent: IntentLabel;
  confidence: number;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  escalationSignal: boolean;
  wantsHuman: boolean;
}

export interface CsatPrediction {
  predictedScore: number;
  band: "at_risk" | "neutral" | "promoter";
  note: string;
}

const NEGATIVE_WORDS = [
  "broken", "not working", "doesn't work", "does not work", "failed", "failure", "error",
  "crash", "down", "offline", "slow", "problem", "issue", "wrong", "bad", "lost",
  "missing", "cannot", "can't", "unable", "blocked", "stuck", "denied", "rejected",
];
const FRUSTRATED_WORDS = [
  "angry", "furious", "unacceptable", "terrible", "worst", "awful", "ridiculous",
  "disappointed", "fed up", "sick of", "useless", "complaint", "frustrating",
  "annoyed", "livid", "unbelievable",
];
const POSITIVE_WORDS = [
  "thank", "thanks", "great", "awesome", "perfect", "works", "working", "fixed",
  "resolved", "helpful", "appreciate", "excellent", "amazing", "good", "love",
  "solved", "done", "happy",
];
const CRITICAL_URGENCY = [
  "outage", "down", "breach", "emergency", "fire", "server down", "erp down",
  "production stopped", "production halt", "data loss", "security incident", "all users",
];
const HIGH_URGENCY = [
  "asap", "urgent", "immediately", "right away", "cannot work", "can't work",
  "deadline", "blocking", "stopped", "halted",
];
const LOW_URGENCY = ["when you get a chance", "not urgent", "whenever", "no rush", "later"];
const ESCALATION_WORDS = ["escalat", "supervisor", "manager", "director", "executive", "vp", "second level", "l2", "l3"];
const HUMAN_WORDS = ["human", "real person", "talk to someone", "speak to", "agent please", "call me", "call back"];
const GREETING_WORDS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"];
const REQUEST_WORDS = [
  "i need", "please", "i want", "can i get", "request", "apply for", "order",
  "new laptop", "new phone", "access to", "permission", "install", "set up",
];

export function detectSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  const indicators: string[] = [];
  let score = 0;

  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) {
      score -= 1;
      indicators.push(w);
    }
  }
  for (const w of FRUSTRATED_WORDS) {
    if (lower.includes(w)) {
      score -= 1.5;
      indicators.push(w);
    }
  }
  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) {
      score += 1;
      indicators.push(w);
    }
  }

  const words = text.split(/\s+/).filter(Boolean);
  const capsWords = words.filter(
    (w) => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)
  );
  if (capsWords.length > 0) {
    score -= 0.75;
    indicators.push("all-caps");
  }
  if (/(!{2,}|\?{2,})/.test(text)) {
    score -= 0.5;
    indicators.push("strong punctuation");
  }

  const clamped = Math.max(-1, Math.min(1, score / 3));
  let label: SentimentLabel = "neutral";
  if (clamped <= -0.35) label = "negative";
  if (clamped >= 0.25) label = "positive";
  const frustrated =
    FRUSTRATED_WORDS.some((w) => lower.includes(w)) ||
    (capsWords.length > 0 && /(!{2,})/.test(text));
  if (frustrated && clamped <= -0.15) label = "frustrated";

  return { label, score: Math.round(clamped * 100) / 100, indicators: indicators.slice(0, 8) };
}

export function extractIntent(text: string): IntentResult {
  const lower = text.toLowerCase();
  let intent: IntentLabel = "report_incident";
  let confidence = 0.6;

  if (GREETING_WORDS.some((w) => lower.startsWith(w)) && text.length < 60) {
    intent = "greeting";
    confidence = 0.85;
  } else if (/thank|that worked|all good|resolved|fixed|sorted/i.test(lower)) {
    intent = "acknowledgement";
    confidence = 0.8;
  } else if (ESCALATION_WORDS.some((w) => lower.includes(w))) {
    intent = "escalation_request";
    confidence = 0.75;
  } else if (/complaint|unacceptable|terrible|worst|disappointed|refund|harass/i.test(lower)) {
    intent = "complaint";
    confidence = 0.8;
  } else if (/\?/.test(text) && /(how|what|where|when|why|can you|is it|does it)/.test(lower)) {
    intent = "question";
    confidence = 0.75;
  } else if (REQUEST_WORDS.some((w) => lower.includes(w)) || /(i'd like|i would like|kindly|submit)/.test(lower)) {
    intent = "request_fulfillment";
    confidence = 0.7;
  }

  let urgencyLevel: "low" | "medium" | "high" | "critical" = "medium";
  if (CRITICAL_URGENCY.some((w) => lower.includes(w))) urgencyLevel = "critical";
  else if (HIGH_URGENCY.some((w) => lower.includes(w))) urgencyLevel = "high";
  else if (LOW_URGENCY.some((w) => lower.includes(w))) urgencyLevel = "low";

  const escalationSignal =
    ESCALATION_WORDS.some((w) => lower.includes(w)) || urgencyLevel === "critical";
  const wantsHuman = HUMAN_WORDS.some((w) => lower.includes(w));

  return {
    intent,
    confidence: Math.round(confidence * 100) / 100,
    urgencyLevel,
    escalationSignal,
    wantsHuman,
  };
}

export function predictCsat(input: {
  sentimentScore?: number;
  firstResponseMinutes?: number | null;
  resolveMinutes?: number | null;
  reopenCount?: number;
  isMajor?: boolean;
}): CsatPrediction {
  let score = 4;
  const notes: string[] = [];

  if (typeof input.sentimentScore === "number") {
    score += input.sentimentScore * 1.25;
    if (input.sentimentScore < -0.3) notes.push("negative customer sentiment");
  }
  if (typeof input.firstResponseMinutes === "number") {
    if (input.firstResponseMinutes > 240) {
      score -= 0.6;
      notes.push("slow first response");
    } else if (input.firstResponseMinutes > 60) {
      score -= 0.3;
      notes.push("first response above 1h");
    } else if (input.firstResponseMinutes <= 15) {
      score += 0.25;
      notes.push("fast first response");
    }
  }
  if (typeof input.resolveMinutes === "number") {
    if (input.resolveMinutes > 1440) {
      score -= 0.8;
      notes.push("resolution over 24h");
    } else if (input.resolveMinutes > 480) {
      score -= 0.4;
      notes.push("resolution over 8h");
    } else if (input.resolveMinutes <= 240) {
      score += 0.3;
      notes.push("fast resolution");
    }
  }
  if (input.reopenCount && input.reopenCount > 0) {
    score -= 0.5 * Math.min(input.reopenCount, 3);
    notes.push("reopened ticket");
  }
  if (input.isMajor) {
    score -= 0.3;
    notes.push("major incident");
  }

  const predictedScore = Math.round(Math.max(1, Math.min(5, score)) * 10) / 10;
  const band = predictedScore >= 4.5 ? "promoter" : predictedScore >= 3.5 ? "neutral" : "at_risk";
  const note = notes.length > 0 ? notes.join(", ") : "no risk factors detected";
  return { predictedScore, band, note };
}

export function suggestAutoReply(text: string, analysis: AiAssistResult): string {
  const sentiment = detectSentiment(text);
  const intent = extractIntent(text);
  const parts: string[] = [];

  if (sentiment.label === "frustrated" || sentiment.label === "negative") {
    parts.push(
      "I am sorry you are having this experience. I understand this is frustrating and I will prioritize it for you."
    );
  } else if (sentiment.label === "positive") {
    parts.push("Thank you for reaching out - happy to help.");
  } else {
    parts.push("Thanks for contacting the service desk.");
  }

  if (intent.intent === "escalation_request" || intent.wantsHuman) {
    parts.push("I will connect you with a senior agent right away so a person can assist you.");
  } else if (intent.intent === "question" && analysis.knowledgeMatches.length > 0) {
    const top = analysis.knowledgeMatches[0];
    parts.push(
      `I found a guide that should answer this: "${top.title}". ${top.snippet.slice(0, 180)}`
    );
    parts.push("Did this resolve your question, or would you prefer an agent to help?");
  } else if (analysis.shouldCreateTicket) {
    parts.push(
      `I have created a ${analysis.suggestedServiceType.toUpperCase()} ticket classified as ${
        analysis.suggestedCategory
      }/${analysis.suggestedSubcategory || "other"} with ${analysis.suggestedPriority} priority. An agent will respond within the SLA window.`
    );
  } else if (analysis.knowledgeMatches.length > 0) {
    const top = analysis.knowledgeMatches[0];
    parts.push(
      `This looks like something you can fix yourself: "${top.title}". ${top.snippet.slice(0, 180)}`
    );
    parts.push("If it does not work, I will open a ticket for you.");
  } else {
    parts.push("Tell me a little more and I will route this to the right team for you.");
  }

  return parts.join(" ");
}