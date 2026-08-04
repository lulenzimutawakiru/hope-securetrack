/**
 * Secure token hashing for portal / device / invite secrets.
 * Store only hashes; present plaintext once to the user.
 */

import { timingSafeEqualString } from "./shared";

/**
 * Plaintext token storage/lookup is forbidden in production.
 * Dev/test only when ALLOW_PLAINTEXT_TOKENS=true (default off in production;
 * default on only when NODE_ENV is not production AND not explicitly disabled).
 */
function storePlaintextSecrets(): boolean {
  if (process.env.ALLOW_PLAINTEXT_TOKENS === "false") return false;
  if (process.env.ALLOW_PLAINTEXT_TOKENS === "true") {
    // Even with allow flag, never store plaintext in production
    return process.env.NODE_ENV !== "production";
  }
  if (process.env.NODE_ENV === "production") return false;
  // Non-production: allow legacy migration path unless disabled
  return process.env.ALLOW_PLAINTEXT_TOKENS !== "0";
}

/** Plaintext lookup is never allowed in production (no migration escape hatch). */
function allowPlaintextLookup(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_TOKEN_PLAINTEXT_LOOKUP === "false") return false;
  if (process.env.ALLOW_TOKEN_PLAINTEXT_LOOKUP === "true") return true;
  return storePlaintextSecrets();
}

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
 *
 * On plaintext match: store hash and clear plaintext in production so secrets
 * are not retained at rest after first use.
 */
export async function resolvePortalUserByToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: { from: (t: string) => any },
  token: string
): Promise<Record<string, unknown> | null> {
  if (!token || token.length < 16 || token.length > 256) return null;

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

  // Legacy plaintext fallback — blocked in production (see allowPlaintextLookup)
  if (!allowPlaintextLookup()) {
    return null;
  }

  const { data: byPlain } = await sb
    .from("bill_portal_users")
    .select(
      "id,company_id,customer_id,email,display_name,full_name,is_active,access_token,access_token_hash,customers(*)"
    )
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!byPlain) return null;

  // Opportunistic re-hash + clear plaintext at rest when possible
  try {
    const patch: Record<string, unknown> = { access_token_hash: tokenHash };
    if (!storePlaintextSecrets()) {
      patch.access_token = null;
    }
    await sb.from("bill_portal_users").update(patch).eq("id", byPlain.id);
  } catch {
    /* non-blocking — column may not allow null */
  }

  return byPlain as Record<string, unknown>;
}
