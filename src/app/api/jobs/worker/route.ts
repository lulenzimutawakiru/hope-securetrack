import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimJobs,
  defaultJobHandlers,
  processClaimedJobs,
  enqueueJob,
} from "@/lib/jobs/queue";
import {
  serverProcessPayrollRun,
} from "@/lib/payroll/server-ops";
import { apiError, apiOk, clientIp, rateLimitStrict } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorizeWorker(req: NextRequest): boolean {
  const secret = process.env.JOB_WORKER_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    // Dev-only open worker when not production
    return process.env.NODE_ENV !== "production";
  }
  const header =
    req.headers.get("x-job-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.nextUrl.searchParams.get("secret") ||
    "";
  return header === secret;
}

/**
 * Process durable job queue (cron / platform worker).
 * Auth: JOB_WORKER_SECRET or CRON_SECRET header.
 */
export async function POST(req: NextRequest) {
  if (!authorizeWorker(req)) {
    return apiError("UNAUTHORIZED", "Invalid worker secret", 401);
  }

  const ip = clientIp(req);
  const rl = await rateLimitStrict(`job-worker:${ip}`, 30, 60_000);
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const limit = Math.min(
    50,
    Number(req.nextUrl.searchParams.get("limit") || 10) || 10
  );
  const workerId = `worker-${process.pid}-${Date.now().toString(36)}`;
  const admin = createAdminClient();

  const handlers = defaultJobHandlers({ admin });
  handlers["payroll.async_process"] = async (job) => {
    try {
      const companyId = String(job.company_id || job.payload?.company_id || "");
      if (!companyId) return { ok: false, error: "missing company_id" };
      await serverProcessPayrollRun({
        company_id: companyId,
        created_by: (job.payload?.actor_id as string) || null,
        country_code: job.payload?.country_code as string | undefined,
        currency: job.payload?.currency as string | undefined,
        pay_group: job.payload?.pay_group as string | undefined,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "payroll failed" };
    }
  };

  const jobs = await claimJobs(admin, { limit, workerId });
  const stats = await processClaimedJobs(admin, jobs, handlers);

  return apiOk({
    worker_id: workerId,
    claimed: jobs.length,
    ...stats,
  });
}

/** Health / enqueue diagnostic (authenticated by secret) */
export async function GET(req: NextRequest) {
  if (!authorizeWorker(req)) {
    return apiError("UNAUTHORIZED", "Invalid worker secret", 401);
  }
  const admin = createAdminClient();
  const { count: pending } = await admin
    .from("job_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: dead } = await admin
    .from("job_dead_letters")
    .select("*", { count: "exact", head: true });

  // Optional smoke enqueue
  if (req.nextUrl.searchParams.get("ping") === "1") {
    await enqueueJob(admin, {
      jobType: "generic",
      payload: { ping: true, at: new Date().toISOString() },
      idempotencyKey: `ping:${new Date().toISOString().slice(0, 13)}`,
    });
  }

  return apiOk({ pending: pending ?? 0, dead_letters: dead ?? 0 });
}
