/**
 * Tenant-aware feature flags — server + client safe evaluation.
 * DB: platform_feature_flags + tenant_feature_flags (provision seeds defaults).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type FlagMap = Record<string, boolean>;

/** Built-in flags used by SecureTrack hardening (defaults) */
export const DEFAULT_FLAGS: FlagMap = {
  "ai.copilot": true,
  "security.mfa_privileged": true,
  "security.dual_control": true,
  "payroll.server_mutations": true,
  "finance.server_gl_post": true,
  "jobs.durable_queue": true,
  "portal.token_hash": true,
  "ux.command_palette": true,
  "ux.dark_mode": true,
  "integrations.webhooks": true,
};

const cache = new Map<string, { flags: FlagMap; exp: number }>();

export async function resolveFeatureFlags(
  sb: SupabaseClient,
  tenantId?: string | null
): Promise<FlagMap> {
  const cacheKey = tenantId || "__platform__";
  const hit = cache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.flags;

  const flags: FlagMap = { ...DEFAULT_FLAGS };

  try {
    const { data: platform } = await sb
      .from("platform_feature_flags")
      .select("flag_key,default_enabled");
    for (const row of platform || []) {
      flags[String(row.flag_key)] = Boolean(row.default_enabled);
    }
  } catch {
    /* table may lag */
  }

  if (tenantId) {
    try {
      const { data: tenant } = await sb
        .from("tenant_feature_flags")
        .select("flag_key,enabled")
        .eq("tenant_id", tenantId);
      for (const row of tenant || []) {
        flags[String(row.flag_key)] = Boolean(row.enabled);
      }
    } catch {
      /* ignore */
    }
  }

  // Env hard overrides (ops kill-switches)
  if (process.env.SECURETRACK_AI_DISABLED === "true") flags["ai.copilot"] = false;
  if (process.env.DUAL_CONTROL_REQUIRED === "true") {
    flags["security.dual_control"] = true;
  }
  if (process.env.MFA_ENFORCE_PRIVILEGED === "true") {
    flags["security.mfa_privileged"] = true;
  }

  cache.set(cacheKey, { flags, exp: Date.now() + 30_000 });
  return flags;
}

export function isFlagEnabled(flags: FlagMap, key: string, fallback = false): boolean {
  if (key in flags) return Boolean(flags[key]);
  if (key in DEFAULT_FLAGS) return DEFAULT_FLAGS[key];
  return fallback;
}

export function clearFlagCache() {
  cache.clear();
}
