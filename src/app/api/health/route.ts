import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/env";

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

  const healthy = envCheck.ok && supabaseOk;
  const body = {
    status: healthy ? "healthy" : "degraded",
    service: "hope-securetrack",
    version: process.env.npm_package_version || "1.0.0",
    time: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    checks: {
      env: {
        ok: envCheck.ok,
        missing: envCheck.missing,
      },
      supabase: {
        ok: supabaseOk,
        latencyMs: supabaseLatencyMs,
        error: supabaseError,
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
