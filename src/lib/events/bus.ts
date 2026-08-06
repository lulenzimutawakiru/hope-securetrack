/**
 * Enterprise event bus — typed publishing for domain events.
 *
 * Every business operation publishes a tenant-scoped domain event into the
 * `domain_events` table (RLS-protected). Workers (`domain_event.consume` jobs,
 * see src/lib/jobs/domain-events.ts) fan events out to notifications, SIEM,
 * webhooks and downstream modules with idempotency + dead-letter support.
 *
 * Publishing is best-effort by design: a failed publish must never fail the
 * business operation that triggered it. Callers log the failure and continue.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { EntityDefinition } from "@/lib/metadata/entity-registry";
import { log } from "@/lib/observability/logger";

export type DomainEventSeverity = "info" | "warning" | "error" | "critical";

/**
 * Session-derived identity used to stamp events. Structurally a subset of
 * CrudScope; kept local to avoid a runtime import cycle with crud-engine.
 */
export type EntityEventScope = {
  userId: string;
  companyId: string;
  tenantId: string | null;
};

export type PublishDomainEventInput = {
  /** Client to write with (session-scoped or admin). */
  sb: SupabaseClient;
  /** Stable event type, e.g. "sales_order.approved". */
  eventType: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  tenantId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  severity?: DomainEventSeverity;
  sourceModule?: string;
  /** Groups all events belonging to one operation (tracing). */
  correlationId?: string;
};

export type PublishDomainEventResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

/**
 * Insert a domain event row. Tenant/company/branch/actor are supplied by the
 * caller from the authenticated session scope — never from client input — so
 * downstream consumers can never cross tenant boundaries.
 */
export async function publishDomainEvent(
  input: PublishDomainEventInput
): Promise<PublishDomainEventResult> {
  const eventId = randomUUID();
  try {
    const { error } = await input.sb.from("domain_events").insert({
      id: eventId,
      event_id: randomUUID(),
      event_type: input.eventType,
      aggregate_type: input.aggregateType ?? null,
      aggregate_id: input.aggregateId ?? null,
      tenant_id: input.tenantId ?? null,
      company_id: input.companyId ?? null,
      branch_id: input.branchId ?? null,
      actor_id: input.actorId ?? null,
      payload: input.payload ?? {},
      metadata: input.metadata ?? {},
      severity: input.severity ?? "info",
      source_module: input.sourceModule ?? null,
      correlation_id: input.correlationId ?? null,
      status: "pending",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, eventId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "domain event publish failed",
    };
  }
}

/** Lifecycle action names emitted by the generic CRUD engine. */
export type CrudEventAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "archived"
  | "imported";

/**
 * Publish a `{entity}.{action}` event for a generic CRUD operation, built
 * entirely from the authenticated session scope + entity definition.
 */
export async function publishEntityEvent(input: {
  sb: SupabaseClient;
  scope: EntityEventScope;
  def: EntityDefinition;
  action: CrudEventAction;
  record: Record<string, unknown>;
  extraPayload?: Record<string, unknown>;
  severity?: DomainEventSeverity;
}): Promise<PublishDomainEventResult> {
  const aggregateId = input.record[input.def.primaryKey];
  return publishDomainEvent({
    sb: input.sb,
    eventType: `${input.def.entity}.${input.action}`,
    aggregateType: input.def.entity,
    aggregateId:
      aggregateId != null && typeof aggregateId === "string"
        ? aggregateId
        : null,
    tenantId: input.scope.tenantId,
    companyId: input.scope.companyId,
    actorId: input.scope.userId,
    sourceModule: input.def.module,
    severity: input.severity ?? "info",
    payload: {
      entityId: aggregateId ?? null,
      ...(input.extraPayload ?? {}),
    },
    metadata: {
      entity: input.def.entity,
      action: input.action,
    },
  });
}

/**
 * Best-effort publish used by callers that must not fail the operation when
 * event delivery fails. Failures are logged and dropped (event workers and
 * audit_logs remain the source of truth for replay).
 */
export async function publishEntityEventSafe(input: {
  sb: SupabaseClient;
  scope: EntityEventScope;
  def: EntityDefinition;
  action: CrudEventAction;
  record: Record<string, unknown>;
  extraPayload?: Record<string, unknown>;
  severity?: DomainEventSeverity;
}): Promise<void> {
  const result = await publishEntityEvent(input);
  if (!result.ok) {
    log.warn("events.publish.failed", {
      eventType: `${input.def.entity}.${input.action}`,
      companyId: input.scope.companyId,
      error: result.error,
    });
  }
}
