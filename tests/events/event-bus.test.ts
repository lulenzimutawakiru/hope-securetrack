/**
 * Enterprise event bus — publishing unit tests (pure, no live DB).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publishDomainEvent,
  publishEntityEvent,
  publishEntityEventSafe,
} from "@/lib/events/bus";
import { getEntityDefinition } from "@/lib/metadata/entity-registry";

type Inserted = { table: string; payload: Record<string, unknown> };

function makeSb(
  opts: { error?: { message: string } | null } = {}
): { sb: SupabaseClient; inserts: Inserted[] } {
  const inserts: Inserted[] = [];
  const thenable = {
    then(resolve: (v: { data: unknown; error: unknown }) => void) {
      return Promise.resolve({ data: null, error: opts.error ?? null }).then(
        resolve
      );
    },
  };
  const sb = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return thenable;
        },
      };
    },
  };
  return { sb: sb as unknown as SupabaseClient, inserts };
}

describe("publishDomainEvent", () => {
  it("writes a tenant-scoped pending event with full tracing context", async () => {
    const { sb, inserts } = makeSb();
    const result = await publishDomainEvent({
      sb,
      eventType: "sales_order.approved",
      aggregateType: "sales_order",
      aggregateId: "so-1",
      tenantId: "tenant-aaa",
      companyId: "company-aaa",
      branchId: "branch-1",
      actorId: "user-1",
      sourceModule: "sales",
      correlationId: "corr-1",
      payload: { amount: 100 },
      metadata: { origin: "unit" },
    });
    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    const row = inserts[0];
    expect(row.table).toBe("domain_events");
    expect(row.payload.event_type).toBe("sales_order.approved");
    expect(row.payload.aggregate_type).toBe("sales_order");
    expect(row.payload.aggregate_id).toBe("so-1");
    expect(row.payload.tenant_id).toBe("tenant-aaa");
    expect(row.payload.company_id).toBe("company-aaa");
    expect(row.payload.branch_id).toBe("branch-1");
    expect(row.payload.actor_id).toBe("user-1");
    expect(row.payload.source_module).toBe("sales");
    expect(row.payload.correlation_id).toBe("corr-1");
    expect(row.payload.severity).toBe("info");
    expect(row.payload.status).toBe("pending");
    expect(row.payload.payload).toEqual({ amount: 100 });
    expect(row.payload.metadata).toEqual({ origin: "unit" });
    expect(row.payload.id).toBeDefined();
    if (result.ok) expect(result.eventId).toBe(row.payload.id);
  });

  it("defaults identity/tracing fields to null-safe values", async () => {
    const { sb, inserts } = makeSb();
    const result = await publishDomainEvent({
      sb,
      eventType: "system.health",
    });
    expect(result.ok).toBe(true);
    const row = inserts[0].payload;
    expect(row.tenant_id).toBeNull();
    expect(row.company_id).toBeNull();
    expect(row.actor_id).toBeNull();
    expect(row.correlation_id).toBeNull();
    expect(row.payload).toEqual({});
  });

  it("returns the write error without throwing", async () => {
    const { sb } = makeSb({ error: { message: "RLS denied" } });
    const result = await publishDomainEvent({
      sb,
      eventType: "x.changed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("RLS denied");
  });
});

describe("publishEntityEvent", () => {
  const def = getEntityDefinition("sales_leads");
  const scope = { userId: "user-1", companyId: "company-aaa", tenantId: "tenant-aaa" };

  it("builds {entity}.{action} events from the definition + session scope", async () => {
    const { sb, inserts } = makeSb();
    const result = await publishEntityEvent({
      sb,
      scope,
      def: def!,
      action: "created",
      record: { id: "sl-1", company_name: "Acme" },
      extraPayload: { source: "api" },
    });
    expect(result.ok).toBe(true);
    const row = inserts[0].payload;
    expect(row.event_type).toBe("sales_leads.created");
    expect(row.aggregate_type).toBe("sales_leads");
    expect(row.aggregate_id).toBe("sl-1");
    expect(row.tenant_id).toBe("tenant-aaa");
    expect(row.company_id).toBe("company-aaa");
    expect(row.actor_id).toBe("user-1");
    expect(row.source_module).toBe("crm");
    expect(row.payload).toEqual({ entityId: "sl-1", source: "api" });
    expect(row.metadata).toEqual({ entity: "sales_leads", action: "created" });
  });

  it("publishEntityEventSafe swallows delivery errors", async () => {
    const { sb } = makeSb({ error: { message: "boom" } });
    await expect(
      publishEntityEventSafe({
        sb,
        scope,
        def: def!,
        action: "updated",
        record: { id: "sl-1" },
      })
    ).resolves.toBeUndefined();
  });
});
