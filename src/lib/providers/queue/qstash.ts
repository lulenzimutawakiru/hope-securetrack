/**
 * Upstash QStash — durable external job dispatch for serverless.
 * Falls back to local job_queue when QStash is not configured.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { providersConfig } from "../config";
import { providerFetch } from "../http";
import type { ProviderCallResult } from "../types";

export async function qstashPublish(input: {
  url: string;
  body: Record<string, unknown>;
  delaySec?: number;
  retries?: number;
  headers?: Record<string, string>;
}): Promise<ProviderCallResult<{ messageId?: string }>> {
  const cfg = providersConfig.qstash;
  if (!cfg.configured) {
    return {
      ok: false,
      provider: "qstash",
      error: "QSTASH_TOKEN not configured — use local job_queue",
    };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      "Upstash-Retries": String(input.retries ?? 3),
      ...input.headers,
    };
    if (input.delaySec && input.delaySec > 0) {
      headers["Upstash-Delay"] = `${input.delaySec}s`;
    }

    const dest = encodeURIComponent(input.url);
    const { res, json, text } = await providerFetch(
      `${cfg.baseUrl}/v2/publish/${dest}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(input.body),
      }
    );

    const body = json as { messageId?: string; error?: string };
    if (res.ok && body.messageId) {
      return {
        ok: true,
        provider: "qstash",
        externalId: body.messageId,
        data: { messageId: body.messageId },
        raw: json,
      };
    }
    return {
      ok: false,
      provider: "qstash",
      status: res.status,
      error: body.error || text.slice(0, 200),
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "qstash",
      error: e instanceof Error ? e.message : "QStash publish failed",
    };
  }
}

/** Verify Upstash-Signature (simplified HMAC). */
export function verifyQstashSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const cfg = providersConfig.qstash;
  const keys = [cfg.currentSigningKey, cfg.nextSigningKey].filter(Boolean);
  if (!keys.length || !signatureHeader) return false;

  // Header format: "v1,timestamp=...,signatures=..."
  try {
    for (const key of keys) {
      const expected = createHmac("sha256", key)
        .update(rawBody)
        .digest("base64url");
      if (signatureHeader.includes(expected)) return true;
      // also try hex
      const hex = createHmac("sha256", key).update(rawBody).digest("hex");
      if (signatureHeader.includes(hex)) return true;
    }
    // Timing-safe fallback exact match of first signature segment
    const parts = signatureHeader.split(",");
    for (const p of parts) {
      for (const key of keys) {
        const expected = createHmac("sha256", key).update(rawBody).digest("hex");
        try {
          const a = Buffer.from(expected);
          const b = Buffer.from(p.trim());
          if (a.length === b.length && timingSafeEqual(a, b)) return true;
        } catch {
          /* continue */
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Enqueue worker URL via QStash when configured; otherwise no-op (caller uses job_queue).
 */
export async function scheduleWorkerPing(opts?: {
  baseUrl?: string;
  secret?: string;
}): Promise<ProviderCallResult<{ messageId?: string; mode: "qstash" | "local" }>> {
  const base =
    opts?.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!base) {
    return {
      ok: false,
      provider: "qstash",
      error: "No base URL",
      data: { mode: "local" },
    };
  }
  const secret = opts?.secret || process.env.JOB_WORKER_SECRET || process.env.CRON_SECRET || "";
  const url = `${base.replace(/\/$/, "")}/api/jobs/worker`;
  const r = await qstashPublish({
    url,
    body: { source: "qstash", at: new Date().toISOString() },
    headers: secret
      ? { "Upstash-Forward-Authorization": `Bearer ${secret}` }
      : undefined,
  });
  if (r.ok) {
    return {
      ...r,
      data: { messageId: r.data?.messageId, mode: "qstash" },
    };
  }
  return {
    ok: false,
    provider: "qstash",
    error: r.error,
    data: { mode: "local" },
  };
}
