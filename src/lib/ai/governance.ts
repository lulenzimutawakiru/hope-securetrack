/**
 * SecureTrack AI governance — tenant isolation, redaction, human approval gates.
 */

import type { TenantScope } from "@/lib/tenant/context";
import { redactCrossTenantFields } from "@/lib/tenant/context";
import { log } from "@/lib/observability/logger";

/** Actions AI must NEVER execute without dual-control / human confirmation */
export const AI_RESTRICTED_ACTIONS = new Set([
  "payroll.release",
  "payroll.bank_file",
  "finance.gl_post",
  "finance.period_close",
  "identity.provision",
  "identity.reset_password",
  "billing.payment_void",
  "platform.provision_tenant",
  "money.transfer",
  "user.delete",
]);

export function isAiRestrictedAction(action: string): boolean {
  return AI_RESTRICTED_ACTIONS.has(action);
}

export type AiGovernanceDecision =
  | { allowed: true; mode: "advise" | "execute" }
  | { allowed: false; reason: string; requiresHumanApproval: boolean };

/**
 * Gate AI tool execution. Default is advise-only for restricted domains.
 */
export function governAiAction(input: {
  action: string;
  humanApproved?: boolean;
  dualControlId?: string | null;
  flags?: Record<string, boolean>;
}): AiGovernanceDecision {
  if (input.flags && input.flags["ai.copilot"] === false) {
    return {
      allowed: false,
      reason: "AI copilot disabled for this tenant",
      requiresHumanApproval: false,
    };
  }

  if (isAiRestrictedAction(input.action)) {
    if (input.humanApproved && input.dualControlId) {
      return { allowed: true, mode: "execute" };
    }
    return {
      allowed: false,
      reason:
        "This action requires human approval and dual-control. AI may only advise.",
      requiresHumanApproval: true,
    };
  }

  return { allowed: true, mode: "advise" };
}

/** Redact secrets and enforce company scope before AI context assembly */
export function buildTenantSafeAiContext(
  scope: TenantScope,
  rows: Array<Record<string, unknown>>,
  maxRows = 50
): Array<Record<string, unknown>> {
  return rows.slice(0, maxRows).map((r) => {
    try {
      // Dual-key: reject other tenant AND other company
      if (
        r.tenant_id != null &&
        scope.tenantId &&
        String(r.tenant_id) !== String(scope.tenantId)
      ) {
        return { error: "redacted_cross_tenant" };
      }
      return redactCrossTenantFields(r, scope);
    } catch {
      return { error: "redacted_cross_tenant" };
    }
  });
}

export function auditAiPrompt(input: {
  companyId: string;
  tenantId?: string | null;
  userId?: string | null;
  domain?: string;
  promptHash: string;
  source: "llm" | "rules";
  correlationId?: string;
}) {
  log.info("ai.prompt", {
    module: "ai",
    action: "prompt",
    companyId: input.companyId,
    tenantId: input.tenantId,
    userId: input.userId,
    domain: input.domain,
    promptHash: input.promptHash,
    source: input.source,
    correlationId: input.correlationId,
  });
}

/** Simple non-crypto hash for prompt audit (not for security) */
export async function hashPrompt(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.slice(0, 8000));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
