import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { aiComplete } from "@/lib/ai/gateway";
import {
  auditAiPrompt,
  governAiAction,
  hashPrompt,
  isAiRestrictedAction,
} from "@/lib/ai/governance";
import { resolveFeatureFlags, isFlagEnabled } from "@/lib/platform/flags";
import { createClient } from "@/lib/supabase/server";
import { scopeFromAuth } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  message: z.string().min(1).max(4000),
  domain: z.string().max(40).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(12)
    .optional(),
  rulesOnly: z.boolean().optional(),
  /** Proposed action AI wants to execute (always gated) */
  proposed_action: z.string().max(80).optional(),
  human_approved: z.boolean().optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/**
 * Authenticated AI copilot — tenant-scoped, feature-flagged, governed.
 */
export const POST = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    module: "ai",
    rateLimit: { limit: 30, windowMs: 60_000 },
    bodySchema: schema,
  },
  async ({ ctx, body, correlationId }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const sb = await createClient();
    const flags = await resolveFeatureFlags(sb, ctx.profile.tenant_id);
    if (!isFlagEnabled(flags, "ai.copilot", true)) {
      return apiError("FORBIDDEN", "AI copilot disabled for this tenant", 403);
    }

    if (body.proposed_action) {
      const decision = governAiAction({
        action: body.proposed_action,
        humanApproved: body.human_approved,
        dualControlId: body.dual_control_id,
        flags,
      });
      if (!decision.allowed) {
        return apiOk({
          reply: decision.reason,
          source: "rules" as const,
          model: null,
          company_id: ctx.companyId,
          blocked: true,
          requires_human_approval: decision.requiresHumanApproval,
          restricted: isAiRestrictedAction(body.proposed_action),
        });
      }
    }

    // Soft guard: if user message asks to release payroll / reset password, refuse execute
    const lower = body.message.toLowerCase();
    const sensitiveAsk =
      /release\s+payroll|wire\s+transfer|reset\s+password|delete\s+all|drop\s+table/.test(
        lower
      );
    const systemNote = sensitiveAsk
      ? " Refuse to execute financial or identity changes; provide advisory steps only and require dual-control."
      : "";

    const messages = [
      ...(body.history || []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      {
        role: "user" as const,
        content: body.message + systemNote,
      },
    ];

    const result = await aiComplete({
      messages,
      domain: body.domain,
      companyId: ctx.companyId,
      rulesOnly: body.rulesOnly,
    });

    const promptHash = await hashPrompt(body.message);
    auditAiPrompt({
      companyId: ctx.companyId,
      tenantId: ctx.profile.tenant_id,
      userId: ctx.user.id,
      domain: body.domain,
      promptHash,
      source: result.source,
      correlationId,
    });

    // Ensure scope object is used (tenant isolation marker for future context packs)
    const scope = scopeFromAuth(ctx);
    void scope;

    return apiOk({
      reply: result.content,
      source: result.source,
      model: result.model || null,
      company_id: ctx.companyId,
      tenant_id: ctx.profile.tenant_id || null,
      blocked: false,
      governance: "advise_default",
    });
  }
);


