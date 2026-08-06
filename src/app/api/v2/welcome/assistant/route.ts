/**
 * Welcome Experience — AI Welcome Assistant endpoint.
 * POST { message } → contextual reply scoped to the caller's own tenant.
 * Conversation history is persisted in tenant_onboarding.assistant.
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  generateReply,
  appendAssistantMessage,
  quickActionSuggestions,
  welcomeIntro,
  type AssistantMessage,
} from "@/lib/platform/welcome/assistant";
import {
  getOrCreateWelcomeState,
  loadTenantSummary,
  persistWelcomeState,
} from "@/lib/platform/welcome/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().max(2000).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["dashboard.view", "settings.view", "settings.manage"],
    allowPlatformAdmin: true,
    module: "welcome-assistant",
    bodySchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx?.tenantId) {
      return apiError("FORBIDDEN", "No tenant context", 403);
    }

    const input = body as z.infer<typeof bodySchema>;
    const message = (input.message ?? "").trim();

    try {
      const sb = await createClient();
      let state = await getOrCreateWelcomeState(sb, {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actorId: ctx.profile?.id ?? null,
      });
      const summary = await loadTenantSummary(sb, ctx.tenantId, ctx.companyId);

      const aiCtx = { state, summary };

      if (!message) {
        const intro = welcomeIntro(aiCtx);
        const seeded = appendAssistantMessage(state, "__welcome__", intro, quickActionSuggestions());
        state = await persistWelcomeState(sb, seeded, ctx.profile?.id ?? null);
        return apiOk({
          reply: intro,
          suggestions: quickActionSuggestions(),
          messages: state.assistant.messages,
        });
      }

      const { text, suggestions } = generateReply(message, aiCtx);
      state = appendAssistantMessage(state, message, text, suggestions);
      state = await persistWelcomeState(sb, state, ctx.profile?.id ?? null);

      return apiOk({
        reply: text,
        suggestions,
        messages: state.assistant.messages as AssistantMessage[],
      });
    } catch (e) {
      return apiError("INTERNAL", e instanceof Error ? e.message : "Assistant failed", 500);
    }
  }
);


