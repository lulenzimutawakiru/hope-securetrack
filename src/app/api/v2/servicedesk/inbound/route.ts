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
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeRequest,
  calculateSlaDue,
  detectDuplicate,
  routeTicket,
  slaMinutesForPriority,
  type RoutingAgent,
  type RoutingTeam,
} from "@/lib/service-desk";

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

/** Server-side AI triage: tenant-scoped KB + open tickets, deterministic. */
async function triageText(
  supabase: SupabaseClient,
  companyId: string,
  text: string
) {
  const [{ data: articles }, { data: open }] = await Promise.all([
    supabase
      .from("sd_knowledge_articles")
      .select("id,title,summary,body,category,tags")
      .eq("company_id", companyId)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(100),
    supabase
      .from("support_tickets")
      .select("id,subject,status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("status", "in", '("closed","archived","resolved")')
      .limit(100),
  ]);

  const analysis = analyzeRequest(
    text,
    (articles || []) as Parameters<typeof analyzeRequest>[1]
  );
  const duplicates = detectDuplicate(
    text.slice(0, 200),
    (open || []) as Array<{ id: string; subject: string; status: string }>
  );
  return { analysis, duplicates };
}

/** Server-side mirror of createTicket (service layer is browser-client bound). */
async function createTicketFromInbound(
  supabase: SupabaseClient,
  companyId: string,
  input: {
    subject: string;
    description?: string | null;
    category: string;
    service_type: string;
    priority: string;
    impact: string;
    urgency: string;
    ticket_type?: string;
    channel: string;
    requester_email?: string | null;
    requester_name?: string | null;
    created_by?: string | null;
  }
) {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("support_tickets")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  const ticketNumber = `HDG-SD-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const policy = await loadSlaPolicy(supabase, companyId, input.priority);
  const mins = policy
    ? {
        responseMinutes: Number(policy.response_minutes),
        resolveMinutes: Number(policy.resolve_minutes),
      }
    : slaMinutesForPriority(input.priority);
  const sla = calculateSlaDue(input.priority, new Date(), mins);

  const [{ data: teams }, { data: agents }] = await Promise.all([
    supabase
      .from("sd_teams")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true),
    supabase
      .from("sd_agents")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true),
  ]);

  const routed = routeTicket({
    category: input.category,
    service_type: input.service_type,
    teams: (teams || []) as RoutingTeam[],
    agents: ((agents || []) as Array<Record<string, unknown>>).map((a) => ({
      id: String(a.id),
      user_id: String(a.user_id),
      team_id: (a.team_id as string) || null,
      skills: a.skills as string[] | null,
      max_open_tickets: a.max_open_tickets as number | null,
      is_available: a.is_available as boolean | null,
      open_count: 0,
      display_name: a.display_name as string | null,
    })) as RoutingAgent[],
  });

  const status = routed.agentUserId ? "assigned" : "new";
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      company_id: companyId,
      ticket_number: ticketNumber,
      subject: input.subject,
      description: input.description,
      category: input.category || "general",
      subcategory: null,
      ticket_type: input.ticket_type || "incident",
      service_type: input.service_type || "it",
      priority: input.priority,
      impact: input.impact,
      urgency: input.urgency,
      severity: input.priority,
      channel: input.channel,
      requester_email: input.requester_email,
      requester_name: input.requester_name,
      team_id: routed.teamId,
      assigned_to: routed.agentUserId,
      status,
      sla_policy_id: policy?.id || null,
      sla_response_due: sla.responseDue.toISOString(),
      sla_resolve_due: sla.resolveDue.toISOString(),
      created_by: input.created_by,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("sd_ticket_events").insert({
    company_id: companyId,
    ticket_id: data.id,
    event_type: "created",
    message: `Ticket ${ticketNumber} created via ${input.channel} ingestion${
      routed.reason ? ` - ${routed.reason}` : ""
    }`,
    actor_id: input.created_by,
    is_public: true,
  });

  return data;
}

async function loadSlaPolicy(
  supabase: SupabaseClient,
  companyId: string,
  priority: string
) {
  const { data } = await supabase
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("priority", priority)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (data) return data;
  const code =
    priority === "critical"
      ? "SLA-P1"
      : priority === "high"
        ? "SLA-P2"
        : priority === "low"
          ? "SLA-P4"
          : "SLA-P3";
  const { data: byCode } = await supabase
    .from("sd_sla_policies")
    .select("*")
    .eq("company_id", companyId)
    .eq("policy_code", code)
    .maybeSingle();
  return byCode;
}

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
    const { analysis, duplicates } = await triageText(
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
        const created = await createTicketFromInbound(
          supabase,
          ctx.companyId,
          {
            subject: body.subject,
            description: body.body,
            category: effectiveCategory,
            service_type: body.service_type || analysis.suggestedServiceType,
            priority: body.priority || analysis.suggestedPriority,
            impact: analysis.suggestedImpact,
            urgency: analysis.suggestedUrgency,
            ticket_type: body.ticket_type || undefined,
            channel: body.source,
            requester_email: body.from_address,
            requester_name: null,
            created_by: ctx.user.id,
          }
        );
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