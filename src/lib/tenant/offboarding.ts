/**
 * Tenant offboarding: legal hold, export package, and staged purge.
 * Destructive purge requires platform elevation + dual-control outside this module.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/observability/logger";

export type OffboardPhase =
  | "legal_hold"
  | "export"
  | "anonymize"
  | "purge_scheduled"
  | "purged"
  | "cancelled";

export type OffboardRequest = {
  tenantId: string;
  requestedBy: string;
  reason: string;
  legalHold?: boolean;
  /** Days to retain after export before purge (default 30) */
  retainDays?: number;
};

export type OffboardStatus = {
  tenant_id: string;
  phase: OffboardPhase;
  legal_hold: boolean;
  export_path: string | null;
  purge_after: string | null;
  requested_by: string;
  reason: string;
  updated_at: string;
};

/**
 * Place or clear legal hold — blocks purge jobs.
 */
export async function setLegalHold(
  sb: SupabaseClient,
  tenantId: string,
  hold: boolean,
  actorId: string
): Promise<void> {
  const { error } = await sb.from("tenant_offboarding").upsert(
    {
      tenant_id: tenantId,
      phase: hold ? "legal_hold" : "export",
      legal_hold: hold,
      requested_by: actorId,
      reason: hold ? "legal_hold_enabled" : "legal_hold_cleared",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
  if (error) {
    // Table may not exist yet — surface clearly
    throw new Error(
      `Legal hold update failed: ${error.message}. Apply migration tenant_offboarding.`
    );
  }
  log.info("tenant.legal_hold", {
    tenantId,
    hold,
    actorId,
    module: "tenant",
  });
}

/**
 * Schedule offboarding: export snapshot metadata + purge_after date.
 * Does not delete data.
 */
export async function scheduleOffboarding(
  sb: SupabaseClient,
  req: OffboardRequest
): Promise<OffboardStatus> {
  const retain = Math.max(7, req.retainDays ?? 30);
  const purgeAfter = new Date(
    Date.now() + retain * 24 * 60 * 60 * 1000
  ).toISOString();

  if (req.legalHold) {
    await setLegalHold(sb, req.tenantId, true, req.requestedBy);
  }

  // Count companies under tenant for export manifest
  const { data: companies, error: cErr } = await sb
    .from("companies")
    .select("id,name,code")
    .eq("tenant_id", req.tenantId);

  if (cErr) throw new Error(cErr.message);

  const exportManifest = {
    tenant_id: req.tenantId,
    exported_at: new Date().toISOString(),
    companies: companies || [],
    note: "Full data dump is produced by platform export job; this is the control-plane record.",
  };

  const exportPath = `exports/tenants/${req.tenantId}/${Date.now()}-manifest.json`;

  const row = {
    tenant_id: req.tenantId,
    phase: "export" as OffboardPhase,
    legal_hold: Boolean(req.legalHold),
    export_path: exportPath,
    export_manifest: exportManifest,
    purge_after: purgeAfter,
    requested_by: req.requestedBy,
    reason: req.reason.slice(0, 2000),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("tenant_offboarding")
    .upsert(row, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Offboarding schedule failed: ${error.message}. Apply migration tenant_offboarding.`
    );
  }

  // Best-effort: store manifest object if storage available
  try {
    await sb.storage
      .from("tenant-exports")
      .upload(exportPath, JSON.stringify(exportManifest, null, 2), {
        contentType: "application/json",
        upsert: true,
      });
  } catch {
    /* bucket may not exist yet */
  }

  log.info("tenant.offboard_scheduled", {
    tenantId: req.tenantId,
    purgeAfter,
    actorId: req.requestedBy,
    module: "tenant",
  });

  return data as OffboardStatus;
}

/**
 * Mark purge eligible only when legal hold is off and purge_after has passed.
 * Actual destructive purge is a separate elevated job.
 */
export async function markPurgeEligible(
  sb: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row } = await sb
    .from("tenant_offboarding")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!row) return { ok: false, error: "No offboarding record" };
  if (row.legal_hold) return { ok: false, error: "Legal hold active" };
  if (row.purge_after && new Date(row.purge_after) > new Date()) {
    return { ok: false, error: "Retention period not elapsed" };
  }

  const { error } = await sb
    .from("tenant_offboarding")
    .update({
      phase: "purge_scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Pure helpers for unit tests */
export function canPurge(row: {
  legal_hold?: boolean;
  purge_after?: string | null;
  phase?: string;
}): { ok: true } | { ok: false; error: string } {
  if (row.legal_hold) return { ok: false, error: "Legal hold active" };
  if (row.phase === "purged") return { ok: false, error: "Already purged" };
  if (row.phase === "cancelled") return { ok: false, error: "Offboarding cancelled" };
  if (row.purge_after && new Date(row.purge_after) > new Date()) {
    return { ok: false, error: "Retention period not elapsed" };
  }
  return { ok: true };
}
