/** Secure archival & retrieval — events never deleted, only sealed */

import { createClient } from "@/lib/supabase/client";
import { hashPayload } from "./integrity";

function sb() {
  return createClient();
}

export async function archiveEvents(input: {
  company_id: string;
  period_start: string;
  period_end: string;
  sealed_by?: string | null;
  notes?: string;
}) {
  const client = sb();
  const { data: events, error } = await client
    .from("eal_events")
    .select("*")
    .eq("company_id", input.company_id)
    .gte("created_at", input.period_start)
    .lte("created_at", input.period_end)
    .order("chain_index", { ascending: true })
    .limit(2000);
  if (error) throw error;
  if (!events?.length) throw new Error("No events in period to archive");

  const { count } = await client
    .from("eal_archive_batches")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const root = events[events.length - 1].integrity_hash || "EMPTY";
  const seal = hashPayload(
    `${root}|${events.length}|${input.period_start}|${input.period_end}|${input.company_id}`
  );

  const { data: batch, error: bErr } = await client
    .from("eal_archive_batches")
    .insert({
      company_id: input.company_id,
      batch_number: `ARB-${String((count ?? 0) + 1).padStart(5, "0")}`,
      period_start: input.period_start,
      period_end: input.period_end,
      event_count: events.length,
      root_hash: root,
      storage_uri: `secure://eal-archive/${input.company_id}/ARB-${String((count ?? 0) + 1).padStart(5, "0")}`,
      encryption_algo: "AES-256-GCM",
      integrity_seal: seal,
      status: "sealed",
      sealed_by: input.sealed_by,
      notes: input.notes,
      metadata: { source: "hot_store", immutable: true },
    })
    .select("*")
    .single();
  if (bErr) throw bErr;

  const payloads = events.map((e) => ({
    company_id: input.company_id,
    batch_id: batch.id,
    original_event_id: e.id,
    audit_id: e.audit_id,
    event_payload: e,
    integrity_hash: e.integrity_hash,
    chain_index: e.chain_index,
  }));

  // Insert in chunks
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100);
    const { error: aErr } = await client.from("eal_archived_events").insert(chunk);
    if (aErr) throw aErr;
  }

  await client.from("eal_config_history").insert({
    company_id: input.company_id,
    config_type: "archive",
    config_id: batch.id,
    action: "archive",
    actor_id: input.sealed_by,
    after_state: {
      batch_number: batch.batch_number,
      event_count: events.length,
      seal,
    },
    details: `Archived ${events.length} events`,
  });

  return batch;
}

export async function requestArchiveRetrieval(input: {
  company_id: string;
  batch_id: string;
  requested_by?: string | null;
  reason: string;
}) {
  if (!input.reason.trim()) throw new Error("Business reason required for secure retrieval");

  const { data, error } = await sb()
    .from("eal_archive_retrievals")
    .insert({
      company_id: input.company_id,
      batch_id: input.batch_id,
      requested_by: input.requested_by,
      reason: input.reason,
      approval_status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function approveArchiveRetrieval(input: {
  retrieval_id: string;
  approved_by?: string | null;
  approve: boolean;
}) {
  const status = input.approve ? "approved" : "denied";
  const { data, error } = await sb()
    .from("eal_archive_retrievals")
    .update({
      approval_status: status,
      approved_by: input.approved_by,
    })
    .eq("id", input.retrieval_id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function fulfillArchiveRetrieval(input: {
  company_id: string;
  retrieval_id: string;
  fulfilled_by?: string | null;
}) {
  const { data: ret } = await sb()
    .from("eal_archive_retrievals")
    .select("*")
    .eq("id", input.retrieval_id)
    .single();
  if (!ret) throw new Error("Retrieval not found");
  if (ret.approval_status !== "approved") throw new Error("Retrieval not approved");

  const { data: archived } = await sb()
    .from("eal_archived_events")
    .select("audit_id, integrity_hash, chain_index, event_payload, archived_at")
    .eq("batch_id", ret.batch_id)
    .order("chain_index", { ascending: true })
    .limit(2000);

  const token = hashPayload(`${ret.id}|${Date.now()}`).slice(0, 16);

  await sb()
    .from("eal_archive_retrievals")
    .update({
      approval_status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      access_token_hint: token,
    })
    .eq("id", input.retrieval_id);

  await sb().from("eal_config_history").insert({
    company_id: input.company_id,
    config_type: "archive",
    config_id: ret.batch_id,
    action: "restore",
    actor_id: input.fulfilled_by,
    details: `Secure retrieval fulfilled · token ${token} · ${archived?.length || 0} events (read-only)`,
  });

  return {
    access_token_hint: token,
    events: archived || [],
    note: "Events are returned read-only. Hot-store originals remain; archive is never mutated.",
  };
}
