/**
 * Idempotency key store for money / identity mutations.
 * Prefer DB table `api_idempotency_keys` (migration 00070); memory fallback for dev.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const memory = new Map<string, { status: number; body: unknown; exp: number }>();

export function readIdempotencyKey(req: Request): string | null {
  const k =
    req.headers.get("idempotency-key") ||
    req.headers.get("x-idempotency-key") ||
    "";
  const t = k.trim();
  if (!t || t.length < 8 || t.length > 128) return null;
  return t;
}

export async function getIdempotentResponse(
  sb: SupabaseClient | null,
  key: string,
  companyId: string
): Promise<{ status: number; body: unknown } | null> {
  const memKey = `${companyId}:${key}`;
  const hit = memory.get(memKey);
  if (hit && hit.exp > Date.now()) {
    return { status: hit.status, body: hit.body };
  }

  if (!sb) return null;
  try {
    const { data } = await sb
      .from("api_idempotency_keys")
      .select("response_status,response_body,expires_at")
      .eq("company_id", companyId)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return null;
    }
    return {
      status: Number(data.response_status || 200),
      body: data.response_body,
    };
  } catch {
    return null;
  }
}

export async function saveIdempotentResponse(
  sb: SupabaseClient | null,
  key: string,
  companyId: string,
  status: number,
  body: unknown,
  ttlHours = 24
): Promise<void> {
  const exp = Date.now() + ttlHours * 3600_000;
  memory.set(`${companyId}:${key}`, { status, body, exp });

  if (!sb) return;
  try {
    await sb.from("api_idempotency_keys").upsert(
      {
        company_id: companyId,
        idempotency_key: key,
        response_status: status,
        response_body: body,
        expires_at: new Date(exp).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,idempotency_key" }
    );
  } catch {
    /* non-blocking */
  }
}
