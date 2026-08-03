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
 * Ingestion is idempotent: re-sending the same source + external_id returns the
 * existing inbound item instead of creating a duplicate.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  createTicketServer,
  triageForCompany,
} from "@/lib/service-desk/server";

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
    const externalId = body.external_id || null;

    // Idempotency: re-ingesting the same source + external_id returns the
    // existing item instead of creating a duplicate.
    if (externalId) {
      const { data: existing } = await supabase
        .from("sd_inbound_items")
        .select("*")
        .eq("company_id", ctx.companyId)
        .eq("source", body.source)
        .eq("external_id", externalId)
        .maybeSingle();
      if (existing) {
        return apiOk({ item: existing, duplicate: true });
      }
    }

    const text = `${body.subject} ${body.body || ""}`;
    const { analysis, duplicates } = await triageForCompany(
      supabase,
      ctx.companyId,
      text
    );

    const autoCreate =
      body.auto_convert === true ||
      (body.auto_convert === undefined && analysis.shouldCreateTicket);
    const effectiveCategory = body.category || analysis.suggestedCategory;
    const canTicket =
      !analysis.isMajor && effectiveCategory.toLowerCase() !== "spam";

    const { data: item, error: insertError } = await supabase
      .from("sd_inbound_items")
      .insert({
        company_id: ctx.companyId,
        tenant_id: ctx.tenantId,
        source: body.source,
        external_id: externalId,
        from_address: body.from_address,
        subject: body.subject,
        body: body.body,
        status: "new",
        metadata: {
          ...(body.metadata || {}),
          correlation_id: correlationId,
          ai: {
            category: analysis.suggestedCategory,
            subcategory: analysis.suggestedSubcategory,
            service_type: analysis.suggestedServiceType,
            priority: analysis.suggestedPriority,
            impact: analysis.suggestedImpact,
            urgency: analysis.suggestedUrgency,
            is_major: analysis.isMajor,
            should_create_ticket: autoCreate,
            knowledge_matches: analysis.knowledgeMatches.slice(0, 5),
            duplicate_candidates: duplicates.slice(0, 5),
          },
        },
      })
      .select("*")
      .single();

    if (insertError || !item) {
      return apiError(
        "INTERNAL",
        `Failed to store inbound item: ${insertError?.message || "unknown error"}`,
        500
      );
    }

    let ticket: { id: string; ticket_number: string } | null = null;
    if (autoCreate && canTicket) {
      try {
        const created = await createTicketServer(supabase, {
          company_id: ctx.companyId,
          created_by: ctx.user.id,
          actor_name: body.from_address || "Inbound",
          ticket: {
            subject: body.subject,
            description: body.body || undefined,
            category: effectiveCategory,
            service_type: body.service_type || analysis.suggestedServiceType,
            priority: (body.priority || analysis.suggestedPriority) as
              | "critical"
              | "high"
              | "medium"
              | "low",
            impact: analysis.suggestedImpact,
            urgency: analysis.suggestedUrgency,
            ticket_type: body.ticket_type || undefined,
            channel: body.source,
            requester_email: body.from_address || undefined,
          },
        });
        ticket = { id: created.id, ticket_number: created.ticket_number };
        const { error: updateError } = await supabase
          .from("sd_inbound_items")
          .update({ status: "ticketed", ticket_id: created.id })
          .eq("id", item.id);
        if (updateError) {
          // Non-fatal: item and ticket both exist; record the mismatch so
          // operators can reconcile the link.
          await supabase
            .from("sd_inbound_items")
            .update({
              metadata: {
                ...(item.metadata as Record<string, unknown>),
                ticket_link_error: updateError.message,
              },
            })
            .eq("id", item.id);
        }
      } catch (err) {
        return apiError(
          "INTERNAL",
          `Inbound stored but ticket creation failed: ${(err as Error).message}`,
          500
        );
      }
    }

    return apiOk({
      item,
      duplicate: false,
      auto_created: Boolean(ticket),
      ticket: ticket
        ? { id: ticket.id, ticket_number: ticket.ticket_number }
        : null,
      analysis: {
        category: analysis.suggestedCategory,
        subcategory: analysis.suggestedSubcategory,
        service_type: analysis.suggestedServiceType,
        priority: analysis.suggestedPriority,
        impact: analysis.suggestedImpact,
        urgency: analysis.suggestedUrgency,
        is_major: analysis.isMajor,
        should_create_ticket: autoCreate,
        knowledge_matches: analysis.knowledgeMatches.slice(0, 5),
        duplicate_candidates: duplicates.slice(0, 5),
      },
    });
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