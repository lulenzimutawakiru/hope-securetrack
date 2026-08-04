/**
 * Cloudflare Turnstile / generic CAPTCHA verify.
 */

import { providersConfig } from "../config";
import { providerFetch } from "../http";
import type { CaptchaVerifyInput, ProviderCallResult } from "../types";

export async function verifyCaptcha(
  input: CaptchaVerifyInput
): Promise<ProviderCallResult<{ success: boolean; hostname?: string }>> {
  const cfg = providersConfig.turnstile;

  // Dev bypass when not configured
  if (!cfg.configured) {
    if (process.env.NODE_ENV !== "production") {
      return {
        ok: true,
        provider: "turnstile",
        sandbox: true,
        data: { success: true, hostname: "localhost" },
      };
    }
    return {
      ok: false,
      provider: "turnstile",
      error: "CAPTCHA not configured",
    };
  }

  if (!input.token?.trim()) {
    return { ok: false, provider: "turnstile", error: "Missing captcha token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", cfg.secretKey);
    body.set("response", input.token);
    if (input.remoteIp) body.set("remoteip", input.remoteIp);

    const { res, json } = await providerFetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );

    const data = json as {
      success?: boolean;
      hostname?: string;
      "error-codes"?: string[];
    };

    if (res.ok && data.success) {
      return {
        ok: true,
        provider: "turnstile",
        data: { success: true, hostname: data.hostname },
        raw: json,
      };
    }

    return {
      ok: false,
      provider: "turnstile",
      status: res.status,
      error: (data["error-codes"] || []).join(",") || "Captcha failed",
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "turnstile",
      error: e instanceof Error ? e.message : "Captcha verify failed",
    };
  }
}
