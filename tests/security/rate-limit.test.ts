import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  getClientIpFromHeaders,
  hasSupabaseSessionCookie,
  isApiRateLimitExempt,
  memoryRateLimit,
  rateLimitRequest,
} from "@/lib/security/rate-limit";

describe("getClientIpFromHeaders", () => {
  it("prefers Vercel's trusted forwarded header", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 203.0.113.7",
      "x-real-ip": "198.51.100.2",
    });
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.2" });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.2");
  });

  it("uses the rightmost x-forwarded-for entry to defeat client spoofing", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 198.51.100.2",
    });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.2");
  });

  it("returns unknown when no client headers exist", () => {
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("hasSupabaseSessionCookie", () => {
  it("detects the SSR auth session cookie", () => {
    const req = new NextRequest("https://app.example/api/x", {
      headers: { cookie: "sb-abcdef-auth-token=abc.def.ghi; theme=dark" },
    });
    expect(hasSupabaseSessionCookie(req)).toBe(true);
  });

  it("returns false without a session cookie", () => {
    const req = new NextRequest("https://app.example/api/x", {
      headers: { cookie: "theme=dark" },
    });
    expect(hasSupabaseSessionCookie(req)).toBe(false);
  });
});

describe("isApiRateLimitExempt", () => {
  it("exempts health, login guard and the provider webhook", () => {
    expect(isApiRateLimitExempt("/api/health")).toBe(true);
    expect(isApiRateLimitExempt("/api/auth/login-guard")).toBe(true);
    expect(isApiRateLimitExempt("/api/public/billing/webhook")).toBe(true);
  });

  it("does not exempt ordinary API routes", () => {
    expect(isApiRateLimitExempt("/api/payroll/process")).toBe(false);
    expect(isApiRateLimitExempt("/api/public/verify")).toBe(false);
    expect(isApiRateLimitExempt("/api/attendance/devices")).toBe(false);
  });
});

describe("memoryRateLimit", () => {
  it("allows up to the limit and rejects beyond it", () => {
    const limit = 3;
    const windowMs = 60_000;
    const key = `mem-test-${Date.now()}`;
    expect(memoryRateLimit(key, limit, windowMs).allowed).toBe(true);
    expect(memoryRateLimit(key, limit, windowMs).allowed).toBe(true);
    expect(memoryRateLimit(key, limit, windowMs).allowed).toBe(true);
    const denied = memoryRateLimit(key, limit, windowMs);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("rateLimitRequest", () => {
  it("falls back to memory when Upstash is not configured", async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const required = process.env.RATE_LIMIT_REQUIRE_REDIS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.RATE_LIMIT_REQUIRE_REDIS;
    try {
      const res = await rateLimitRequest(`rl-test-${Date.now()}`, 5, 60_000);
      expect(res.allowed).toBe(true);
      expect(res.source).toBe("memory");
    } finally {
      if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url;
      if (token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = token;
      if (required !== undefined) process.env.RATE_LIMIT_REQUIRE_REDIS = required;
    }
  });

  it("fails closed when Redis is required but missing", async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.RATE_LIMIT_REQUIRE_REDIS = "true";
    try {
      const res = await rateLimitRequest(`rl-fc-${Date.now()}`, 5, 60_000, {
        failClosed: true,
      });
      expect(res.allowed).toBe(false);
    } finally {
      if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url;
      if (token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = token;
      delete process.env.RATE_LIMIT_REQUIRE_REDIS;
    }
  });
});