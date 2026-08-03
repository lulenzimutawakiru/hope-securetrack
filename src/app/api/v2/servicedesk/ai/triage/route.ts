/**
 * API-first Service Desk AI triage.
 *
 *   POST /api/v2/servicedesk/ai/triage
 *     body: { text: string, create_ticket?: boolean }
 *
 * Uses tenant-scoped knowledge + open tickets. Optional create_ticket
 * issues a real ticket via the server create path (atomic numbering).
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  createTicketServer,
  triageForCompany,
} from "@/lib/service-desk/server";
import { aiComplete } from "@/lib/ai/gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  text: z.string().min(1).max(20_000),
  subject: z.string().max(500).optional(),
  create_ticket: z.boolean().optional().default(false),
  channel: z.string().max(40).optional(),
  /** When true, enrich suggested_reply via LLM gateway if configured. */
  use_llm: z.boolean().optional().default(false),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["sd.ai", "sd.agent", "sd.manage", "sd.portal"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 40, windowMs: 60_000 },
    module: "servicedesk",
    bodySchema: schema,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();

    const { analysis, duplicates } = await triageForCompany(
      supabase,
      ctx.companyId,
      body.text
    );

    let llmReply: string | null = null;
    if (body.use_llm) {
      try {
        const result = await aiComplete({
          domain: "service_desk",
          companyId: ctx.companyId,
          messages: [
            {
              role: "system",
              content:
                "You are SecureTrack Service Desk AI. Suggest a short, professional first-response for the agent. Do not invent ticket numbers. Keep under 120 words.",
            },
            {
              role: "user",
              content: `Category: ${analysis.suggestedCategory}\nPriority: ${analysis.suggestedPriority}\nRequest:\n${body.text}`,
            },
          ],
          maxTokens: 250,
          temperature: 0.3,
        });
        llmReply = result.content;
      } catch {
        llmReply = null;
      }
    }

    let ticket: { id: string; ticket_number: string } | null = null;
    if (body.create_ticket && !analysis.isMajor) {
      try {
        const created = await createTicketServer(supabase, {
          company_id: ctx.companyId,
          created_by: ctx.user.id,
          actor_name: ctx.user.email || "AI triage",
          ticket: {
            subject: body.subject || body.text.slice(0, 120),
            description: body.text,
            category: analysis.suggestedCategory,
            subcategory: analysis.suggestedSubcategory || undefined,
            service_type: analysis.suggestedServiceType,
            priority: analysis.suggestedPriority as
              | "critical"
              | "high"
              | "medium"
              | "low",
            impact: analysis.suggestedImpact,
            urgency: analysis.suggestedUrgency,
            channel: body.channel || "ai",
            is_major: analysis.isMajor,
          },
        });
        ticket = { id: created.id, ticket_number: created.ticket_number };

        // Persist AI session for deflection analytics when table exists
        await supabase.from("sd_ai_sessions").insert({
          company_id: ctx.companyId,
          tenant_id: ctx.tenantId,
          channel: body.channel || "ai",
          user_message: body.text,
          intent: analysis.suggestedCategory,
          urgency: analysis.suggestedUrgency,
          suggested_category: analysis.suggestedCategory,
          suggested_priority: analysis.suggestedPriority,
          matched_article_id: analysis.knowledgeMatches[0]?.id || null,
          matched_article_title: analysis.knowledgeMatches[0]?.title || null,
          ticket_id: created.id,
          ticket_number: created.ticket_number,
          assistant_reply: llmReply || analysis.suggestedReply,
          outcome: "ticket_created",
          created_by: ctx.user.id,
        });
      } catch (e) {
        return apiError(
          "INTERNAL",
          e instanceof Error ? e.message : "AI ticket create failed",
          500
        );
      }
    } else if (!body.create_ticket) {
      await supabase.from("sd_ai_sessions").insert({
        company_id: ctx.companyId,
        tenant_id: ctx.tenantId,
        channel: body.channel || "ai",
        user_message: body.text,
        intent: analysis.suggestedCategory,
        urgency: analysis.suggestedUrgency,
        suggested_category: analysis.suggestedCategory,
        suggested_priority: analysis.suggestedPriority,
        matched_article_id: analysis.knowledgeMatches[0]?.id || null,
        matched_article_title: analysis.knowledgeMatches[0]?.title || null,
        assistant_reply: llmReply || analysis.suggestedReply,
        outcome: analysis.shouldCreateTicket ? "recommended_ticket" : "resolved_ai",
        created_by: ctx.user.id,
      });
    }

    return apiOk({
      analysis: {
        ...analysis,
        suggested_reply: llmReply || analysis.suggestedReply,
        llm_enriched: Boolean(llmReply),
      },
      duplicates: duplicates.slice(0, 5),
      ticket,
    });
  }
);
