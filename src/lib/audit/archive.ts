/** Secure archival & retrieval — events never deleted, only sealed. CRUD-backed. */

import { hashPayload } from "./integrity";
import {
  crudCount,
  crudGetOne,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

export async function archiveEvents(input: {
  company_id: string;
  period_start: string;
  period_end: string;
  sealed_by?: string | null;
  notes?: string;
}) {
  const events = await mustList<Record<string, unknown>>("eal_events", {
    pageSize: 100,
    sort: "chain_index",
    order: "asc",
    filters: {
      created_at: {
        gte: input.period_start,
        lte: input.period_end,
      },
    },
  });
  // Walk additional pages (up to 500 events)
  let all = events;
  for (let p = 2; p <= 5; p++) {
    const more = await mustList<Record<string, unknown>>("eal_events", {
      page: p,
      pageSize: 100,
      sort: "chain_index",
      order: "asc",
      filters: {
        created_at: {
          gte: input.period_start,
          lte: input.period_end,
        },
      },
    });
    if (!more.length) break;
    all = all.concat(more);
  }
  if (!all.length) throw new Error("No events in period to archive");

  const count = await crudCount("eal_archive_batches");
  const root =
    (all[all.length - 1].integrity_hash as string) || "EMPTY";
  const seal = hashPayload(
    `${root}|${all.length}|${input.period_start}|${input.period_end}|${input.company_id}`
  );
  const batch_number = `ARB-${String(count + 1).padStart(5, "0")}`;

  const batch = await mustCreate<Record<string, unknown>>(
    "eal_archive_batches",
    {
      batch_number,
      period_start: input.period_start,
      period_end: input.period_end,
      event_count: all.length,
      root_hash: root,
      storage_uri: `secure://eal-archive/${input.company_id}/${batch_number}`,
      encryption_algo: "AES-256-GCM",
      integrity_seal: seal,
      status: "sealed",
      sealed_by: input.sealed_by,
      notes: input.notes,
      metadata: { source: "hot_store", immutable: true },
    }
  );

  for (const e of all) {
    await mustCreate("eal_archived_events", {
      batch_id: batch.id,
      original_event_id: e.id,
      audit_id: e.audit_id,
      event_payload: e,
      integrity_hash: e.integrity_hash,
      chain_index: e.chain_index,
    });
  }

  await mustCreate("eal_config_history", {
    config_type: "archive",
    config_id: batch.id,
    action: "archive",
    actor_id: input.sealed_by,
    after_state: {
      batch_number: batch.batch_number,
      event_count: all.length,
      seal,
    },
    details: `Archived ${all.length} events`,
  });

  return batch;
}

export async function requestArchiveRetrieval(input: {
  company_id: string;
  batch_id: string;
  requested_by?: string | null;
  reason: string;
}) {
  if (!input.reason.trim())
    throw new Error("Business reason required for secure retrieval");

  return mustCreate("eal_archive_retrievals", {
    batch_id: input.batch_id,
    requested_by: input.requested_by,
    reason: input.reason,
    approval_status: "pending",
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  });
}

export async function approveArchiveRetrieval(input: {
  retrieval_id: string;
  approved_by?: string | null;
  approve: boolean;
}) {
  const status = input.approve ? "approved" : "denied";
  return mustUpdate("eal_archive_retrievals", input.retrieval_id, {
    approval_status: status,
    approved_by: input.approved_by,
  });
}

export async function fulfillArchiveRetrieval(input: {
  company_id: string;
  retrieval_id: string;
  fulfilled_by?: string | null;
}) {
  const ret = await crudGetOne<Record<string, unknown>>(
    "eal_archive_retrievals",
    input.retrieval_id
  );
  if (!ret) throw new Error("Retrieval not found");
  if (ret.approval_status !== "approved")
    throw new Error("Retrieval not approved");

  const archived = await mustList("eal_archived_events", {
    pageSize: 100,
    sort: "chain_index",
    order: "asc",
    filters: { batch_id: ret.batch_id },
  });

  const token = hashPayload(`${ret.id}|${Date.now()}`).slice(0, 16);

  await mustUpdate("eal_archive_retrievals", input.retrieval_id, {
    approval_status: "fulfilled",
    fulfilled_at: new Date().toISOString(),
    access_token_hint: token,
  });

  await mustCreate("eal_config_history", {
    config_type: "archive",
    config_id: ret.batch_id,
    action: "restore",
    actor_id: input.fulfilled_by,
    details: `Secure retrieval fulfilled · token ${token} · ${archived.length} events (read-only)`,
  });

  return {
    access_token_hint: token,
    events: archived,
  };
}
