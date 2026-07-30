import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "CONFIG"
  | "INTERNAL";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, details: details ?? undefined },
    },
    { status }
  );
}

export function parseJson<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { success: true, data: result.data };
}

/** In-memory fallback (per instance). Prefer Upstash when configured. */
const buckets = new Map<string, { count: number; reset: number }>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((bucket.reset - now) / 1000),
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
  };
}

/**
 * Rate limit with optional Upstash Redis REST backend.
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for multi-instance safety.
 * Synchronous API preserved for existing call sites; Upstash is best-effort async-primed cache.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  // Always apply memory first for immediate backpressure on this instance
  const local = memoryRateLimit(key, limit, windowMs);
  if (!local.allowed) return local;

  // Fire-and-forget distributed increment when Upstash is configured
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const redisKey = `rl:${key}`;
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    // Non-blocking: do not await — keep route handlers fast
    void fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec],
      ]),
    }).catch(() => {
      /* fail open to memory limit */
    });
  }

  return local;
}

/**
 * Strict async rate limit using Upstash when available (for public high-risk routes).
 * Falls back to memory if Redis is not configured.
 * When RATE_LIMIT_FAIL_CLOSED=true and Redis is required but unavailable, deny the request.
 */
export async function rateLimitStrict(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const failClosed =
    process.env.RATE_LIMIT_FAIL_CLOSED === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.RATE_LIMIT_REQUIRE_REDIS === "true");

  if (!url || !token) {
    if (failClosed && process.env.RATE_LIMIT_REQUIRE_REDIS === "true") {
      return { allowed: false, remaining: 0, retryAfterSec: 60 };
    }
    return memoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSec],
      ]),
    });
    if (!res.ok) {
      if (failClosed) {
        return { allowed: false, remaining: 0, retryAfterSec: windowSec };
      }
      return memoryRateLimit(key, limit, windowMs);
    }
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterSec: windowSec };
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSec: 0,
    };
  } catch {
    if (failClosed) {
      return { allowed: false, remaining: 0, retryAfterSec: 60 };
    }
    return memoryRateLimit(key, limit, windowMs);
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
