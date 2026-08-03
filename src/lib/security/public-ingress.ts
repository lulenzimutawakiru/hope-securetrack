/**
 * Shared helpers for unauthenticated / device / webhook ingress.
 * Prefer rateLimitStrict (Upstash when configured) over memory-only limits.
 */

import { NextResponse } from "next/server";
import { clientIp, rateLimitStrict } from "@/lib/api";

export type IngressRateLimitResult =
  | { ok: true; ip: string; remaining: number }
  | { ok: false; response: NextResponse };

/**
 * Distributed rate limit for public/device paths.
 * Fail-closed when Redis is required in production (RATE_LIMIT_REQUIRE_REDIS).
 */
export async function ingressRateLimit(
  bucket: string,
  limit: number,
  windowMs = 60_000,
  req?: Request
): Promise<IngressRateLimitResult> {
  const ip = req ? clientIp(req) : "unknown";
  const rl = await rateLimitStrict(`${bucket}:${ip}`, limit, windowMs);
  if (!rl.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, rl.retryAfterSec || 60)),
          },
        }
      ),
    };
  }
  return { ok: true, ip, remaining: rl.remaining };
}

/** Extract device/push token from query, headers, or Authorization Bearer. */
export function extractDeviceToken(req: {
  nextUrl?: { searchParams: URLSearchParams };
  headers: Headers;
  url?: string;
}): string {
  const fromQuery =
    req.nextUrl?.searchParams.get("token") ||
    req.nextUrl?.searchParams.get("key") ||
    "";
  if (fromQuery) return fromQuery.trim();
  const header =
    req.headers.get("x-device-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return header.trim();
}

/** Reject obviously invalid token shapes early (DoS / filter injection). */
export function isPlausibleSecretToken(token: string): boolean {
  if (!token || token.length < 16 || token.length > 256) return false;
  // Hex or URL-safe base64-ish only
  return /^[A-Za-z0-9_\-+=/.]+$/.test(token);
}

/**
 * Whether to persist plaintext secrets at rest.
 * Production defaults to hash-only unless ALLOW_PLAINTEXT_TOKENS=true.
 */
export function storePlaintextSecrets(): boolean {
  if (process.env.ALLOW_PLAINTEXT_TOKENS === "true") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}
