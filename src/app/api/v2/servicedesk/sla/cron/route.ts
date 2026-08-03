/**
 * SLA / escalation cron endpoint.
 *
 *   POST /api/v2/servicedesk/sla/cron  -- scan open tickets, mark breaches,
 *                                         escalate, enqueue notifications
 *   GET  /api/v2/servicedesk/sla/cron  -- same (Vercel Cron uses GET by default)
 *
 * Auth: CRON_SECRET or JOB_WORKER_SECRET (Authorization Bearer / x-job-secret).
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, clientIp, rateLimitStrict } from "@/lib/api";
import { runSlaEscalationScan } from "@/lib/service-desk/sla-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.JOB_WORKER_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header =
    req.headers.get("x-job-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    (process.env.NODE_ENV !== "production"
      ? req.nextUrl.searchParams.get("secret")
      : null) ||
    "";
  return Boolean(header) && header === secret;
}

async function run(req: NextRequest) {
  if (!authorizeCron(req)) {
    return apiError("UNAUTHORIZED", "Invalid cron secret", 401);
  }

  const ip = clientIp(req);
  const rl = await rateLimitStrict(`sd-sla-cron:${ip}`, 20, 60_000);
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const companyId = req.nextUrl.searchParams.get("company_id") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") || "200") || 200;
  const admin = createAdminClient();
  const result = await runSlaEscalationScan(admin, { companyId, limit });

  return apiOk({
    ok: true,
    at: new Date().toISOString(),
    ...result,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
