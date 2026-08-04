/**
 * SecureChat enterprise layer
 *
 * In-chat approval cards, tenant-aware AI copilot, communication analytics
 * and permission-scoped enterprise search. Pure helpers are deterministic
 * and never fabricate tenant data; database functions go through the
 * session-scoped Supabase client so RLS keeps every read/write inside the
 * caller's company + tenant.
 */

/**
 * SecureChat enterprise helpers — browser Supabase client (session RLS).
 * See service.ts for why chat is not routed through crud-compat.
 */
import { createClient } from "@/lib/supabase/client";
import { logHcAudit } from "./service";

export const APPROVAL_TYPES = [
  { value: "purchase_order", label: "Purchase Order" },
  { value: "payment", label: "Payment" },
  { value: "leave", label: "Leave" },
  { value: "recruitment", label: "Recruitment" },
  { value: "payroll", label: "Payroll" },
  { value: "expense", label: "Expense" },
  { value: "asset_transfer", label: "Asset Transfer" },
  { value: "contract", label: "Contract" },
  { value: "service_request", label: "Service Request" },
  { value: "other", label: "Other" },
] as const;

export const COPILOT_DOMAINS = [
  { value: "hr", label: "HR Assistant" },
  { value: "finance", label: "Finance Assistant" },
  { value: "it", label: "IT Assistant" },
  { value: "assets", label: "Asset Assistant" },
  { value: "management", label: "Management Assistant" },
  { value: "approval", label: "Approval Assistant" },
  { value: "general", label: "SecureTrackAI" },
] as const;

export type ApprovalDecision =
  | "approved"
  | "rejected"
  | "changes_requested"
  | "cancelled";

export interface ApprovalIntent {
  type: string;
  label: string;
  confidence: number;
}

const APPROVAL_KEYWORDS: Array<{ keys: string[]; type: string; label: string }> = [
  { keys: ["purchase order", "procurement order", "purchase requisition", " po "], type: "purchase_order", label: "Purchase Order" },
  { keys: ["payment", "pay supplier", "vendor payment", "pay invoice", "pay bill", "payment approval"], type: "payment", label: "Payment" },
  { keys: ["leave", "vacation", "time off", "annual leave", "sick leave"], type: "leave", label: "Leave" },
  { keys: ["recruitment", "hiring", "job offer", "candidate", "job posting"], type: "recruitment", label: "Recruitment" },
  { keys: ["payroll", "salary", "wages", "pay run"], type: "payroll", label: "Payroll" },
  { keys: ["expense", "reimbursement", "travel claim", "per diem"], type: "expense", label: "Expense" },
  { keys: ["asset transfer", "handover", "device reassign", "asset assignment", "laptop handover"], type: "asset_transfer", label: "Asset Transfer" },
  { keys: ["contract", "agreement", "renewal", "sign-off", "vendor contract"], type: "contract", label: "Contract" },
  { keys: ["service request", "service desk", "laptop request", "access request", "software install"], type: "service_request", label: "Service Request" },
];

export function extractApprovalType(text: string): ApprovalIntent {
  const lower = text.toLowerCase();
  let best: { type: string; label: string; hits: number } | null = null;
  for (const k of APPROVAL_KEYWORDS) {
    const hits = k.keys.filter((key) => lower.includes(key)).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { type: k.type, label: k.label, hits };
    }
  }
  if (!best) {
    return { type: "other", label: "Other", confidence: 0.2 };
  }
  return { type: best.type, label: best.label, confidence: Math.min(1, 0.35 + best.hits * 0.25) };
}

export interface CopilotAction {
  label: string;
  href?: string;
}

export interface CopilotResult {
  answer: string;
  intent: string;
  permissionGranted: boolean;
  permissionReason: string;
  actions: CopilotAction[];
}

/** Permission slugs required per assistant domain (any match grants access). */
const DOMAIN_PERMISSIONS: Record<string, string[]> = {
  hr: ["hr.view", "hr.self"],
  finance: ["finance.view"],
  it: ["sd.view", "sd.agent", "hc.view"],
  assets: ["ast.view"],
  management: ["bi.view", "ppm.view", "finance.view"],
  approval: ["finance.approve", "procurement.approve", "hr.leave.approved", "hc.manage", "ast.assign"],
  general: [],
};

const DOMAIN_HOME: Record<string, string> = {
  hr: "/dashboard/hr",
  finance: "/dashboard/finance",
  it: "/dashboard/service-desk",
  assets: "/dashboard/assets",
  management: "/dashboard/reports",
  approval: "/dashboard/chat/approvals",
  general: "/dashboard/chat",
};

function detectIntent(prompt: string, domain: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("leave") || lower.includes("balance") || lower.includes("payslip") || lower.includes("policy") || lower.includes("benefit")) {
    return "self_service";
  }
  if (lower.includes("invoice") || lower.includes("payment") || lower.includes("budget") || lower.includes("expense") || lower.includes("vendor")) {
    return "financial";
  }
  if (lower.includes("troubleshoot") || lower.includes("password") || lower.includes("ticket") || lower.includes("network") || lower.includes("printer")) {
    return "technical_support";
  }
  if (lower.includes("asset") || lower.includes("warranty") || lower.includes("device") || lower.includes("serial")) {
    return "asset";
  }
  if (lower.includes("approve") || lower.includes("approval") || lower.includes("pending") || lower.includes("review")) {
    return "approval";
  }
  if (lower.includes("summary") || lower.includes("kpi") || lower.includes("trend") || lower.includes("report") || lower.includes("insight")) {
    return "executive";
  }
  return domain === "general" ? "general_inquiry" : `${domain}_inquiry`;
}

/**
 * Deterministic, permission-gated copilot answer. Never fabricates tenant
 * data: when a query needs live records the answer directs the user to the
 * owning module (which applies the same RLS + permission filters).
 */
export function copilotAnswer(
  prompt: string,
  domain: string,
  permissions: string[] = []
): CopilotResult {
  const normalized = domain || "general";
  const required = DOMAIN_PERMISSIONS[normalized] || [];
  const granted = required.length === 0 || required.some((p) => permissions.includes(p));
  const intent = detectIntent(prompt, normalized);
  const home = DOMAIN_HOME[normalized] || "/dashboard/chat";
  const domainLabel =
    COPILOT_DOMAINS.find((d) => d.value === normalized)?.label || "SecureTrackAI";

  if (!granted) {
    return {
      answer:
        `I can assist with ${domainLabel} topics, but your role does not include the ` +
        `required permission (${required.join(" or ")}). I have not retrieved any data. ` +
        `Ask an administrator to grant access, or raise a Service Desk access request.`,
      intent,
      permissionGranted: false,
      permissionReason: `Missing permission ${required.join(" or ")}`,
      actions: [
        { label: "Raise access request", href: "/dashboard/service-desk" },
      ],
    };
  }

  const guides: Record<string, string> = {
    self_service:
      `Open ${domainLabel} self-service to view your personal records (leave balance, payslips, requests). ` +
      `Everything is permission-filtered to your own profile; I cannot display another person's data.`,
    financial:
      `Financial records are visible under the Finance module. Review invoices, payments and budgets there ` +
      `with your granted permissions. For approval decisions, open the SecureChat Approval Center.`,
    technical_support:
      `For technical support, open the Service Desk or use the chat bot with /it. Share the device or ` +
      `system name so an agent can investigate; I can draft a ticket for you.`,
    asset:
      `Asset details live in the Assets module. Search by asset tag or serial number there. ` +
      `Warranty, owner and maintenance history are permission-filtered.`,
    approval:
      `Open the SecureChat Approval Center to review pending requests. Approvals require the matching ` +
      `approval permission and every decision is written to the audit log.`,
    executive:
      `Executive summaries and KPIs are available in Reports and the Executive Communication Center. ` +
      `Aggregates are tenant-scoped and role-filtered.`,
    general_inquiry:
      `SecureTrackAI can summarize conversations, draft replies, create tasks, route requests and ` +
      `search knowledge. Try /hr, /finance, /it or ask about a specific module.`,
  };

  const domainGuide =
    guides[intent] ||
    guides.general_inquiry ||
    `Open the ${domainLabel} module for details. All data is permission-filtered.`;

  const answer =
    `${domainLabel}: ${domainGuide} ` +
    `I answered this as a guidance copilot - no live tenant records were exposed in this reply.`;

  const actions: CopilotAction[] = [{ label: `Open ${domainLabel}`, href: home }];
  if (intent === "approval") {
    actions.push({ label: "Approval Center", href: "/dashboard/chat/approvals" });
  }
  if (intent === "technical_support") {
    actions.push({ label: "Service Desk", href: "/dashboard/service-desk" });
  }

  return {
    answer,
    intent,
    permissionGranted: true,
    permissionReason: required.length ? `Granted via ${required.filter((p) => permissions.includes(p)).join(", ")}` : "No permission required",
    actions,
  };
}

export async function runCopilot(input: {
  company_id: string;
  tenant_id?: string | null;
  user_id?: string | null;
  agent_domain: string;
  user_message: string;
  permissions?: string[];
}) {
  const result = copilotAnswer(input.user_message, input.agent_domain, input.permissions || []);
  const { data, error } = await createClient()
    .from("hc_copilot_sessions")
    .insert({
      company_id: input.company_id,
      tenant_id: input.tenant_id || null,
      agent_domain: input.agent_domain,
      user_message: input.user_message,
      intent: result.intent,
      permission_granted: result.permissionGranted,
      permission_reason: result.permissionReason,
      answer: result.answer,
      actions: result.actions,
      created_by: input.user_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { session: data, result };
}

export async function listCopilotSessions(companyId: string) {
  const { data, error } = await createClient()
    .from("hc_copilot_sessions")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export interface ApprovalCreateInput {
  company_id: string;
  tenant_id?: string | null;
  channel_id?: string | null;
  entity_type?: string;
  entity_id?: string | null;
  entity_label?: string | null;
  title: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  approver_id?: string | null;
  approver_name?: string | null;
  priority?: string | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  post_to_channel?: boolean;
}

export async function createApproval(input: ApprovalCreateInput) {
  const sb = createClient();
  const detected = extractApprovalType(`${input.title} ${input.description || ""}`);
  const entityType = input.entity_type || detected.type;
  const { data, error } = await sb
    .from("hc_approvals")
    .insert({
      company_id: input.company_id,
      tenant_id: input.tenant_id || null,
      channel_id: input.channel_id || null,
      entity_type: entityType,
      entity_id: input.entity_id || null,
      entity_label: input.entity_label || null,
      title: input.title,
      description: input.description || null,
      amount: input.amount ?? null,
      currency: input.currency || "UGX",
      requester_id: input.requester_id || null,
      requester_name: input.requester_name || null,
      approver_id: input.approver_id || null,
      approver_name: input.approver_name || null,
      status: "pending",
      priority: input.priority || "normal",
      metadata: input.metadata || {},
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await logHcAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "approval.created",
    entity_type: "hc_approvals",
    entity_id: data.id,
    details: `${entityType} approval "${input.title}" created`,
  });

  // Best-effort: post a visible system card into the linked channel.
  if (input.post_to_channel && input.channel_id) {
    try {
      await sb.from("hc_messages").insert({
        company_id: input.company_id,
        channel_id: input.channel_id,
        sender_name: "Approval Bot",
        message_type: "system",
        body: `[APPROVAL] ${input.title} is awaiting a decision. Open SecureChat > Approval Center to review.`,
        metadata: { approval_id: data.id, entity_type: entityType },
      });
    } catch {
      /* channel post is optional (membership required) */
    }
  }

  // Notify the approver that a request is waiting.
  if (input.approver_id) {
    try {
      await sb.from("notifications").insert({
        company_id: input.company_id,
        user_id: input.approver_id,
        type: "info",
        category: "approval",
        priority: "high",
        title: "Approval pending",
        message: `${input.title} is waiting for your decision.`,
        source_module: "chat",
        source_event: "approval.pending",
        entity_type: "hc_approvals",
        entity_id: data.id,
        link: "/dashboard/chat/approvals",
        action_label: "Review",
        action_url: "/dashboard/chat/approvals",
        is_read: false,
        created_by: input.created_by || null,
      });
    } catch {
      /* optional */
    }
  }

  return data;
}

export async function listApprovals(companyId: string, status?: string) {
  let q = createClient()
    .from("hc_approvals")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (status && status !== "all") {
    q = q.eq("status", status);
  }
  const { data, error } = await q.limit(300);
  if (error) throw error;
  return data || [];
}

export async function decideApproval(input: {
  approval_id: string;
  company_id: string;
  decision: ApprovalDecision;
  comment?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
}) {
  const sb = createClient();
  const { data: existing } = await sb
    .from("hc_approvals")
    .select("*")
    .eq("id", input.approval_id)
    .maybeSingle();
  if (!existing) throw new Error("Approval not found");
  if (existing.status !== "pending") {
    throw new Error(`Approval already ${existing.status}`);
  }

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("hc_approvals")
    .update({
      status: input.decision,
      decision_comment: input.comment || null,
      decided_at: now,
      decided_by: input.actor_id || null,
      updated_by: input.actor_id || null,
      updated_at: now,
    })
    .eq("id", input.approval_id)
    .select("*")
    .single();
  if (error) throw error;

  await logHcAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: `approval.${input.decision}`,
    entity_type: "hc_approvals",
    entity_id: input.approval_id,
    details: `Approval "${existing.title}" ${input.decision}${input.comment ? ` - ${input.comment}` : ""}`,
  });

  if (existing.requester_id) {
    try {
      await sb.from("notifications").insert({
        company_id: input.company_id,
        user_id: existing.requester_id,
        type: "info",
        category: "approval",
        priority: input.decision === "approved" ? "normal" : "high",
        title: `Approval ${input.decision.replace("_", " ")}`,
        message: `"${existing.title}" was ${input.decision.replace("_", " ")}${input.actor_name ? ` by ${input.actor_name}` : ""}.`,
        source_module: "chat",
        source_event: `approval.${input.decision}`,
        entity_type: "hc_approvals",
        entity_id: input.approval_id,
        link: "/dashboard/chat/approvals",
        is_read: false,
        created_by: input.actor_id || null,
      });
    } catch {
      /* optional */
    }
  }

  return data;
}

export interface CommunicationAnalytics {
  activeConversations: number;
  totalMessages: number;
  totalChannels: number;
  participants: number;
  engagementIndex: number;
  avgResponseMinutes: number | null;
  approvalCompletionRate: number | null;
  pendingApprovals: number;
  sentimentMix: Record<string, number>;
  departmentActivity: Array<{ name: string; messages: number; channels: number }>;
  aiInsights: Array<{ id: string; severity: string; title: string; description: string; action?: string }>;
}

const SENTIMENT_LEXICON: Record<string, string[]> = {
  positive: ["thanks", "thank you", "great", "awesome", "excellent", "love", "perfect", "helpful", "resolved", "well done", "good work"],
  negative: ["angry", "frustrated", "annoyed", "terrible", "awful", "wrong", "failed", "broken", "disappointed", "unhappy", "complaint"],
  frustrated: ["urgent", "asap", "immediately", "sla", "breach", "escalate", "unacceptable", "still not", "again", "no response", "ignored"],
};

function classifySentiment(text: string): string {
  const lower = text.toLowerCase();
  let best: { key: string; hits: number } | null = null;
  for (const [key, words] of Object.entries(SENTIMENT_LEXICON)) {
    const hits = words.filter((w) => lower.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { key, hits };
  }
  return best ? best.key : "neutral";
}

export function communicationAnalytics(input: {
  messages?: Array<Record<string, unknown>>;
  channels?: Array<Record<string, unknown>>;
  approvals?: Array<Record<string, unknown>>;
}): CommunicationAnalytics {
  const messages = input.messages || [];
  const channels = input.channels || [];
  const approvals = input.approvals || [];

  const totalChannels = channels.length;
  const activeConversations = new Set(
    messages.map((m) => String(m.channel_id || "")).filter(Boolean)
  ).size;
  const participants = new Set(
    messages.map((m) => String(m.sender_id || m.sender_name || "")).filter(Boolean)
  ).size;
  const totalMessages = messages.length;

  const sentimentMix: Record<string, number> = { positive: 0, neutral: 0, negative: 0, frustrated: 0 };
  for (const m of messages) {
    const key = classifySentiment(String(m.body || ""));
    sentimentMix[key] = (sentimentMix[key] || 0) + 1;
  }

  // Approximate average response gap between consecutive speakers.
  const sorted = [...messages].sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || ""))
  );
  let gaps = 0;
  let gapCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevSender = String(sorted[i - 1].sender_id || sorted[i - 1].sender_name || "");
    const curSender = String(sorted[i].sender_id || sorted[i].sender_name || "");
    if (prevSender && curSender && prevSender !== curSender) {
      const diffMs =
        new Date(String(sorted[i].created_at || "")).getTime() -
        new Date(String(sorted[i - 1].created_at || "")).getTime();
      if (Number.isFinite(diffMs) && diffMs > 0 && diffMs < 1000 * 60 * 60 * 24) {
        gaps += diffMs / 60000;
        gapCount++;
      }
    }
  }
  const avgResponseMinutes = gapCount ? Math.round(gaps / gapCount) : null;

  const pendingApprovals = approvals.filter((a) => String(a.status || "") === "pending").length;
  const decided = approvals.filter((a) => ["approved", "rejected", "changes_requested", "cancelled"].includes(String(a.status || "")));
  const approvalCompletionRate = approvals.length ? decided.length / approvals.length : null;

  const deptMap = new Map<string, { messages: number; channels: Set<string> }>();
  for (const m of messages) {
    const dept = String(m.department_code || "");
    if (!dept) continue;
    const entry = deptMap.get(dept) || { messages: 0, channels: new Set<string>() };
    entry.messages++;
    entry.channels.add(String(m.channel_id || ""));
    deptMap.set(dept, entry);
  }
  for (const c of channels) {
    const dept = String(c.department_code || "");
    if (!dept) continue;
    const entry = deptMap.get(dept) || { messages: 0, channels: new Set<string>() };
    entry.channels.add(String(c.id || ""));
    deptMap.set(dept, entry);
  }
  const departmentActivity = Array.from(deptMap.entries())
    .map(([name, v]) => ({ name, messages: v.messages, channels: v.channels.size }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10);

  // Engagement index 0-100 (channel activity + breadth + recency proxy).
  const msgScore = Math.min(50, (totalMessages / Math.max(1, totalChannels)) * 4);
  const breadthScore = Math.min(25, (activeConversations / Math.max(1, totalChannels)) * 25);
  const recency = messages
    .map((m) => new Date(String(m.created_at || "")).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];
  const recencyScore = recency ? Math.max(0, 25 - (Date.now() - recency) / (1000 * 60 * 60 * 24)) : 0;
  const engagementIndex = Math.round(Math.min(100, msgScore + breadthScore + recencyScore));

  const insights: CommunicationAnalytics["aiInsights"] = [];
  if (pendingApprovals > 0) {
    insights.push({
      id: "approvals-pending",
      severity: pendingApprovals >= 5 ? "warning" : "info",
      title: `${pendingApprovals} approval(s) pending`,
      description: "Review the Approval Center to prevent workflow delays.",
      action: "/dashboard/chat/approvals",
    });
  }
  if (approvalCompletionRate !== null && approvalCompletionRate < 0.5 && approvals.length >= 3) {
    insights.push({
      id: "approval-throughput",
      severity: "warning",
      title: "Approval backlog risk",
      description: `Only ${Math.round(approvalCompletionRate * 100)}% of tracked approvals have a decision.`,
      action: "/dashboard/chat/approvals",
    });
  }
  if (totalMessages > 0 && (sentimentMix.negative + sentimentMix.frustrated) / totalMessages > 0.3) {
    insights.push({
      id: "sentiment-risk",
      severity: "warning",
      title: "Rising negative sentiment",
      description: "High share of negative/frustrated messages. Review open service conversations.",
      action: "/dashboard/chat/analytics",
    });
  }
  if (avgResponseMinutes !== null && avgResponseMinutes > 240) {
    insights.push({
      id: "response-lag",
      severity: "warning",
      title: "Slow conversation response times",
      description: `Average reply gap is ~${avgResponseMinutes} minutes. Consider routing or agent coverage.`,
    });
  }
  const topDept = departmentActivity[0];
  if (topDept && topDept.messages >= 50) {
    insights.push({
      id: "dept-heat",
      severity: "info",
      title: `${topDept.name} leads activity`,
      description: `${topDept.messages} messages across ${topDept.channels} channel(s).`,
    });
  }
  if (!insights.length) {
    insights.push({
      id: "healthy",
      severity: "success",
      title: "Communication health is stable",
      description: "No approval backlog or sentiment risks detected in the current window.",
    });
  }

  return {
    activeConversations,
    totalMessages,
    totalChannels,
    participants,
    engagementIndex,
    avgResponseMinutes,
    approvalCompletionRate,
    pendingApprovals,
    sentimentMix,
    departmentActivity,
    aiInsights: insights,
  };
}

export interface SearchHit {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  meta?: string;
  score: number;
}

function scoreText(haystack: string, tokens: string[]): number {
  const hay = haystack.toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return tokens.length ? hits / tokens.length : 0;
}

/** Permission-scoped local search over already-loaded, RLS-filtered data. */
export function searchChat(input: {
  query: string;
  channels?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  files?: Array<Record<string, unknown>>;
  approvals?: Array<Record<string, unknown>>;
  limit?: number;
}): SearchHit[] {
  const q = (input.query || "").trim();
  if (!q) return [];
  const tokens = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!tokens.length) return [];
  const hits: SearchHit[] = [];

  for (const m of input.messages || []) {
    const body = String(m.body || "");
    const sender = String(m.sender_name || "");
    const score = scoreText(`${body} ${sender}`, tokens);
    if (score > 0) {
      hits.push({
        id: String(m.id || ""),
        group: "messages",
        title: sender || "Message",
        subtitle: body.slice(0, 160) || "(no text)",
        meta: String(m.message_type || "text"),
        score,
      });
    }
  }

  for (const c of input.channels || []) {
    const name = String(c.name || "");
    const score = scoreText(`${name} ${String(c.description || "")} ${String(c.department_code || "")}`, tokens);
    if (score > 0) {
      hits.push({
        id: String(c.id || ""),
        group: "channels",
        title: name,
        subtitle: String(c.description || ""),
        meta: `#${String(c.slug || name.toLowerCase().replace(/\s+/g, "-"))}`,
        score,
      });
    }
  }

  for (const f of input.files || []) {
    const name = String(f.file_name || "");
    const score = scoreText(name, tokens);
    if (score > 0) {
      hits.push({
        id: String(f.id || ""),
        group: "files",
        title: name,
        subtitle: String(f.file_type || "File"),
        meta: f.file_size_bytes ? `${Number(f.file_size_bytes) > 1048576 ? `${Math.round(Number(f.file_size_bytes) / 1048576)} MB` : `${Math.round(Number(f.file_size_bytes) / 1024)} KB`}` : undefined,
        score,
      });
    }
  }

  for (const a of input.approvals || []) {
    const title = String(a.title || "");
    const hay = `${title} ${String(a.description || "")} ${String(a.entity_label || "")} ${String(a.requester_name || "")} ${String(a.approver_name || "")}`;
    const score = scoreText(hay, tokens);
    if (score > 0) {
      hits.push({
        id: String(a.id || ""),
        group: "approvals",
        title: title,
        subtitle: String(a.description || "").slice(0, 160),
        meta: `${String(a.entity_type || "")} / ${String(a.status || "")}`,
        score,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, input.limit || 50);
}