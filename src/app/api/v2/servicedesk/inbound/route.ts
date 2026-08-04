/**
 * Service Desk inbound ingestion API (API-first intake).
 *
 *   POST /api/v2/servicedesk/inbound  - ingest a message from email, WhatsApp,
 *                                       IoT, monitoring, chat, phone or API
 *                                       sources; optionally auto-create a ticket
 *   GET  /api/v2/servicedesk/inbound  - list the company inbound inbox
 *
 * AuthN/AuthZ: session via createApiHandler (permission sd.agent | sd.manage for
 * writes, sd.view for reads). Tenant/company are always derived from the session;
 * the server client enforces RLS so client-supplied company_id is rejected unless
 * it matches the authenticated company.
 *
 * The ingestion pipeline itself lives in src/lib/service-desk/ingest.ts and is
 * shared with the shared-secret webhook endpoints (email / WhatsApp), so external
 * sources never hit the portal RLS path.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { ingestInbound } from "@/lib/service-desk/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCES = [
  "email",
  "whatsapp",
  "iot",
  "api",
  "chat",
  "phone",
  "monitoring",
  "sms",
] as const;

const PRIORITY_LEVELS = ["critical", "high", "medium", "low"] as const;

const ingestSchema = z.object({
  source: z.enum(SOURCES),
  external_id: z.string().max(120).optional().nullable(),
  from_address: z.string().max(255).optional().nullable(),
  subject: z.string().min(1).max(500),
  body: z.string().max(100_000).optional().nullable(),
  priority: z.enum(PRIORITY_LEVELS).optional(),
  category: z.string().max(120).optional(),
  service_type: z.string().max(80).optional(),
  ticket_type: z.string().max(40).optional(),
  /** Create a ticket immediately instead of leaving the item for triage. */
  auto_convert: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v2/servicedesk/inbound
 *
 * Ingest an inbound message from email, WhatsApp, IoT, monitoring, chat,
 * phone, SMS or API sources. Runs tenant-scoped AI triage (knowledge match +
 * duplicate detection), stores the item in the inbound inbox and optionally
 * creates a ticket. Idempotent by (company_id, source, external_id) when
 * external_id is provided.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["sd.agent", "sd.manage"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    idempotent: true,
    module: "servicedesk",
    bodySchema: ingestSchema,
  },
  async ({ ctx, body, correlationId }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const supabase = await createClient();
    try {
      const result = await ingestInbound(
        supabase,
        {
          companyId: ctx.companyId,
          tenantId: ctx.tenantId,
          actorUserId: ctx.user.id,
          actorName: ctx.user.email || "Inbound",
          correlationId,
        },
        body
      );

      const analysis = result.analysis;
      return apiOk({
        item: result.item,
        duplicate: result.duplicate,
        auto_created: result.auto_created,
        ticket: result.ticket,
        analysis: analysis
          ? {
              category: analysis.suggestedCategory,
              subcategory: analysis.suggestedSubcategory,
              service_type: analysis.suggestedServiceType,
              priority: analysis.suggestedPriority,
              impact: analysis.suggestedImpact,
              urgency: analysis.suggestedUrgency,
              is_major: analysis.isMajor,
              should_create_ticket: analysis.shouldCreateTicket,
              knowledge_matches: analysis.knowledgeMatches.slice(0, 5),
              duplicate_candidates: result.duplicates.slice(0, 5),
            }
          : null,
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Inbound ingestion failed",
        500
      );
    }
  }
);

/**
 * GET /api/v2/servicedesk/inbound
 *
 * List the company inbound inbox (email, WhatsApp, IoT, monitoring, API, SMS,
 * chat, phone items). Supports ?status=new|ticketed|ignored|spam and
 * ?limit=1..200 (default 50), newest first.
 */
export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["sd.view", "sd.agent", "sd.manage"],
    allowPlatformAdmin: true,
    module: "servicedesk",
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const supabase = await createClient();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.trunc(limitRaw)), 200)
      : 50;

    let query = supabase
      .from("sd_inbound_items")
      .select("*, tickets:ticket_id(ticket_number, subject, status)")
      .eq("company_id", ctx.companyId)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return apiError(
        "INTERNAL",
        `Failed to load inbound inbox: ${error.message}`,
        500
      );
    }

    return apiOk({ items: data || [] });
  }
);