/**
 * Report scheduling engine.
 *
 * Computes the next run time for report schedules (realtime / hourly / daily /
 * weekly / monthly / quarterly / yearly) and scans for due schedules, enqueueing
 * tenant-scoped `report.run` jobs with idempotency keys so the worker cannot
 * double-run a cycle.
 *
 * Schedules carry company_id only; tenant_id is resolved from the companies
 * table at scan time (same safety net the notification worker uses).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/jobs/queue";

export type ScheduleFrequency =
  | "realtime"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type ReportSchedule = {
  id: string;
  company_id?: string | null;
  schedule_code?: string | null;
  name?: string | null;
  report_id?: string | null;
  dashboard_id?: string | null;
  cron_expression?: string | null;
  frequency_label?: string | null;
  format?: string | null;
  recipients?: unknown;
  delivery_channels?: string[] | null;
  parameters?: unknown;
  is_active?: boolean | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

function addMonths(from: Date, months: number): Date {
  const out = new Date(from);
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() !== day) out.setDate(0); // clamp month-end
  return out;
}

/** Compute the next run time after `from` for a frequency label. */
export function nextRunAfter(
  frequency: string | null | undefined,
  from: Date = new Date()
): Date {
  const freq = String(frequency || "daily").toLowerCase();
  switch (freq) {
    case "realtime":
      return new Date(from.getTime() + 60_000);
    case "hourly":
      return new Date(from.getTime() + 60 * 60_000);
    case "daily":
      return new Date(from.getTime() + 24 * 60 * 60_000);
    case "weekly":
      return new Date(from.getTime() + 7 * 24 * 60 * 60_000);
    case "monthly":
      return addMonths(from, 1);
    case "quarterly":
      return addMonths(from, 3);
    case "yearly":
      return addMonths(from, 12);
    default:
      return new Date(from.getTime() + 24 * 60 * 60_000);
  }
}

/** Stable cycle key for a schedule within a time bucket (idempotency). */
export function cycleKey(scheduleId: string, at: Date): string {
  const bucket = Math.floor(at.getTime() / (60 * 60_000));
  return `${scheduleId}:${bucket}`;
}

/**
 * Scan all due schedules across companies and enqueue a `report.run` job per
 * due cycle. Returns counts for worker telemetry. The scan is safe to run from
 * a cron worker: idempotency keys prevent duplicate enqueues when the worker
 * is scaled or retried.
 */
export async function scanDueSchedules(
  admin: SupabaseClient,
  opts?: { now?: Date; limit?: number }
): Promise<{ due: number; enqueued: number; failed: number }> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 25;
  const nowIso = now.toISOString();

  const { data: schedules } = await admin
    .from("bi_report_schedules")
    .select(
      "id, company_id, schedule_code, name, report_id, dashboard_id, cron_expression, frequency_label, format, recipients, delivery_channels, parameters, is_active, last_run_at, next_run_at"
    )
    .eq("is_active", true)
    .or(`next_run_at.lte.${nowIso},next_run_at.is.null`)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (!schedules?.length) return { due: 0, enqueued: 0, failed: 0 };

  const rows = schedules as unknown as ReportSchedule[];
  const companyIds = [
    ...new Set(rows.map((r) => r.company_id).filter(Boolean)),
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

  for (const schedule of rows) {
    const companyId = (schedule.company_id as string | null) || null;
    const tenantId = companyId ? tenantByCompany.get(companyId) : null;
    if (!companyId || !tenantId) {
      failed += 1;
      continue;
    }

    const key = cycleKey(schedule.id, now);
    const job = await enqueueJob(admin, {
      jobType: "report.run",
      companyId,
      tenantId,
      priority: 50,
      idempotencyKey: `reportrun:${key}`,
      payload: {
        schedule_id: schedule.id,
        schedule_code: schedule.schedule_code || null,
        name: schedule.name || "Scheduled report",
        report_id: schedule.report_id || null,
        dashboard_id: schedule.dashboard_id || null,
        format: schedule.format || "pdf",
        recipients: schedule.recipients || [],
        delivery_channels: schedule.delivery_channels || [],
        parameters: schedule.parameters || {},
        cycle: key,
      },
    });

    if (!job?.id) {
      failed += 1;
      await admin
        .from("bi_report_schedules")
        .update({
          last_error: "Failed to enqueue report.run job",
          updated_at: nowIso,
        })
        .eq("id", schedule.id);
      continue;
    }

    enqueued += 1;
    await admin
      .from("bi_report_schedules")
      .update({
        last_run_at: nowIso,
        next_run_at: nextRunAfter(schedule.frequency_label, now).toISOString(),
        last_error: null,
        updated_at: nowIso,
      })
      .eq("id", schedule.id);
  }

  return { due: rows.length, enqueued, failed };
}