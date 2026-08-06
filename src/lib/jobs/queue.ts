/**
 * Durable job queue with retry + dead-letter support.
 * Enqueue from app code; process via /api/jobs/worker (cron / platform worker).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobType =
  | "notification.dispatch"
  | "email.send"
  | "webhook.deliver"
  | "siem.forward"
  | "payroll.async_process"
  | "servicedesk.sla_scan"
  | "report.run"
  | "domain_event.consume"
  | "import.batch"
  | "generic";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "dead";

export type EnqueueInput = {
  companyId?: string | null;
  tenantId?: string | null;
  jobType: JobType | string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  runAfter?: Date | string | null;
  idempotencyKey?: string | null;
  priority?: number;
};

/**
 * Require tenant_id + company_id on every business job (P0 isolation).
 * Platform-only jobs may set companyId null with explicit allowGlobal.
 */
export function assertJobTenantScope(
  input: EnqueueInput,
  opts?: { allowGlobal?: boolean }
): void {
  if (opts?.allowGlobal) return;
  if (!input.tenantId || !input.companyId) {
    throw new Error(
      "Job rejected: tenant_id and company_id required for tenant-scoped workers"
    );
  }
}

export async function enqueueJob(
  sb: SupabaseClient,
  input: EnqueueInput
): Promise<{ id: string } | null> {
  // Prefer fail closed for business jobs; system pings may omit company
  if (
    input.jobType !== "generic" &&
    input.jobType !== "domain_event.consume"
  ) {
    try {
      assertJobTenantScope(input);
    } catch (e) {
      console.error("[jobs] tenant scope", e);
      return null;
    }
  }

  if (input.idempotencyKey) {
    const { data: existing } = await sb
      .from("job_queue")
      .select("id,status")
      .eq("idempotency_key", input.idempotencyKey)
      .in("status", ["pending", "running", "completed"])
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string };
  }

  const payload = {
    ...(input.payload || {}),
    // Echo scope into payload so workers double-check
    _tenant_id: input.tenantId || null,
    _company_id: input.companyId || null,
  };

  const { data, error } = await sb
    .from("job_queue")
    .insert({
      company_id: input.companyId || null,
      tenant_id: input.tenantId || null,
      job_type: input.jobType,
      payload,
      status: "pending",
      attempts: 0,
      max_attempts: input.maxAttempts ?? 5,
      run_after: input.runAfter
        ? new Date(input.runAfter).toISOString()
        : new Date().toISOString(),
      idempotency_key: input.idempotencyKey || null,
      priority: input.priority ?? 100,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[jobs] enqueue failed", error.message);
    return null;
  }
  return { id: data.id as string };
}

export type JobRow = {
  id: string;
  company_id?: string | null;
  tenant_id?: string | null;
  job_type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  run_after?: string;
  last_error?: string | null;
};

/**
 * Claim up to `limit` pending jobs using status transition (optimistic lock).
 */
export async function claimJobs(
  sb: SupabaseClient,
  opts: { limit?: number; workerId: string }
): Promise<JobRow[]> {
  const limit = opts.limit ?? 10;
  const now = new Date().toISOString();

  const { data: candidates, error } = await sb
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !candidates?.length) return [];

  const claimed: JobRow[] = [];
  for (const row of candidates) {
    const { data: updated } = await sb
      .from("job_queue")
      .update({
        status: "running",
        locked_at: now,
        locked_by: opts.workerId,
        attempts: Number(row.attempts || 0) + 1,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updated) claimed.push(updated as JobRow);
  }
  return claimed;
}

export async function completeJob(sb: SupabaseClient, jobId: string) {
  await sb
    .from("job_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function failJob(
  sb: SupabaseClient,
  job: JobRow,
  errorMessage: string
) {
  const attempts = Number(job.attempts || 0);
  const max = Number(job.max_attempts || 5);
  const now = new Date().toISOString();

  if (attempts >= max) {
    // Dead letter
    await sb.from("job_dead_letters").insert({
      job_id: job.id,
      company_id: job.company_id || null,
      tenant_id: job.tenant_id || null,
      job_type: job.job_type,
      payload: job.payload || {},
      attempts,
      last_error: errorMessage.slice(0, 2000),
      failed_at: now,
    });
    await sb
      .from("job_queue")
      .update({
        status: "dead",
        last_error: errorMessage.slice(0, 2000),
        locked_at: null,
        locked_by: null,
        updated_at: now,
      })
      .eq("id", job.id);
    return { dead: true as const };
  }

  // Exponential backoff: 30s * 2^(attempts-1), cap 1h
  const delaySec = Math.min(3600, 30 * Math.pow(2, Math.max(0, attempts - 1)));
  const runAfter = new Date(Date.now() + delaySec * 1000).toISOString();

  await sb
    .from("job_queue")
    .update({
      status: "pending",
      last_error: errorMessage.slice(0, 2000),
      run_after: runAfter,
      locked_at: null,
      locked_by: null,
      updated_at: now,
    })
    .eq("id", job.id);

  return { dead: false as const, retryAfterSec: delaySec };
}

export type JobHandler = (
  job: JobRow
) => Promise<{ ok: true } | { ok: false; error: string }>;

/** Built-in handlers for common enterprise jobs */
export function defaultJobHandlers(deps: {
  admin: SupabaseClient;
}): Record<string, JobHandler> {
  return {
    "notification.dispatch": async (job) => {
      try {
        const p = job.payload || {};
        // Full multi-channel path when payload looks like NotifyInput
        if (p.companyId || p.company_id) {
          const { notifyUsers } = await import("@/lib/notifications/service");
          await notifyUsers({
            companyId: String(p.companyId || p.company_id || job.company_id),
            userIds: (p.userIds || p.user_ids || (p.user_id ? [p.user_id] : undefined)) as
              | string[]
              | undefined,
            title: String(p.title || "SecureTrack notification"),
            message: String(p.message || p.body || ""),
            channels: (p.channels as ("in_app" | "email")[] | undefined) || ["in_app"],
            category: p.category as string | undefined,
            priority: p.priority as "low" | "normal" | "high" | "urgent" | undefined,
            type: p.type as "info" | "warning" | "error" | "success" | "fraud_alert" | undefined,
            link: p.link as string | undefined,
            sourceModule: p.sourceModule as string | undefined,
            sourceEvent: p.sourceEvent as string | undefined,
            entityType: p.entityType as string | undefined,
            entityId: p.entityId as string | undefined,
            metadata: (p.metadata as Record<string, unknown>) || {},
            createdBy: (p.createdBy as string) || null,
            force: Boolean(p.force),
          });
          return { ok: true };
        }
        await deps.admin.from("notifications").insert({
          company_id: job.company_id || p.company_id || null,
          user_id: p.user_id || null,
          title: String(p.title || "SecureTrack notification"),
          message: String(p.body || p.message || ""),
          type: "info",
          is_read: false,
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "notify failed" };
      }
    },
    "webhook.deliver": async (job) => {
      const url = String(job.payload?.url || "");
      if (!url || !url.startsWith("https://")) {
        return { ok: false, error: "webhook url must be https" };
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SecureTrack-Event": String(job.payload?.event || "job"),
            "X-SecureTrack-Job": job.id,
          },
          body: JSON.stringify(job.payload?.body || job.payload || {}),
        });
        if (!res.ok) {
          return { ok: false, error: `webhook HTTP ${res.status}` };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "webhook failed" };
      }
    },
    "servicedesk.sla_scan": async (job) => {
      try {
        const { runSlaEscalationScan } = await import(
          "@/lib/service-desk/sla-engine"
        );
        const companyId = String(
          job.company_id || job.payload?.company_id || ""
        );
        const result = await runSlaEscalationScan(deps.admin, {
          companyId: companyId || undefined,
          limit: Number(job.payload?.limit || 200) || 200,
        });
        if (result.errors.length && !result.scanned) {
          return { ok: false, error: result.errors[0] };
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "sla scan failed",
        };
      }
    },
    "email.send": async (job) => {
      try {
        const companyId = String(job.company_id || job.payload?.company_id || "");
        const outboxId = job.payload?.outbox_id as string | undefined;
        let to = job.payload?.to as string | undefined;
        let subject = String(job.payload?.subject || "SecureTrack");
        let body = String(job.payload?.body || job.payload?.html || "");

        // Resolve recipient + content from the outbox row when available
        // (jobs re-enqueued by the worker sweeper carry only the outbox id).
        if (outboxId) {
          const { data: outbox } = await deps.admin
            .from("email_outbox")
            .select("*")
            .eq("id", outboxId)
            .maybeSingle();
          if (outbox) {
            const addrs = (outbox.to_addresses as string[] | null) || [];
            if (addrs.length) to = addrs[0];
            if (outbox.subject) subject = String(outbox.subject);
            const op = (outbox.payload || {}) as {
              snippet?: string;
              body?: string;
              html?: string;
              notification_type?: string;
            };
            body = op.html || op.body || op.snippet || body;
          }
        }

        if (to && body) {
          const [
            { sendEmail, wrapBrandedEmailHtml, textToEmailHtml, isResendConfigured },
            { resolveCompanyBranding, brandToEmailBrand },
          ] = await Promise.all([
            import("@/lib/email"),
            import("@/lib/branding/resolve"),
          ]);
          const emailBrand = companyId
            ? brandToEmailBrand(
                await resolveCompanyBranding(deps.admin, companyId)
              )
            : null;
          if (!isResendConfigured()) {
            if (outboxId) {
              await deps.admin
                .from("email_outbox")
                .update({ status: "queued", updated_at: new Date().toISOString() })
                .eq("id", outboxId);
            }
            return { ok: true }; // queued for later when key present
          }
          const result = await sendEmail({
            to,
            subject,
            html: wrapBrandedEmailHtml({
              title: subject,
              bodyHtml: textToEmailHtml(body),
              preheader: subject,
              brand: emailBrand,
            }),
            text: body,
            brand: emailBrand,
          });
          if (!result.ok) {
            return { ok: false, error: result.error || "email send failed" };
          }
          if (outboxId) {
            await deps.admin
              .from("email_outbox")
              .update({
                status: "sent",
                provider_message_id: result.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", outboxId);
          }
          return { ok: true };
        }

        if (outboxId) {
          await deps.admin
            .from("email_outbox")
            .update({ status: "queued", updated_at: new Date().toISOString() })
            .eq("id", outboxId);
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "email failed" };
      }
    },
    "siem.forward": async (job) => {
      try {
        const companyId = String(job.company_id || job.payload?.company_id || "");
        const outboxIds = (job.payload?.outbox_ids as string[]) || [];

        // Deliver pending SIEM outbox rows (webhook connectors)
        let q = deps.admin
          .from("eal_siem_outbox")
          .select("*, eal_siem_connectors(endpoint_url, provider, auth_header)")
          .eq("status", "pending")
          .limit(50);
        if (companyId) q = q.eq("company_id", companyId);
        if (outboxIds.length) q = q.in("id", outboxIds);

        const { data: rows } = await q;
        for (const row of rows || []) {
          const conn = row.eal_siem_connectors as {
            endpoint_url?: string;
            provider?: string;
            auth_header?: string;
          } | null;
          const url = conn?.endpoint_url;
          if (url && url.startsWith("https://")) {
            try {
              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              };
              if (conn?.auth_header) headers.Authorization = conn.auth_header;
              const res = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(row.payload || {}),
              });
              await deps.admin
                .from("eal_siem_outbox")
                .update({
                  status: res.ok ? "sent" : "failed",
                  sent_at: res.ok ? new Date().toISOString() : null,
                  attempts: Number(row.attempts || 0) + 1,
                  last_error: res.ok ? null : `HTTP ${res.status}`,
                })
                .eq("id", row.id);
            } catch (e) {
              await deps.admin
                .from("eal_siem_outbox")
                .update({
                  status: "failed",
                  attempts: Number(row.attempts || 0) + 1,
                  last_error: e instanceof Error ? e.message : "push failed",
                })
                .eq("id", row.id);
            }
          } else {
            // No endpoint — mark sent for audit trail (dev connectors)
            await deps.admin
              .from("eal_siem_outbox")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                attempts: Number(row.attempts || 0) + 1,
              })
              .eq("id", row.id);
          }
        }

        await deps.admin.from("domain_events").insert({
          event_type: "siem.forward",
          company_id: companyId || null,
          payload: job.payload || {},
          source_module: "jobs",
          severity: "info",
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "siem failed" };
      }
    },
    "domain_event.consume": async (job) => {
      try {
        const {
          consumeDomainEvent,
          claimDomainEvents,
          processClaimedDomainEvents,
        } = await import("@/lib/jobs/domain-events");
        // Payload may carry a synthetic event (from money paths) or empty for batch claim
        const p = job.payload || {};
        if (p.event_type || p.id) {
          const event = {
            id: String(p.id || job.id),
            company_id:
              (p.company_id as string) ||
              job.company_id ||
              (p._company_id as string) ||
              null,
            tenant_id:
              (p.tenant_id as string) ||
              job.tenant_id ||
              (p._tenant_id as string) ||
              null,
            event_type: String(p.event_type || "unknown"),
            payload: (p.payload as Record<string, unknown>) || p,
          };
          const r = await consumeDomainEvent(deps.admin, event);
          return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
        }
        // Batch: claim pending domain_events rows
        const claimed = await claimDomainEvents(
          deps.admin,
          Number(p.limit || 20) || 20
        );
        const stats = await processClaimedDomainEvents(deps.admin, claimed);
        if (stats.failed > 0 && stats.processed === 0) {
          return { ok: false, error: `all ${stats.failed} events failed` };
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "domain event consume failed",
        };
      }
    },
    "report.run": async (job) => {
      try {
        const p = job.payload || {};
        const companyId = String(
          job.company_id || p._company_id || p.company_id || ""
        );
        const tenantId =
          String(job.tenant_id || p._tenant_id || p.tenant_id || "") || null;
        if (!companyId || !tenantId) {
          return {
            ok: false,
            error: "report.run requires company_id and tenant_id",
          };
        }
        const scheduleId = (p.schedule_id as string) || null;
        const reportId = (p.report_id as string) || null;
        if (!reportId) {
          return { ok: true }; // dashboard-only schedules: nothing to execute yet
        }

        const { data: report } = await deps.admin
          .from("bi_report_definitions")
          .select("*")
          .eq("id", reportId)
          .eq("company_id", companyId)
          .maybeSingle();
        if (!report) {
          return { ok: false, error: "report definition not found in scope" };
        }

        const { runReport, recordReportRun } = await import(
          "@/lib/reporting/engine"
        );
        const result = await runReport({
          admin: deps.admin,
          scope: {
            tenantId,
            companyId,
            userId: String(p.actor_id || job.id || "system"),
            isPlatformAdmin: false,
            isElevated: false,
          },
          definition: report,
          parameters: (p.parameters as Record<string, unknown>) || {},
          format: String(p.format || "pdf"),
          actorId: (p.actor_id as string | null) || null,
        });

        await recordReportRun({
          admin: deps.admin,
          scope: {
            tenantId,
            companyId,
            userId: String(p.actor_id || job.id || "system"),
            isPlatformAdmin: false,
            isElevated: false,
          },
          definition: report,
          result,
          format: String(p.format || "pdf"),
          actorId: (p.actor_id as string | null) || null,
        });

        if (scheduleId) {
          if (result.status === "failed") {
            await deps.admin
              .from("bi_report_schedules")
              .update({
                last_error: result.error || result.note || "report run failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", scheduleId)
              .eq("company_id", companyId);
          } else {
            await deps.admin
              .from("bi_report_schedules")
              .update({
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", scheduleId)
              .eq("company_id", companyId);
          }
        }

        // Queue notifications for each recipient x delivery channel.
        const recipients = Array.isArray(p.recipients) ? p.recipients : [];
        const channels = Array.isArray(p.delivery_channels)
          ? (p.delivery_channels as string[])
          : ["email"];
        const subject = `SecureTrack report: ${String(
          p.name || report.name || report.report_code || "Report"
        )}`;
        const body = [
          `Report ${String(report.name || report.report_code || "report")} generated.`,
          result.status === "completed"
            ? `${result.rowCount} rows in ${result.durationMs}ms.`
            : `Status: ${result.status}.`,
          result.note ? result.note : "",
        ]
          .filter(Boolean)
          .join(" ");

        for (const rawRecipient of recipients) {
          const recipient =
            typeof rawRecipient === "string"
              ? rawRecipient
              : String((rawRecipient as { to?: string }).to || rawRecipient || "");
          if (!recipient) continue;
          for (const channel of channels) {
            try {
              await deps.admin.from("bi_notification_queue").insert({
                company_id: companyId,
                tenant_id: tenantId,
                channel,
                recipient,
                subject,
                body,
                payload: {
                  notification_id: null,
                  report_id: reportId,
                  schedule_id: scheduleId,
                  format: String(p.format || "pdf"),
                  row_count: result.rowCount,
                },
                related_type: scheduleId ? "schedule" : "report",
                related_id: scheduleId || reportId,
              });
            } catch {
              /* non-blocking per channel */
            }
          }
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "report run failed",
        };
      }
    },
    generic: async () => ({ ok: true }),
  };
}

export async function processClaimedJobs(
  sb: SupabaseClient,
  jobs: JobRow[],
  handlers: Record<string, JobHandler>
): Promise<{ completed: number; failed: number; dead: number }> {
  let completed = 0;
  let failed = 0;
  let dead = 0;

  for (const job of jobs) {
    const handler =
      handlers[job.job_type] || handlers.generic || (async () => ({ ok: true as const }));
    try {
      const result = await handler(job);
      if (result.ok) {
        await completeJob(sb, job.id);
        completed += 1;
      } else {
        const f = await failJob(sb, job, result.error);
        if (f.dead) dead += 1;
        else failed += 1;
      }
    } catch (e) {
      const f = await failJob(
        sb,
        job,
        e instanceof Error ? e.message : "handler exception"
      );
      if (f.dead) dead += 1;
      else failed += 1;
    }
  }

  return { completed, failed, dead };
}
