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
    // Vercel Cron requests carry `User-Agent: vercel-cron/1.0` and, when
    // CRON_SECRET is set on Vercel, an automatic `Authorization: Bearer`.
    // Accept genuine platform cron invocations even without a local secret;
    // otherwise fail closed in production (open only for local dev).
    if (isVercelCron(req)) return true;
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

function isVercelCron(req: NextRequest): boolean {
  return (
    /vercel-cron/i.test(req.headers.get("user-agent") || "") ||
    Boolean(req.headers.get("x-vercel-cron-schedule"))
  );
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
 * Drain queued external-channel notifications (deferred email, sms, push,
 * whatsapp). Email rows are re-enqueued as tenant-scoped `email.send` jobs;
 * channels without a configured provider are marked failed with an audit note
 * so they leave the queue instead of stalling forever.
 */
async function drainNotificationQueue(
  admin: ReturnType<typeof createAdminClient>
) {
  const now = new Date().toISOString();
  const { data: queued } = await admin
    .from("bi_notification_queue")
    .select("id, company_id, tenant_id, channel, recipient, subject, body, payload")
    .eq("status", "queued")
    .lte("scheduled_for", now)
    .limit(50);
  if (!queued?.length) return { drained: 0, enqueued: 0, failed: 0 };

  // Resolve tenant_id from companies (safety net; biq rows usually carry it).
  const companyIds = [
    ...new Set(queued.map((r) => r.company_id).filter(Boolean)),
  ] as string[];
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
  let failed = 0;
  for (const row of queued) {
    const companyId = (row.company_id as string | null) || null;
    const channel = String(row.channel || "email");

    if (channel === "email") {
      const tenantId =
        (row.tenant_id as string | null) ||
        (companyId ? tenantByCompany.get(companyId) : null) ||
        null;
      if (!tenantId) continue; // no resolvable tenant: leave queued (fail closed)
      const job = await enqueueJob(admin, {
        jobType: "email.send",
        companyId,
        tenantId,
        payload: {
          to: row.recipient || "",
          subject: row.subject || "SecureTrack notification",
          body: row.body || "",
          notification_id:
            (row.payload as { notification_id?: string } | null)
              ?.notification_id || null,
        },
        idempotencyKey: `biq:${row.id}`,
        priority: 60,
      });
      if (job?.id) {
        await admin
          .from("bi_notification_queue")
          .update({ status: "sent", tenant_id: tenantId, sent_at: now })
          .eq("id", row.id);
        enqueued += 1;
      }
      continue;
    }

    // sms / push / whatsapp — deliver via integrated providers
    if (["sms", "whatsapp", "push"].includes(channel)) {
      try {
        const { deliverExternalChannel } = await import(
          "@/lib/providers/comms/deliver"
        );
        const payload = (row.payload || {}) as Record<string, unknown>;
        const result = await deliverExternalChannel({
          companyId: companyId || "",
          channel,
          recipient: String(row.recipient || ""),
          subject: row.subject as string | null,
          body: row.body as string | null,
          notificationId: (payload.notification_id as string) || null,
          userId: (payload.user_id as string) || null,
          payload,
        });
        await admin
          .from("bi_notification_queue")
          .update({
            status: result.ok ? "sent" : "failed",
            error_message: result.ok ? null : result.error || "delivery failed",
            sent_at: now,
            tenant_id:
              (row.tenant_id as string | null) ||
              (companyId ? tenantByCompany.get(companyId) : null) ||
              null,
          })
          .eq("id", row.id);
        if (result.ok) {
          enqueued += 1;
          if (payload.notification_id) {
            await admin.from("notification_deliveries").insert({
              company_id: companyId,
              notification_id: payload.notification_id,
              channel,
              status: "sent",
              provider: result.provider,
              provider_message_id: result.externalId || null,
              sent_at: now,
            });
          }
        } else {
          failed += 1;
        }
      } catch (e) {
        await admin
          .from("bi_notification_queue")
          .update({
            status: "failed",
            error_message: e instanceof Error ? e.message : "channel error",
            sent_at: now,
          })
          .eq("id", row.id);
        failed += 1;
      }
      continue;
    }

    await admin
      .from("bi_notification_queue")
      .update({
        status: "failed",
        error_message: `No provider configured for channel ${channel}`,
        sent_at: now,
      })
      .eq("id", row.id);
    failed += 1;
  }

  return { drained: queued.length, enqueued, failed };
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
  const queueStats = await drainNotificationQueue(admin);

  // Flush SIEM outbox over HTTPS when connectors are configured
  let siemStats: { sent: number; failed?: number } = { sent: 0 };
  try {
    const { flushSiemOutbox } = await import("@/lib/audit/siem");
    siemStats = await flushSiemOutbox("");
  } catch {
    /* non-fatal */
  }


  // Scan for due report schedules and enqueue report.run jobs
  let scheduleStats: { due: number; enqueued: number; failed: number } = {
    due: 0,
    enqueued: 0,
    failed: 0,
  };
  try {
    const { scanDueSchedules } = await import("@/lib/reporting/schedule");
    scheduleStats = await scanDueSchedules(admin, { limit: 40 });
  } catch {
    /* non-fatal: schedules rescan next tick */
  }
  // Optional QStash self-schedule next worker tick
  if (process.env.QSTASH_AUTO_PING === "true") {
    try {
      const { scheduleWorkerPing } = await import(
        "@/lib/providers/queue/qstash"
      );
      await scheduleWorkerPing();
    } catch {
      /* ignore */
    }
  }

  const jobs = await claimJobs(admin, { limit, workerId });
  const stats = await processClaimedJobs(admin, jobs, handlers);

  return apiOk({
    worker_id: workerId,
    claimed: jobs.length,
    swept_emails: swept,
    notification_queue: queueStats,
    siem: siemStats,
    schedules: scheduleStats,
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
