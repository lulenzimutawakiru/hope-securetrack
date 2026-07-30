/**
 * SecureTrack AI gateway — OpenAI-compatible LLM with deterministic rule fallback.
 * Tenant isolation: never send cross-tenant data; pass company_id in system context only.
 */

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionRequest = {
  messages: AiMessage[];
  /** Business domain for audit / routing */
  domain?: string;
  companyId?: string;
  temperature?: number;
  maxTokens?: number;
  /** When true, never call external LLM (rules only) */
  rulesOnly?: boolean;
};

export type AiCompletionResult = {
  content: string;
  source: "llm" | "rules";
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
};

export function getAiConfig(): AiConfig {
  const apiKey =
    process.env.SECURETRACK_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.XAI_API_KEY ||
    "";
  const baseUrl = (
    process.env.SECURETRACK_AI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.SECURETRACK_AI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";
  const forceOff = process.env.SECURETRACK_AI_DISABLED === "true";
  return {
    apiKey,
    baseUrl,
    model,
    enabled: Boolean(apiKey) && !forceOff,
  };
}

/** Deterministic rule assistant used when LLM is unavailable */
export function ruleBasedAssist(messages: AiMessage[], domain?: string): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const q = (lastUser?.content || "").toLowerCase();
  const d = (domain || "erp").toLowerCase();

  if (!q.trim()) {
    return "Ask a question about payroll, finance, inventory, or operations. SecureTrack AI is standing by.";
  }

  if (q.includes("payroll") || d === "payroll") {
    if (q.includes("process") || q.includes("run")) {
      return [
        "Payroll run checklist:",
        "1. Close attendance & leave for the period",
        "2. Validate overtime, allowances, loans, advances",
        "3. Run simulation → review variances",
        "4. Submit for dual-control approval",
        "5. Generate bank / mobile-money file",
        "6. Post GL and release payslips",
      ].join("\n");
    }
    if (q.includes("tax") || q.includes("paye") || q.includes("nssf")) {
      return "Statutory deductions (PAYE/NSSF) are calculated by country profile in payroll settings. Confirm employee tax country, TIN, and NSSF numbers before finalizing.";
    }
  }

  if (q.includes("invoice") || q.includes("ar") || d === "finance" || d === "billing") {
    return "AR guidance: issue invoice → send portal link → collect via gateway webhook → reconcile → age receivables. Never auto-settle payments in production without webhook confirmation.";
  }

  if (q.includes("procure") || q.includes("po") || q.includes("three-way")) {
    return "Procurement flow: Requisition → Budget check → Approval → RFQ → PO → Goods receipt → QC → Supplier invoice → Three-way match → Payment.";
  }

  if (q.includes("recruit") || q.includes("hire") || d === "talent" || d === "hr") {
    return "Talent flow: Job request → Approval → Vacancy → Application → Screening → Interview → Offer → Accept → Employee create → Onboarding → Payroll enroll.";
  }

  if (q.includes("forecast") || q.includes("predict")) {
    return "Forecasting: use module dashboards for trend KPIs; enable SECURETRACK_AI_API_KEY for LLM narrative forecasts over live aggregates (tenant-scoped).";
  }

  if (q.includes("fraud") || q.includes("risk")) {
    return "Risk signals: duplicate payments, mock GPS punches, after-hours bank file generation, dual-control bypass attempts, cross-company access denials. Review Audit → Alerts and Security → Dual control.";
  }

  return `SecureTrack rules assistant (${d}): I can guide workflows for finance, payroll, procurement, talent, manufacturing, and inventory. Configure SECURETRACK_AI_API_KEY for full natural-language copilot. Your question: "${lastUser?.content?.slice(0, 200)}"`;
}

/**
 * Complete a chat turn. Falls back to rules if LLM is disabled or fails.
 */
export async function aiComplete(
  req: AiCompletionRequest
): Promise<AiCompletionResult> {
  const cfg = getAiConfig();
  const systemGuard: AiMessage = {
    role: "system",
    content: [
      "You are SecureTrack AI, an enterprise ERP copilot.",
      "Be concise, actionable, and never invent financial figures not provided.",
      "Respect multi-tenant isolation: do not request or assume other tenants' data.",
      req.companyId ? `Active company context id: ${req.companyId}` : "",
      req.domain ? `Domain: ${req.domain}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };

  if (req.rulesOnly || !cfg.enabled) {
    return {
      content: ruleBasedAssist([systemGuard, ...req.messages], req.domain),
      source: "rules",
    };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens ?? 800,
        messages: [systemGuard, ...req.messages],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[ai] LLM error", res.status, errText.slice(0, 200));
      return {
        content: ruleBasedAssist(req.messages, req.domain),
        source: "rules",
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        content: ruleBasedAssist(req.messages, req.domain),
        source: "rules",
      };
    }
    return {
      content,
      source: "llm",
      model: json.model || cfg.model,
      usage: json.usage,
    };
  } catch (e) {
    console.error("[ai] LLM exception", e);
    return {
      content: ruleBasedAssist(req.messages, req.domain),
      source: "rules",
    };
  }
}

/** Summarize a structured business report for executives */
export async function aiSummarizeReport(input: {
  title: string;
  bullets: string[];
  domain?: string;
  companyId?: string;
}): Promise<AiCompletionResult> {
  return aiComplete({
    domain: input.domain || "reporting",
    companyId: input.companyId,
    messages: [
      {
        role: "user",
        content: `Summarize this ERP report for executives in 5 bullets and one recommended action.\nTitle: ${input.title}\nFacts:\n- ${input.bullets.join("\n- ")}`,
      },
    ],
    maxTokens: 500,
  });
}
