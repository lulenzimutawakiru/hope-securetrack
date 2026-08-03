import type { NextRequest } from "next/server";

/**
 * Shared production rate-limiting primitives.
 *
 * - `getClientIpFromHeaders` resolves the real client IP with anti-spoofing:
 *   Vercel's trusted header first, proxy-set `x-real-ip` next, and finally the
 *   rightmost `x-forwarded-for` entry so clients cannot forge the leading value.
 * - `rateLimitRequest` is the distributed limiter: Upstash Redis REST when
 *   configured (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`), with an
 *   in-memory per-instance fallback so behavior stays safe on a single instance
 *   and degrades gracefully if Redis is unavailable.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  source: "memory" | "upstash";
}

/** In-memory fallback (per instance). Prefer Upstash when configured. */
const buckets = new Map<string, { count: number; reset: number }>();

export function getClientIpFromHeaders(headers: Headers): string {
  // Vercel injects the true client IP; trust it first.
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    return vercel.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  // Anti-spoof: when a trusted proxy appends to x-forwarded-for, the
  // client-supplied value is leftmost, so take the rightmost (nearest proxy).
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return "unknown";
}

export function clientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}

/** Cheap heuristic: a Supabase SSR session cookie is present. */
export function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => /^sb-[^-]+-auth-token$/.test(cookie.name));
}

export function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0, source: "memory" };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.reset - now) / 1000),
      source: "memory",
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
    source: "memory",
  };
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Distributed rate limit backed by Upstash Redis REST (fixed 60s/1min window
 * semantics via INCR + EXPIRE). Falls back to the in-memory limiter when Redis
 * is not configured or errors, unless `failClosed` is set (deny rather than
 * risk exceeding the configured limit).
 */
export async function rateLimitRequest(
  key: string,
  limit: number,
  windowMs: number,
  options?: { failClosed?: boolean }
): Promise<RateLimitResult> {
  const failClosed = options?.failClosed ?? false;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashConfigured()) {
    // Fail closed only when Redis is explicitly required.
    if (failClosed && process.env.RATE_LIMIT_REQUIRE_REDIS === "true") {
      return { allowed: false, remaining: 0, retryAfterSec: 60, source: "memory" };
    }
    return memoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${(url as string).replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token as string}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec],
      ]),
      // Bound the added middleware/route latency; on timeout fall back below.
      signal:
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(1500)
          : undefined,
    });
    if (!res.ok) {
      throw new Error(`Upstash responded ${res.status}`);
    }
    const data = (await res.json()) as Array<{ result?: number | string }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: windowSec,
        source: "upstash",
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSec: 0,
      source: "upstash",
    };
  } catch {
    if (failClosed) {
      return { allowed: false, remaining: 0, retryAfterSec: 60, source: "memory" };
    }
    return memoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Paths exempt from the coarse per-IP middleware limiter. These either have
 * their own signature verification (provider webhooks), dedicated route-level
 * limits, or are health/auth guards handled before session work.
 */
const API_RATE_LIMIT_EXEMPT_PREFIXES = [
  "/api/health",
  "/api/auth/login-guard",
  "/api/public/billing/webhook",
] as const;

export function isApiRateLimitExempt(pathname: string): boolean {
  return API_RATE_LIMIT_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}