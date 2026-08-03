import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getClientIpFromHeaders,
  memoryRateLimit,
  rateLimitRequest,
} from "@/lib/security/rate-limit";

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
  const failClosed =
    process.env.RATE_LIMIT_FAIL_CLOSED === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.RATE_LIMIT_REQUIRE_REDIS === "true");
  return rateLimitRequest(key, limit, windowMs, { failClosed });
}

export function clientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}