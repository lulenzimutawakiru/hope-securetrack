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
    // Fail closed in production; open only in non-production for local dev.
    return process.env.NODE_ENV !== "production";
  }
  const header =
    req.headers.get("x-job-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    // Prefer header auth; query secret is accepted only outside production.
    (process.env.NODE_ENV !== "production"
      ? req.nextUrl.searchParams.get("secret")
      : null) ||
    "";
  return Boolean(header) && header === secret;
}

/**
 * Re-enqueue queued outbox emails so they send once RESEND_API_KEY is present.
 * Idempotent: skips outboxes that already have a pending/running job.
 */
async function resweepOutboxEmails(admin: ReturnType<typeof createAdminClient>) {
  const { data: queued } = await admin
    .from("email_outbox")
    .select("id, company_id")
    .eq("status", "queued")
    .limit(50);
  if (!queued?.length) return 0;

  // Resolve tenant_id from companies (email_outbox has no tenant_id column).
  // Business jobs must stay tenant-scoped, so tenant_id is required before enqueue.
  const companyIds = [...new Set(queued.map((r) => r.company_id).filter(Boolean))] as string[];
  const tenantByCompany = new Map<string, string>();
  if (companyIds.length) {
    const { data: companies } = await admin
      .from("companies")
      .select("id, tenant_id")
      .in("id", companyIds);
    for (const c of companies || []) {
      if (c.tenant_id) tenantByCompany.set(c.id, c.tenant_id as string);
    }
  }

  let enqueued = 0;
  for (const row of queued) {
    const companyId = (row.company_id as string | null) || null;
    const tenantId = companyId ? tenantByCompany.get(companyId) : null;
    // Skip rows with no resolvable tenant (should not happen; fail closed).
    if (!tenantId) continue;
    const { data: existing } = await admin
      .from("job_queue")
      .select("id")
      .eq("job_type", "email.send")
      .in("status", ["pending", "running"])
      .eq("idempotency_key", `outbox:${row.id}`)
      .maybeSingle();
    if (existing?.id) continue;
    const job = await enqueueJob(admin, {
      jobType: "email.send",
      companyId,
      tenantId,
      payload: { outbox_id: row.id },
      idempotencyKey: `outbox:${row.id}`,
      priority: 50,
    });
    if (job) enqueued += 1;
  }
  return enqueued;
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

  // Sweep queued emails first so they are picked up once the provider key is set
  const swept = await resweepOutboxEmails(admin);

  const jobs = await claimJobs(admin, { limit, workerId });
  const stats = await processClaimedJobs(admin, jobs, handlers);

  return apiOk({
    worker_id: workerId,
    claimed: jobs.length,
    swept_emails: swept,
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
