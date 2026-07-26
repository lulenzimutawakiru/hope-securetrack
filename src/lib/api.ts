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

/** Simple in-memory rate limiter (per instance). For multi-region, use Redis/Upstash. */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(
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

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
