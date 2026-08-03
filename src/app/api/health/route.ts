import { NextResponse } from "next/server";
import { assertServerEnv, env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  const envCheck = assertServerEnv();
  let supabaseOk = false;
  let supabaseLatencyMs: number | null = null;
  let supabaseError: string | null = null;

  if (envCheck.ok) {
    try {
      const t0 = Date.now();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companies?select=id&limit=1`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
          cache: "no-store",
        }
      );
      supabaseLatencyMs = Date.now() - t0;
      supabaseOk = res.ok || res.status === 200 || res.status === 206;
      if (!res.ok) supabaseError = `HTTP ${res.status}`;
    } catch (e) {
      supabaseError = e instanceof Error ? e.message : "unreachable";
    }
  }

  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const redisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  const aiConfigured = Boolean(
    process.env.SECURETRACK_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.XAI_API_KEY
  );
  const workerSecretConfigured = Boolean(
    process.env.JOB_WORKER_SECRET || process.env.CRON_SECRET
  );
  const mfaEnforce = env.security.mfaEnforcePrivileged;
  const dualControl = env.security.dualControlRequired;
  const paymentSandbox = process.env.PAYMENT_SANDBOX === "true";

  const healthy = envCheck.ok && supabaseOk;
  const body = {
    status: healthy ? "healthy" : "degraded",
    service: "securetrack-erp",
    version: process.env.npm_package_version || "1.0.0",
    time: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    checks: {
      env: {
        ok: envCheck.ok,
        // Do not list missing secret names publicly — only count
        missingCount: envCheck.missing?.length ?? 0,
      },
      supabase: {
        ok: supabaseOk,
        latencyMs: supabaseLatencyMs,
        // Avoid leaking internal error detail to unauthenticated clients
        error: supabaseOk ? null : "unreachable",
      },
      resend: {
        ok: resendConfigured,
        configured: resendConfigured,
      },
      /** Feature posture flags (no secret values) */
      platform: {
        redisRateLimit: redisConfigured,
        aiCopilot: aiConfigured && process.env.SECURETRACK_AI_DISABLED !== "true",
        jobWorkerSecret: workerSecretConfigured,
        mfaEnforcePrivileged: mfaEnforce,
        dualControlRequired: dualControl,
        paymentSandbox,
        productionSafe:
          process.env.NODE_ENV === "production"
            ? !paymentSandbox && mfaEnforce && dualControl && redisConfigured
            : null,
      },
    },
    durationMs: Date.now() - started,
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
