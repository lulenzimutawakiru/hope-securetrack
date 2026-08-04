/**
 * Omni-channel ingestion core shared by the session-authenticated inbound API
 * and the shared-secret webhook endpoints (email / WhatsApp).
 *
 * The caller passes the Supabase client (session or admin) plus server-resolved
 * company/tenant -- never trust payload-supplied tenant/company values.
 * Ingestion is idempotent by (company_id, source, external_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTicketServer, triageForCompany } from "./server";

export const INGEST_SOURCES = [
  "email",
  "whatsapp",
  "iot",
  "api",
  "chat",
  "phone",
  "monitoring",
  "sms",
] as const;

export type IngestSource = (typeof INGEST_SOURCES)[number];

export type IngestPayload = {
  source: IngestSource;
  external_id?: string | null;
  from_address?: string | null;
  subject: string;
  body?: string | null;
  priority?: "critical" | "high" | "medium" | "low";
  category?: string;
  service_type?: string;
  ticket_type?: string;
  /** Create a ticket immediately instead of leaving the item for triage. */
  auto_convert?: boolean;
  metadata?: Record<string, unknown>;
};

export type IngestOptions = {
  companyId: string;
  tenantId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  correlationId?: string | null;
};

type TriageResult = Awaited<ReturnType<typeof triageForCompany>>;

export type IngestResult = {
  item: Record<string, unknown>;
  duplicate: boolean;
  auto_created: boolean;
  ticket: { id: string; ticket_number: string } | null;
  analysis: TriageResult["analysis"] | null;
  duplicates: TriageResult["duplicates"];
};

export async function ingestInbound(
  supabase: SupabaseClient,
  opts: IngestOptions,
  payload: IngestPayload
): Promise<IngestResult> {
  const externalId = payload.external_id || null;

  // Idempotency: re-ingesting the same source + external_id returns the
  // existing item instead of creating a duplicate.
  if (externalId) {
    const { data: existing } = await supabase
      .from("sd_inbound_items")
      .select("*")
      .eq("company_id", opts.companyId)
      .eq("source", payload.source)
      .eq("external_id", externalId)
      .maybeSingle();
    if (existing) {
      return {
        item: existing,
        duplicate: true,
        auto_created: false,
        ticket: null,
        analysis: null,
        duplicates: [],
      };
    }
  }

  const text = `${payload.subject} ${payload.body || ""}`;
  const { analysis, duplicates } = await triageForCompany(
    supabase,
    opts.companyId,
    text
  );

  const autoCreate =
    payload.auto_convert === true ||
    (payload.auto_convert === undefined && analysis.shouldCreateTicket);
  const effectiveCategory = payload.category || analysis.suggestedCategory;
  const canTicket =
    !analysis.isMajor && effectiveCategory.toLowerCase() !== "spam";

  const { data: item, error: insertError } = await supabase
    .from("sd_inbound_items")
    .insert({
      company_id: opts.companyId,
      tenant_id: opts.tenantId || null,
      source: payload.source,
      external_id: externalId,
      from_address: payload.from_address,
      subject: payload.subject,
      body: payload.body,
      status: "new",
      metadata: {
        ...(payload.metadata || {}),
        correlation_id: opts.correlationId || null,
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
    throw new Error(
      `Failed to store inbound item: ${insertError?.message || "unknown error"}`
    );
  }

  let ticket: { id: string; ticket_number: string } | null = null;
  if (autoCreate && canTicket) {
    const created = await createTicketServer(supabase, {
      company_id: opts.companyId,
      tenant_id: opts.tenantId || null,
      created_by: opts.actorUserId || null,
      actor_name: payload.from_address || opts.actorName || "Inbound",
      ticket: {
        subject: payload.subject,
        description: payload.body || undefined,
        category: effectiveCategory,
        service_type: payload.service_type || analysis.suggestedServiceType,
        priority: (payload.priority || analysis.suggestedPriority) as
          | "critical"
          | "high"
          | "medium"
          | "low",
        impact: analysis.suggestedImpact,
        urgency: analysis.suggestedUrgency,
        ticket_type: payload.ticket_type || undefined,
        channel: payload.source,
        requester_email: payload.from_address || undefined,
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
  }

  return {
    item,
    duplicate: false,
    auto_created: Boolean(ticket),
    ticket,
    analysis,
    duplicates,
  };
}