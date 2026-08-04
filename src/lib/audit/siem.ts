/** SIEM integration adapters — Splunk, Sentinel, QRadar, Elastic, webhook. CRUD-backed. */

import {
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

export type SiemProvider =
  | "splunk"
  | "sentinel"
  | "qradar"
  | "elastic"
  | "webhook"
  | "syslog";

export function formatForSiem(
  provider: string,
  event: Record<string, unknown>
): Record<string, unknown> {
  const base = {
    timestamp: event.created_at,
    audit_id: event.audit_id,
    event_id: event.event_id,
    module: event.module,
    action: event.action,
    severity: event.severity,
    risk_score: event.risk_score,
    user: event.user_email || event.username,
    ip: event.ip_address,
    company_id: event.company_id,
    integrity_hash: event.integrity_hash,
  };

  switch (provider) {
    case "splunk":
      return {
        event: base,
        sourcetype: "hope:eal",
        source: "hope-securetrack",
      };
    case "sentinel":
      return {
        TimeGenerated: event.created_at,
        ...base,
        ProductName: "SecureTrack ERP",
        VendorName: "SecureTrack ERP",
      };
    case "qradar":
      return {
        LEEF: `LEEF:2.0|SecureTrack|SecureTrack|1.0|${event.event_id}|sev=${event.severity}\tsrc=${event.ip_address}\tusrName=${event.user_email}`,
        raw: base,
      };
    case "elastic":
      return {
        "@timestamp": event.created_at,
        event: {
          action: event.action,
          module: event.module,
          severity: event.severity,
          id: event.audit_id,
        },
        user: { name: event.user_email },
        source: { ip: event.ip_address },
        hope: base,
        ecs: { version: "8.11" },
      };
    default:
      return base;
  }
}

export async function enqueueSiemPush(input: {
  company_id: string;
  event: Record<string, unknown>;
  useJobQueue?: boolean;
}) {
  const connectors = await mustList<Record<string, unknown>>(
    "eal_siem_connectors",
    {
      pageSize: 50,
      filters: { enabled: true },
    }
  );

  if (!connectors.length) return { enqueued: 0, jobId: null as string | null };

  let n = 0;
  const outboxIds: string[] = [];
  for (const c of connectors) {
    const min = severityRank(String(c.min_severity || "info"));
    const ev = severityRank(String(input.event.severity || "info"));
    if (ev < min) continue;

    const payload = formatForSiem(String(c.provider), input.event);
    const row = await mustCreate<Record<string, unknown>>("eal_siem_outbox", {
      connector_id: c.id,
      event_id: input.event.id as string,
      payload,
      status: "pending",
    });
    if (row?.id) outboxIds.push(String(row.id));
    n += 1;
  }

  let jobId: string | null = null;
  if (n > 0 && input.useJobQueue !== false) {
    try {
      const { enqueueJob } = await import("@/lib/jobs/queue");
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const job = await enqueueJob(createAdminClient(), {
        companyId: input.company_id,
        tenantId: null,
        jobType: "siem.forward",
        payload: {
          company_id: input.company_id,
          outbox_ids: outboxIds,
          event_id: input.event.id,
        },
        maxAttempts: 8,
      });
      jobId = job?.id || null;
    } catch {
      /* outbox still pending without worker */
    }
  }

  return { enqueued: n, jobId };
}

function severityRank(s: string): number {
  const m: Record<string, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return m[s] ?? 0;
}

/**
 * Flush pending SIEM outbox rows — real HTTPS POST to connector endpoints.
 * Falls back to marking sent when connector has no endpoint (dev).
 */
export async function flushSiemOutbox(companyId: string) {
  const pending = await mustList<Record<string, unknown>>("eal_siem_outbox", {
    pageSize: 100,
    filters: { status: "pending" },
  });

  const connectors = await mustList<Record<string, unknown>>(
    "eal_siem_connectors",
    {
      pageSize: 50,
      filters: companyId ? { enabled: true, company_id: companyId } : { enabled: true },
    }
  ).catch(async () =>
    mustList<Record<string, unknown>>("eal_siem_connectors", {
      pageSize: 50,
      filters: { enabled: true },
    })
  );

  const byId = new Map(
    (connectors || []).map((c) => [String(c.id), c] as const)
  );

  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const connector = byId.get(String(row.connector_id));
    const attempts = Number(row.attempts || 0) + 1;
    const endpoint = String(
      connector?.endpoint_url ||
        connector?.hec_url ||
        connector?.webhook_url ||
        ""
    );
    const provider = String(connector?.provider || "webhook");
    const token = (connector?.token ||
      connector?.hec_token ||
      connector?.api_key ||
      null) as string | null;

    if (!endpoint.startsWith("https://")) {
      // No live endpoint — mark delivered in sandbox so queue does not stall
      await mustUpdate("eal_siem_outbox", String(row.id), {
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts,
        last_error: null,
        response_note: "no endpoint — sandbox ack",
      });
      sent += 1;
      continue;
    }

    try {
      const { deliverSiemEvent } = await import("@/lib/providers/siem/deliver");
      const payload =
        (row.payload as Record<string, unknown>) ||
        ({ outbox_id: row.id } as Record<string, unknown>);
      const result = await deliverSiemEvent({
        endpointUrl: endpoint,
        provider,
        payload,
        token,
      });
      if (result.ok) {
        await mustUpdate("eal_siem_outbox", String(row.id), {
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts,
          last_error: null,
        });
        sent += 1;
      } else {
        await mustUpdate("eal_siem_outbox", String(row.id), {
          status: attempts >= 8 ? "failed" : "pending",
          attempts,
          last_error: (result.error || "delivery failed").slice(0, 500),
        });
        failed += 1;
      }
    } catch (e) {
      await mustUpdate("eal_siem_outbox", String(row.id), {
        status: attempts >= 8 ? "failed" : "pending",
        attempts,
        last_error: (e instanceof Error ? e.message : "SIEM error").slice(0, 500),
      });
      failed += 1;
    }
  }

  if (sent > 0) {
    for (const c of connectors || []) {
      try {
        await mustUpdate("eal_siem_connectors", String(c.id), {
          last_push_at: new Date().toISOString(),
        });
      } catch {
        /* optional column */
      }
    }
  }

  return { sent, failed };
}
