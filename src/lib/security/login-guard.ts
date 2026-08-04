/**
 * Login abuse protection: progressive lockout + optional CAPTCHA (Turnstile/hCaptcha).
 * Server-authoritative; client only displays challenges.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginGuardResult =
  | { allowed: true; captchaRequired: boolean; remainingAttempts?: number }
  | { allowed: false; reason: string; retryAfterSec?: number; captchaRequired: boolean };

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_THRESHOLD = 5;
const CAPTCHA_AFTER = 3;

/** In-memory fallback keyed by email+ip */
const attempts = new Map<string, { count: number; first: number; lockedUntil?: number }>();

function key(email: string, ip: string) {
  return `${email.toLowerCase().trim()}|${ip}`;
}

export function recordLoginFailureMemory(email: string, ip: string): LoginGuardResult {
  const k = key(email, ip);
  const now = Date.now();
  let row = attempts.get(k);
  if (!row || now - row.first > WINDOW_MS) {
    row = { count: 0, first: now };
  }
  if (row.lockedUntil && row.lockedUntil > now) {
    return {
      allowed: false,
      reason: "Account temporarily locked due to failed sign-in attempts",
      retryAfterSec: Math.ceil((row.lockedUntil - now) / 1000),
      captchaRequired: true,
    };
  }
  row.count += 1;
  if (row.count >= LOCK_THRESHOLD) {
    row.lockedUntil = now + WINDOW_MS;
    attempts.set(k, row);
    return {
      allowed: false,
      reason: "Too many failed attempts — try again later",
      retryAfterSec: Math.ceil(WINDOW_MS / 1000),
      captchaRequired: true,
    };
  }
  attempts.set(k, row);
  return {
    allowed: true,
    captchaRequired: row.count >= CAPTCHA_AFTER,
    remainingAttempts: Math.max(0, LOCK_THRESHOLD - row.count),
  };
}

export function recordLoginSuccessMemory(email: string, ip: string) {
  attempts.delete(key(email, ip));
}

export function checkLoginGuardMemory(email: string, ip: string): LoginGuardResult {
  const k = key(email, ip);
  const now = Date.now();
  const row = attempts.get(k);
  if (!row) return { allowed: true, captchaRequired: false };
  if (row.lockedUntil && row.lockedUntil > now) {
    return {
      allowed: false,
      reason: "Account temporarily locked due to failed sign-in attempts",
      retryAfterSec: Math.ceil((row.lockedUntil - now) / 1000),
      captchaRequired: true,
    };
  }
  if (now - row.first > WINDOW_MS) {
    attempts.delete(k);
    return { allowed: true, captchaRequired: false };
  }
  return {
    allowed: true,
    captchaRequired: row.count >= CAPTCHA_AFTER,
    remainingAttempts: Math.max(0, LOCK_THRESHOLD - row.count),
  };
}

export function captchaConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY ||
      process.env.CAPTCHA_SECRET_KEY ||
      process.env.HCAPTCHA_SECRET_KEY ||
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY ||
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY
  );
}

/** Verify Turnstile or hCaptcha token when secrets configured */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  ip?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!captchaConfigured()) return { ok: true }; // not required
  if (!token) return { ok: false, error: "CAPTCHA required" };

  const turnstile =
    process.env.TURNSTILE_SECRET_KEY || process.env.CAPTCHA_SECRET_KEY;
  if (turnstile) {
    try {
      const res = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            secret: turnstile,
            response: token,
            ...(ip ? { remoteip: ip } : {}),
          }),
        }
      );
      const json = (await res.json()) as { success?: boolean };
      return json.success ? { ok: true } : { ok: false, error: "CAPTCHA failed" };
    } catch {
      return { ok: false, error: "CAPTCHA verification error" };
    }
  }

  const hcaptcha = process.env.HCAPTCHA_SECRET_KEY;
  if (hcaptcha) {
    try {
      const res = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: hcaptcha,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });
      const json = (await res.json()) as { success?: boolean };
      return json.success ? { ok: true } : { ok: false, error: "CAPTCHA failed" };
    } catch {
      return { ok: false, error: "CAPTCHA verification error" };
    }
  }

  return { ok: true };
}

/** Persist attempt to auth_login_events if available */
export async function persistLoginAttempt(
  sb: SupabaseClient,
  input: {
    email: string;
    success: boolean;
    ip?: string;
    userAgent?: string;
    userId?: string | null;
    reason?: string;
  }
) {
  try {
    await sb.rpc("record_login_event", {
      p_user_id: input.userId || null,
      p_email: input.email,
      p_success: input.success,
      p_failure_reason: input.reason || null,
      p_ip: input.ip || null,
      p_user_agent: input.userAgent || null,
    });
  } catch {
    /* non-blocking */
  }
}
