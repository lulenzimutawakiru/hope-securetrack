import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
import {
  checkLoginGuardMemory,
  recordLoginFailureMemory,
  recordLoginSuccessMemory,
  verifyCaptchaToken,
  captchaConfigured,
} from "@/lib/security/login-guard";
import { correlationFromRequest } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  /** check | fail | success */
  event: z.enum(["check", "fail", "success"]).default("check"),
  captcha_token: z.string().optional().nullable(),
});

/**
 * Pre/post login guard for progressive lockout + CAPTCHA.
 * Does not authenticate — only abuse controls.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const correlationId = correlationFromRequest(req);
  const rl = await rateLimitStrict(`login-guard:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return apiError("RATE_LIMIT", "Too many requests", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const email = parsed.data.email;

  if (parsed.data.event === "success") {
    recordLoginSuccessMemory(email, ip);
    const res = apiOk({ allowed: true, captchaRequired: false });
    res.headers.set("x-correlation-id", correlationId);
    return res;
  }

  if (parsed.data.event === "fail") {
    const result = recordLoginFailureMemory(email, ip);
    const res = apiOk({
      ...result,
      captchaConfigured: captchaConfigured(),
    });
    res.headers.set("x-correlation-id", correlationId);
    return res;
  }

  // check
  let guard = checkLoginGuardMemory(email, ip);
  if (!guard.allowed) {
    const res = apiOk({
      ...guard,
      captchaConfigured: captchaConfigured(),
    });
    res.headers.set("x-correlation-id", correlationId);
    return res;
  }

  if (guard.captchaRequired || captchaConfigured()) {
    // If CAPTCHA is always configured, still only force after failures unless LOGIN_CAPTCHA_ALWAYS
    const always = process.env.LOGIN_CAPTCHA_ALWAYS === "true";
    if (always || guard.captchaRequired) {
      const cap = await verifyCaptchaToken(parsed.data.captcha_token, ip);
      if (!cap.ok) {
        guard = {
          allowed: false,
          reason: cap.error || "CAPTCHA required",
          captchaRequired: true,
        };
      }
    }
  }

  const res = apiOk({
    ...guard,
    captchaConfigured: captchaConfigured(),
    siteKey:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ||
      null,
  });
  res.headers.set("x-correlation-id", correlationId);
  return res;
}
