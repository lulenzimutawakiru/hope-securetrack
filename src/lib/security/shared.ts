/**
 * Shared security utilities safe for client + server bundles.
 * Do NOT import next/headers or server-only modules here.
 */

/** True when payment sandbox / demo settlement is allowed */
export function isPaymentSandboxEnabled(): boolean {
  if (process.env.PAYMENT_SANDBOX === "true") return true;
  if (process.env.NODE_ENV !== "production" && process.env.PAYMENT_SANDBOX !== "false") {
    return true;
  }
  return false;
}

export function assertNotProductionSandbox(action: string) {
  if (process.env.NODE_ENV === "production" && process.env.PAYMENT_SANDBOX === "true") {
    if (process.env.ALLOW_PRODUCTION_SANDBOX !== "true") {
      throw new Error(
        `${action} blocked: PAYMENT_SANDBOX cannot be used in production without ALLOW_PRODUCTION_SANDBOX=true`
      );
    }
  }
}

export function safeInternalPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://") || t.includes("\\")) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(t) || /^\/javascript:/i.test(t)) return fallback;
  if (!/^\/[a-zA-Z0-9/_\-?=&%.]*$/.test(t)) return fallback;
  return t;
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "");
}

export function sanitizePostgrestFilter(input: string, maxLen = 80): string {
  return input
    .slice(0, maxLen)
    .replace(/[%_,.()"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const enc = new TextEncoder();
    const ba = enc.encode(a);
    const bb = enc.encode(b);
    if (ba.length !== bb.length) return false;
    let diff = 0;
    for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
    return diff === 0;
  } catch {
    return false;
  }
}
