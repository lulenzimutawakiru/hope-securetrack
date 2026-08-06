/**
 * Welcome Experience — AI Welcome Assistant engine.
 *
 * Deterministic, explainable, tenant-aware guidance. Every reply is scoped to
 * the caller's own tenant metadata (industry, plan, country, progress) so no
 * cross-tenant data is ever referenced. An optional real LLM upgrade can be
 * plugged into `generateReply` later without changing the API contract.
 */

import type { AssistantMessage, WelcomeState, TenantSummary } from "./types";

export type { AssistantMessage };
import { WELCOME_STEP_MAP, nextStepKey } from "./steps";
import { getIndustryPack, planDisplayName } from "./recommendations";

export type AssistantContext = {
  state: WelcomeState;
  summary: TenantSummary;
};

const QUICK_ACTIONS: Array<{ label: string; value: string }> = [
  { label: "What should I do first?", value: "what should I do first?" },
  { label: "Recommend modules", value: "which modules should I enable?" },
  { label: "Security checklist", value: "what security settings do I need?" },
  { label: "Import my data", value: "how do I import my existing data?" },
  { label: "Go live now", value: "how do I go live?" },
];

export function quickActionSuggestions(): string[] {
  return QUICK_ACTIONS.map((q) => q.label);
}

export function welcomeIntro(ctx: AssistantContext): string {
  const { summary, state } = ctx;
  const pack = getIndustryPack(summary.industry);
  const step = WELCOME_STEP_MAP[state.current_step];
  const firstName = summary.organization_name
    ? `${summary.organization_name}`
    : "your organization";

  return (
    `Welcome to SecureTrack ERP, ${firstName}! 🎉\n\n` +
    `I'm your AI welcome assistant. Your ${planDisplayName(summary.plan_code)} environment has been provisioned ` +
    `and I'll guide you through configuring it for the ${pack.label} industry. ` +
    `You're currently on the "${step.label}" step — I can explain what to do next, ` +
    `recommend modules, or answer questions about security, data import, and go-live. ` +
    `Everything I suggest is scoped to your tenant only.`
  );
}

function has(text: string, ...tokens: string[]): boolean {
  const t = text.toLowerCase();
  return tokens.some((tok) => t.includes(tok));
}

function nextStepHint(ctx: AssistantContext): string {
  const next = nextStepKey(ctx.state.current_step);
  const def = WELCOME_STEP_MAP[next];
  if (!def) return "";
  return `Next up: **${def.label}** — ${def.description}`;
}

function moduleReply(ctx: AssistantContext): string {
  const pack = getIndustryPack(ctx.summary.industry);
  const plan = planDisplayName(ctx.summary.plan_code);
  const mods = pack.modules
    .map((m) => `• ${m}`)
    .join("\n");
  return (
    `Based on your ${pack.label} profile and the ${plan} plan, I recommend these modules:\n\n` +
    `${mods}\n\n` +
    `Core modules (Finance, BI, Identity, Audit) are always enabled. You can adjust any ` +
    `selection in the **Business Modules** step — your choices are saved automatically.`
  );
}

function securityReply(_ctx: AssistantContext): string {
  return (
    `For a production-ready tenant I recommend:\n\n` +
    `• **MFA required for administrators** — blocks credential theft\n` +
    `• **Password policy** — 10+ chars, upper/lower/number/special, 90-day expiry\n` +
    `• **Session timeout** — 8 hours max for admin sessions\n` +
    `• **SSO / OIDC** — connect Microsoft 365 or Google Workspace when available\n` +
    `• **Segregation of duties** — keep finance approvals separate from posting\n\n` +
    `These defaults are already applied by the platform; the Security step lets you ` +
    `tighten them for your organisation.`
  );
}

function importReply(_ctx: AssistantContext): string {
  return (
    `The Data Import step supports Excel, CSV, JSON, XML, REST API and direct database ` +
    `sources, plus migration from SAP, Oracle, Dynamics, QuickBooks, Xero, Odoo, Sage, Tally and more.\n\n` +
    `Recommended order:\n` +
    `1. Chart of Accounts & opening balances\n` +
    `2. Customers & suppliers\n` +
    `3. Products & opening inventory\n` +
    `4. Employees & bank accounts\n\n` +
    `Templates are available in the Import Center to keep your file format clean.`
  );
}

function goLiveReply(ctx: AssistantContext): string {
  const pct = ctx.state.readiness?.overall ?? 0;
  return (
    `You're at **${pct}% readiness**. To go live:\n\n` +
    `• Complete the required steps (Organization, Structure, Security, Modules, Business Config)\n` +
    `• Confirm the Go-Live checklist (users, MFA, backups, fiscal year, taxes, email)\n` +
    `• Review the Success dashboard and launch your ERP\n\n` +
    `I can walk you through any specific checklist item — just ask.`
  );
}

function firstStepReply(ctx: AssistantContext): string {
  const pack = getIndustryPack(ctx.summary.industry);
  const step = WELCOME_STEP_MAP[ctx.state.current_step];
  return (
    `Start with **Organization** — verify your legal entity, industry (${pack.label}), ` +
    `country and branding. That unlocks every other recommendation.\n\n` +
    `You're on "${step.label}". ${nextStepHint(ctx)}`
  );
}

function progressReply(ctx: AssistantContext): string {
  const { state } = ctx;
  const done = Object.values(state.steps_progress).filter(
    (p) => p?.status === "completed" || p?.status === "skipped"
  ).length;
  const total = Object.keys(WELCOME_STEP_MAP).length;
  return (
    `You've completed ${done} of ${total} welcome steps. ` +
    `${nextStepHint(ctx)} Save-and-resume is automatic, so you can return any time.`
  );
}

export function generateReply(
  message: string,
  ctx: AssistantContext
): { text: string; suggestions: string[] } {
  const t = message.trim();
  if (!t) {
    return {
      text: "Ask me anything about setting up your SecureTrack ERP environment.",
      suggestions: quickActionSuggestions(),
    };
  }

  if (has(t, "hello", "hi ", "hey", "good morning", "good afternoon", "good evening", "how are you")) {
    return {
      text: `Hello! ${welcomeIntro(ctx).split("\n\n")[0] ?? ""} How can I help you configure your environment today?`,
      suggestions: quickActionSuggestions(),
    };
  }

  if (has(t, "first", "start", "begin", "where do i", "what should i do")) {
    return { text: firstStepReply(ctx), suggestions: ["Recommend modules", "Security checklist", "How do I go live?"] };
  }

  if (has(t, "module", "enable", "recommend", "industry pack", "what do i need")) {
    return { text: moduleReply(ctx), suggestions: ["Security checklist", "Import my data", "Go live now"] };
  }

  if (has(t, "secur", "mfa", "password", "sso", "audit", "risk", "isolation", "tenant")) {
    return { text: securityReply(ctx), suggestions: ["Recommend modules", "How do I go live?"] };
  }

  if (has(t, "import", "migrat", "excel", "csv", "quickbooks", "xero", "sage", "tally", "data")) {
    return { text: importReply(ctx), suggestions: ["What should I do first?", "Go live now"] };
  }

  if (has(t, "go live", "launch", "activate", "deploy", "production", "ready")) {
    return { text: goLiveReply(ctx), suggestions: ["What should I do first?", "Security checklist"] };
  }

  if (has(t, "progress", "complete", "percent", "status", "how far")) {
    return { text: progressReply(ctx), suggestions: quickActionSuggestions() };
  }

  if (has(t, "plan", "price", "cost", "billing", "upgrade", "limit", "seats", "trial")) {
    const plan = planDisplayName(ctx.summary.plan_code);
    return {
      text:
        `You're on the **${plan}** plan. Your current period ${ctx.summary.current_period_end ? `ends ${new Date(ctx.summary.current_period_end).toLocaleDateString()}` : "is active"}.\n\n` +
        `The Subscription step shows your limits (users, storage, API, AI credits) and any ` +
        `upgrade recommendations. You can request an upgrade from the dashboard Billing page at any time.`,
      suggestions: ["Recommend modules", "How do I go live?"],
    };
  }

  if (has(t, "thank", "thanks", "great", "awesome", "perfect")) {
    return {
      text: "You're welcome! I'm here for the whole journey — ask me about any step, module or checklist item.",
      suggestions: quickActionSuggestions(),
    };
  }

  if (has(t, "help", "what can you", "capabilities", "commands")) {
    return {
      text:
        `I can help you with:\n\n` +
        `• Step-by-step setup guidance\n` +
        `• Module recommendations for your industry\n` +
        `• Security, MFA and compliance best practice\n` +
        `• Data import and migration planning\n` +
        `• Go-live readiness and checklists\n\n` +
        `Try one of the quick questions below.`,
      suggestions: quickActionSuggestions(),
    };
  }

  const pack = getIndustryPack(ctx.summary.industry);
  const step = WELCOME_STEP_MAP[ctx.state.current_step];
  return {
    text:
      `Here's how I can help with that in your ${pack.label} environment:\n\n` +
      `• On **${step.label}**, ${step.description}\n` +
      `• All recommendations respect your plan (${planDisplayName(ctx.summary.plan_code)}) and tenant isolation.\n` +
      `• Every change you make is saved automatically and audited.\n\n` +
      `If you're unsure, start with the Organization step — it drives every other recommendation.`,
    suggestions: quickActionSuggestions(),
  };
}

export function appendAssistantMessage(
  state: WelcomeState,
  message: string,
  reply: string,
  suggestions: string[]
): WelcomeState {
  const now = new Date().toISOString();
  const messages = state.assistant.messages ?? [];
  const next: AssistantMessage[] = [
    ...messages.slice(-19),
    { id: `m-${Date.now()}`, role: "user", text: message, at: now },
    { id: `m-${Date.now() + 1}`, role: "assistant", text: reply, at: now, suggestions },
  ];
  return {
    ...state,
    assistant: {
      messages: next,
      last_topic: message,
    },
  };
}
