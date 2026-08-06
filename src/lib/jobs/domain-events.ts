/**
 * Domain event consumers with idempotency + dead-letter support.
 * Workers claim domain_events rows (or process job_queue domain_event.consume).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "./queue";
import { log } from "@/lib/observability/logger";

export type DomainEvent = {
  id: string;
  company_id?: string | null;
  tenant_id?: string | null;
  event_type: string;
  payload?: Record<string, unknown> | null;
  idempotency_key?: string | null;
  status?: string;
  created_at?: string;
};

export type EventHandler = (
  event: DomainEvent,
  sb: SupabaseClient
) => Promise<{ ok: true } | { ok: false; error: string }>;

/**
 * Default fan-out: map event types to notification / SIEM / webhook jobs.
 */
export function defaultDomainEventHandlers(): Record<string, EventHandler> {
  return {
    "payroll.released": async (event, sb) => {
      await enqueueJob(sb, {
        companyId: event.company_id,
        tenantId: event.tenant_id,
        jobType: "notification.dispatch",
        idempotencyKey: `evt:${event.id}:notify`,
        payload: {
          companyId: event.company_id,
          tenantId: event.tenant_id,
          title: "Payroll released",
          message: "A payroll run was released",
          category: "payroll",
          sourceEvent: event.event_type,
          entityId: (event.payload?.payroll_run_id as string) || event.id,
        },
      });
      return { ok: true };
    },
    "invoice.paid": async (event, sb) => {
      await enqueueJob(sb, {
        companyId: event.company_id,
        tenantId: event.tenant_id,
        jobType: "notification.dispatch",
        idempotencyKey: `evt:${event.id}:notify`,
        payload: {
          companyId: event.company_id,
          tenantId: event.tenant_id,
          title: "Invoice payment recorded",
          message: "An invoice payment was recorded",
          category: "billing",
          sourceEvent: event.event_type,
          entityId: (event.payload?.invoice_id as string) || event.id,
          channels: ["in_app", "slack"],
        },
      });
      return { ok: true };
    },
    "ticket.created": async (event, _sb) => {
      if (!event.company_id) return { ok: true };
      try {
        const { notifyCompanySlack } = await import("@/lib/slack");
        const subject =
          (event.payload?.subject as string) ||
          (event.payload?.ticket_number as string) ||
          "New ticket";
        await notifyCompanySlack(
          event.company_id,
          "Service Desk ticket created",
          subject,
          {
            eventType: "ticket.created",
            entityType: "support_ticket",
            entityId:
              (event.payload?.ticket_id as string) ||
              (event.payload?.id as string) ||
              event.id,
            link: event.payload?.link
              ? String(event.payload.link)
              : undefined,
          }
        );
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "slack notify failed",
        };
      }
      return { ok: true };
    },

    "security.dual_control.approved": async (event, sb) => {
      await enqueueJob(sb, {
        companyId: event.company_id,
        tenantId: event.tenant_id,
        jobType: "siem.forward",
        idempotencyKey: `evt:${event.id}:siem`,
        payload: {
          event_type: event.event_type,
          company_id: event.company_id,
          tenant_id: event.tenant_id,
          payload: event.payload || {},
        },
      });
      return { ok: true };
    },
  };
}

/**
 * Process a single domain event idempotently.
 * Marks consumed / dead on domain_events when columns exist.
 */
export async function consumeDomainEvent(
  sb: SupabaseClient,
  event: DomainEvent,
  handlers: Record<string, EventHandler> = defaultDomainEventHandlers()
): Promise<{ ok: true } | { ok: false; error: string; dead?: boolean }> {
  // Tenant scope required for business events
  if (!event.company_id && !event.tenant_id) {
    return { ok: false, error: "Event missing company_id and tenant_id" };
  }

  const handler = handlers[event.event_type] || handlers["*"];
  if (!handler) {
    // Unknown events complete as no-op so they do not poison the queue forever
    log.info("domain_event.unhandled", {
      eventType: event.event_type,
      eventId: event.id,
      module: "events",
    });
    await markEventStatus(sb, event.id, "consumed");
    return { ok: true };
  }

  try {
    const result = await handler(event, sb);
    if (!result.ok) {
      await markEventStatus(sb, event.id, "failed", result.error);
      return { ok: false, error: result.error };
    }
    await markEventStatus(sb, event.id, "consumed");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markEventStatus(sb, event.id, "failed", msg);
    // Dead-letter after repeated failures is handled by job_queue wrapper
    return { ok: false, error: msg };
  }
}

async function markEventStatus(
  sb: SupabaseClient,
  eventId: string,
  status: string,
  lastError?: string
) {
  try {
    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (lastError) patch.last_error = lastError.slice(0, 2000);
    if (status === "consumed") patch.consumed_at = new Date().toISOString();
    await sb.from("domain_events").update(patch).eq("id", eventId);
  } catch {
    /* table/columns may lag migrations */
  }
}

/**
 * Claim pending domain_events for processing (status = pending).
 */
export async function claimDomainEvents(
  sb: SupabaseClient,
  limit = 20
): Promise<DomainEvent[]> {
  const { data, error } = await sb
    .from("domain_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data?.length) return [];

  const claimed: DomainEvent[] = [];
  for (const row of data) {
    const { data: updated } = await sb
      .from("domain_events")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (updated) claimed.push(updated as DomainEvent);
  }
  return claimed;
}

export async function processClaimedDomainEvents(
  sb: SupabaseClient,
  events: DomainEvent[],
  handlers?: Record<string, EventHandler>
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  const h = handlers || defaultDomainEventHandlers();
  for (const event of events) {
    const r = await consumeDomainEvent(sb, event, h);
    if (r.ok) processed += 1;
    else failed += 1;
  }
  return { processed, failed };
}
