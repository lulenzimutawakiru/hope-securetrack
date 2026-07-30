/**
 * Secure token hashing for portal / device / invite secrets.
 * Store only hashes; present plaintext once to the user.
 */

import { timingSafeEqualString } from "./shared";

/** SHA-256 hex digest (browser + Node Web Crypto) */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compare plaintext token to stored hash (timing-safe) */
export async function verifyTokenHash(
  token: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash || !token) return false;
  const computed = await hashToken(token);
  return timingSafeEqualString(computed, hash);
}

/** Cryptographically strong portal/device token (32+ bytes hex) */
export function generateSecureToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolve a portal user by hashed token first, then plaintext fallback
 * during migration window. Prefer writing access_token_hash on create.
 */
export async function resolvePortalUserByToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: { from: (t: string) => any },
  token: string
): Promise<Record<string, unknown> | null> {
  const tokenHash = await hashToken(token);

  const { data: byHash } = await sb
    .from("bill_portal_users")
    .select(
      "id,company_id,customer_id,email,display_name,full_name,is_active,access_token,access_token_hash,customers(*)"
    )
    .eq("access_token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (byHash) return byHash as Record<string, unknown>;

  // Legacy plaintext fallback (migration window)
  const { data: byPlain } = await sb
    .from("bill_portal_users")
    .select(
      "id,company_id,customer_id,email,display_name,full_name,is_active,access_token,access_token_hash,customers(*)"
    )
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!byPlain) return null;

  // Opportunistic re-hash so subsequent lookups use hash only
  try {
    await sb
      .from("bill_portal_users")
      .update({ access_token_hash: tokenHash })
      .eq("id", byPlain.id);
  } catch {
    /* non-blocking */
  }

  return byPlain as Record<string, unknown>;
}
