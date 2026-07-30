/** SIEM integration adapters — Splunk, Sentinel, QRadar, Elastic, webhook */

import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export type SiemProvider = "splunk" | "sentinel" | "qradar" | "elastic" | "webhook" | "syslog";

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
      return { event: base, sourcetype: "hope:eal", source: "hope-securetrack" };
    case "sentinel":
      return {
        TimeGenerated: event.created_at,
        ...base,
        ProductName: "Hope SecureTrack",
        VendorName: "Hope Design Group",
      };
    case "qradar":
      return {
        LEEF: `LEEF:2.0|Hope|SecureTrack|1.0|${event.event_id}|sev=${event.severity}\tsrc=${event.ip_address}\tusrName=${event.user_email}`,
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
  /** Prefer durable job worker for delivery (default true on server) */
  useJobQueue?: boolean;
}) {
  const client = sb();
  const { data: connectors } = await client
    .from("eal_siem_connectors")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("enabled", true);

  if (!connectors?.length) return { enqueued: 0, jobId: null as string | null };

  let n = 0;
  const outboxIds: string[] = [];
  for (const c of connectors) {
    const min = severityRank(String(c.min_severity || "info"));
    const ev = severityRank(String(input.event.severity || "info"));
    if (ev < min) continue;

    const payload = formatForSiem(String(c.provider), input.event);
    const { data: row } = await client
      .from("eal_siem_outbox")
      .insert({
        company_id: input.company_id,
        connector_id: c.id,
        event_id: input.event.id as string,
        payload,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
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
      /* browser path may lack admin — outbox still pending */
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

/** Simulate flush of pending outbox (production would POST to HEC/Sentinel) */
export async function flushSiemOutbox(companyId: string) {
  const { data: pending } = await sb()
    .from("eal_siem_outbox")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .limit(100);

  let sent = 0;
  for (const row of pending || []) {
    await sb()
      .from("eal_siem_outbox")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: Number(row.attempts || 0) + 1,
      })
      .eq("id", row.id);
    sent += 1;
  }

  if (sent > 0) {
    await sb()
      .from("eal_siem_connectors")
      .update({ last_push_at: new Date().toISOString(), last_status: "ok" })
      .eq("company_id", companyId)
      .eq("enabled", true);
  }

  return { sent };
}
