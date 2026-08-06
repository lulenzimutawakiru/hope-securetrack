/**
 * Tenant identifier generation: TEN-<CC>-<YYYY>-<NNNNNN>.
 * Prefers the atomic SQL sequence (next_tenant_number); falls back to a
 * locally generated number when the RPC is unavailable (tests / local dev).
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function tenantNumberFallback(countryCode: string): string {
  const year = new Date().getFullYear();
  const cc = (countryCode || "UG").toUpperCase().slice(0, 5);
  const seq = Math.floor(Math.random() * 900_000) + 100_000;
  return `TEN-${cc}-${year}-${String(seq).padStart(6, "0")}`;
}

export async function nextTenantNumber(
  sb: SupabaseClient,
  countryCode?: string
): Promise<string> {
  const cc = (countryCode || "UG").toUpperCase().slice(0, 5);
  try {
    const { data, error } = await sb.rpc("next_tenant_number", {
      p_country_code: cc,
    });
    if (!error && typeof data === "string" && data.startsWith("TEN-")) {
      return data;
    }
  } catch {
    /* fall through to local generation */
  }
  return tenantNumberFallback(cc);
}

export function generateJobCode(): string {
  const y = new Date().getFullYear();
  const r = Math.floor(Math.random() * 900_000) + 100_000;
  return `PROV-${y}-${r}`;
}

export function generateApiKeyPrefix(): string {
  const rnd =
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 6);
  return `stk_${rnd.slice(0, 16)}`.toLowerCase();
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
