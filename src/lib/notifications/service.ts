/**
 * Advanced notification service — multi-channel fan-out with preferences.
 * Server-side only (uses admin client for cross-user inserts + Resend).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyTemplateVars,
  isResendConfigured,
  sendTemplatedEmail,
  sendEmail,
  wrapBrandedEmailHtml,
  textToEmailHtml,
} from "@/lib/email";
import { resolveCompanyBranding, brandToEmailBrand } from "@/lib/branding/resolve";

export type NotifyChannel = "in_app" | "email" | "sms" | "push" | "whatsapp";

export type NotifyInput = {
  companyId: string;
  /** Tenant scope for durable queue jobs (resolved from company when absent) */
  tenantId?: string | null;
  /** Explicit recipients; if empty, resolved from rule audience / userIds */
  userIds?: string[];
  title: string;
  message?: string;
  type?: "info" | "warning" | "error" | "success" | "fraud_alert";
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  channels?: NotifyChannel[];
  link?: string;
  actionLabel?: string;
  actionUrl?: string;
  sourceModule?: string;
  sourceEvent?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  templateKey?: string;
  vars?: Record<string, string | number | null | undefined>;
  createdBy?: string | null;
  /** Force channels ignoring preference mutes (except quiet hours still soft) */
  force?: boolean;
};

export type NotifyResult = {
  inApp: number;
  email: number;
  skipped: number;
  failed: number;
  notificationIds: string[];
};

function resolveChannels(
  requested: NotifyChannel[],
  prefs: Record<string, unknown> | null,
  category: string,
  force?: boolean
): NotifyChannel[] {
  if (force) return requested;
  if (!prefs) return requested;

  const muted = (prefs.muted_events as string[] | null) ?? [];
  // category_settings optional override
  const cat = (prefs.category_settings as Record<string, Record<string, boolean>>) || {};
  const catCfg = cat[category];

  return requested.filter((ch) => {
    if (ch === "email" && prefs.email_enabled === false) return false;
    if (ch === "in_app" && prefs.in_app_enabled === false) return false;
    if (ch === "sms" && prefs.sms_enabled === false) return false;
    if (ch === "push" && prefs.push_enabled === false) return false;
    if (ch === "whatsapp" && prefs.whatsapp_enabled === false) return false;
    if (catCfg && catCfg[ch] === false) return false;
    if (muted.includes(ch)) return false;
    return true;
  });
}

function inQuietHours(prefs: Record<string, unknown> | null): boolean {
  if (!prefs?.quiet_hours_start || !prefs?.quiet_hours_end) return false;
  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const start = String(prefs.quiet_hours_start);
  const end = String(prefs.quiet_hours_end);
  if (start <= end) return hhmm >= start && hhmm < end;
  // overnight window
  return hhmm >= start || hhmm < end;
}

/**
 * Preferred production entry: enqueue durable job for worker delivery.
 * Falls back to synchronous notifyUsers if queue unavailable.
 */
export async function notifyUsersAsync(
  input: NotifyInput & { sync?: boolean }
): Promise<NotifyResult & { jobId?: string | null; mode: "async" | "sync" }> {
  if (input.sync || process.env.NOTIFICATIONS_SYNC === "true") {
    const r = await notifyUsers(input);
    return { ...r, jobId: null, mode: "sync" };
  }
  try {
    const { enqueueJob } = await import("@/lib/jobs/queue");
    const admin = createAdminClient();
    let tenantId = input.tenantId || null;
    if (!tenantId) {
      const { data: company } = await admin
        .from("companies")
        .select("tenant_id")
        .eq("id", input.companyId)
        .maybeSingle();
      tenantId = (company?.tenant_id as string | null) || null;
    }
    const job = await enqueueJob(admin, {
      companyId: input.companyId,
      tenantId,
      jobType: "notification.dispatch",
      payload: {
        ...input,
        tenant_id: tenantId,
        // serialize for worker
        title: input.title,
        body: input.message,
        user_ids: input.userIds,
        channels: input.channels,
      },
      idempotencyKey: input.entityId
        ? `notify:${input.companyId}:${input.entityType || "x"}:${input.entityId}:${input.title.slice(0, 40)}`
        : undefined,
      maxAttempts: 5,
    });
    if (job?.id) {
      return {
        inApp: 0,
        email: 0,
        skipped: 0,
        failed: 0,
        notificationIds: [],
        jobId: job.id,
        mode: "async",
      };
    }
  } catch {
    /* fall through to sync */
  }
  const r = await notifyUsers(input);
  return { ...r, jobId: null, mode: "sync" };
}

export async function notifyUsers(input: NotifyInput): Promise<NotifyResult> {
  const admin = createAdminClient();
  const channels = input.channels?.length
    ? input.channels
    : (["in_app"] as NotifyChannel[]);
  const category = input.category || "system";
  const priority = input.priority || "normal";
  const type = input.type || "info";
  const vars = input.vars || {};

  let userIds = input.userIds?.filter(Boolean) ?? [];
  if (!userIds.length) {
    // fallback: all active company users (broadcast)
    const { data } = await admin
      .from("user_profiles")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("is_active", true)
      .limit(500);
    userIds = (data ?? []).map((u) => u.id as string);
  }

  const result: NotifyResult = {
    inApp: 0,
    email: 0,
    skipped: 0,
    failed: 0,
    notificationIds: [],
  };

  for (const userId of userIds) {
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await admin
      .from("user_profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    const activeChannels = resolveChannels(channels, prefs, category, input.force);
    if (!activeChannels.length) {
      result.skipped++;
      continue;
    }

    // Digest mode: queue email for later, still deliver in-app
    const digest = prefs?.digest_mode && prefs.digest_mode !== "instant";
    const quiet = inQuietHours(prefs);

    let notificationId: string | null = null;

    if (activeChannels.includes("in_app")) {
      const { data: row, error } = await admin
        .from("notifications")
        .insert({
          company_id: input.companyId,
          user_id: userId,
          type,
          title: input.title,
          message: input.message || null,
          link: input.link || input.actionUrl || null,
          category,
          priority,
          channels: activeChannels,
          source_module: input.sourceModule || null,
          source_event: input.sourceEvent || null,
          entity_type: input.entityType || null,
          entity_id: input.entityId || null,
          action_label: input.actionLabel || null,
          action_url: input.actionUrl || input.link || null,
          metadata: input.metadata || {},
          created_by: input.createdBy || null,
          is_read: false,
        })
        .select("id")
        .single();

      if (error) {
        result.failed++;
        await admin.from("notification_deliveries").insert({
          company_id: input.companyId,
          user_id: userId,
          channel: "in_app",
          status: "failed",
          error_message: error.message,
          provider: "supabase",
        });
      } else {
        notificationId = row?.id ?? null;
        if (notificationId) result.notificationIds.push(notificationId);
        result.inApp++;
        await admin.from("notification_deliveries").insert({
          company_id: input.companyId,
          notification_id: notificationId,
          user_id: userId,
          channel: "in_app",
          status: "sent",
          provider: "supabase",
          sent_at: new Date().toISOString(),
        });
      }
    }

    if (activeChannels.includes("email") && profile?.email) {
      if (quiet || digest) {
        await admin.from("bi_notification_queue").insert({
          company_id: input.companyId,
          channel: "email",
          recipient: profile.email,
          subject: input.title,
          body: input.message || "",
          status: "queued",
          payload: {
            notification_id: notificationId,
            template_key: input.templateKey,
            vars,
            reason: quiet ? "quiet_hours" : "digest",
          },
          scheduled_for: new Date().toISOString(),
        });
        await admin.from("notification_deliveries").insert({
          company_id: input.companyId,
          notification_id: notificationId,
          user_id: userId,
          channel: "email",
          recipient: profile.email,
          status: "pending",
          provider: "resend",
          payload: { deferred: true, reason: quiet ? "quiet_hours" : "digest" },
        });
      } else if (!isResendConfigured()) {
        result.failed++;
        await admin.from("notification_deliveries").insert({
          company_id: input.companyId,
          notification_id: notificationId,
          user_id: userId,
          channel: "email",
          recipient: profile.email,
          status: "failed",
          error_message: "RESEND_API_KEY not configured",
          provider: "resend",
        });
      } else {
        const fullVars = {
          name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "User",
          email: profile.email,
          ...vars,
        };
        const emailBrand = brandToEmailBrand(
          await resolveCompanyBranding(admin, input.companyId)
        );
        let sendResult;
        if (input.templateKey) {
          const { data: tpls } = await admin
            .from("notification_templates")
            .select("subject, body")
            .eq("company_id", input.companyId)
            .eq("template_key", input.templateKey)
            .eq("channel", "email")
            .eq("is_active", true)
            .limit(1);
          const tpl = tpls?.[0];
          sendResult = await sendTemplatedEmail({
            to: profile.email,
            subjectTemplate: String(tpl?.subject || input.title),
            bodyTemplate: String(tpl?.body || input.message || input.title),
            vars: fullVars,
            tags: [
              { name: "category", value: category.slice(0, 50) },
              { name: "priority", value: priority },
            ],
            brand: emailBrand,
          });
        } else {
          sendResult = await sendEmail({
            to: profile.email,
            subject: input.title,
            html: wrapBrandedEmailHtml({
              title: input.title,
              bodyHtml: textToEmailHtml(input.message || input.title),
              preheader: input.title,
              brand: emailBrand,
            }),
            text: input.message || input.title,
            tags: [{ name: "category", value: category.slice(0, 50) }],
            brand: emailBrand,
          });
        }

        if (sendResult.ok) {
          result.email++;
          await admin.from("notification_deliveries").insert({
            company_id: input.companyId,
            notification_id: notificationId,
            user_id: userId,
            channel: "email",
            recipient: profile.email,
            status: "sent",
            provider: "resend",
            provider_message_id: sendResult.id,
            sent_at: new Date().toISOString(),
          });
          await admin.from("email_outbox").insert({
            company_id: input.companyId,
            provider: "resend",
            to_addresses: [profile.email],
            subject: input.title,
            template_key: input.templateKey || null,
            status: "sent",
            provider_message_id: sendResult.id,
            sent_by: input.createdBy || null,
            payload: { notification_id: notificationId },
          });
        } else {
          result.failed++;
          await admin.from("notification_deliveries").insert({
            company_id: input.companyId,
            notification_id: notificationId,
            user_id: userId,
            channel: "email",
            recipient: profile.email,
            status: "failed",
            error_message: sendResult.error,
            provider: "resend",
          });
        }
      }
    }

    // Queue non-email external channels
    for (const ch of activeChannels) {
      if (ch === "in_app" || ch === "email") continue;
      await admin.from("bi_notification_queue").insert({
        company_id: input.companyId,
        channel: ch,
        recipient: profile?.email || userId,
        subject: input.title,
        body: input.message || "",
        status: "queued",
        payload: { notification_id: notificationId, channel: ch },
      });
      await admin.from("notification_deliveries").insert({
        company_id: input.companyId,
        notification_id: notificationId,
        user_id: userId,
        channel: ch,
        status: "pending",
        provider: "queue",
      });
    }
  }

  return result;
}

export async function notifyFromEvent(opts: {
  companyId: string;
  eventKey: string;
  vars?: Record<string, string | number | null | undefined>;
  actorUserId?: string | null;
  entityType?: string;
  entityId?: string;
  createdBy?: string | null;
}): Promise<NotifyResult> {
  const admin = createAdminClient();
  const { data: rules } = await admin
    .from("notification_rules")
    .select("*")
    .eq("company_id", opts.companyId)
    .eq("event_key", opts.eventKey)
    .eq("is_active", true);

  const empty: NotifyResult = {
    inApp: 0,
    email: 0,
    skipped: 0,
    failed: 0,
    notificationIds: [],
  };
  if (!rules?.length) return empty;

  const vars = opts.vars || {};
  const aggregated = { ...empty };

  for (const rule of rules) {
    const audience = (rule.audience || {}) as {
      roles?: string[];
      actor?: boolean;
      all_users?: boolean;
      user_ids?: string[];
    };

    let userIds: string[] = [];

    if (audience.all_users) {
      const { data } = await admin
        .from("user_profiles")
        .select("id")
        .eq("company_id", opts.companyId)
        .eq("is_active", true);
      userIds = (data ?? []).map((u) => u.id as string);
    }
    if (audience.user_ids?.length) {
      userIds = [...userIds, ...audience.user_ids];
    }
    if (audience.roles?.length) {
      const { data: roles } = await admin
        .from("roles")
        .select("id")
        .in("slug", audience.roles);
      const roleIds = (roles ?? []).map((r) => r.id);
      if (roleIds.length) {
        const { data: users } = await admin
          .from("user_profiles")
          .select("id")
          .eq("company_id", opts.companyId)
          .in("role_id", roleIds)
          .eq("is_active", true);
        userIds = [...userIds, ...(users ?? []).map((u) => u.id as string)];
      }
    }
    if (audience.actor && opts.actorUserId) {
      userIds.push(opts.actorUserId);
    }

    userIds = Array.from(new Set(userIds));

    const title = applyTemplateVars(String(rule.title_template), vars);
    const message = applyTemplateVars(String(rule.body_template || ""), vars);
    const link = rule.link_template
      ? applyTemplateVars(String(rule.link_template), vars)
      : undefined;

    const r = await notifyUsers({
      companyId: opts.companyId,
      userIds,
      title,
      message,
      category: String(rule.category || "system"),
      priority: (rule.priority as NotifyInput["priority"]) || "normal",
      channels: (rule.channels as NotifyChannel[]) || ["in_app"],
      link,
      actionUrl: link,
      sourceModule: "rules",
      sourceEvent: opts.eventKey,
      entityType: opts.entityType,
      entityId: opts.entityId,
      templateKey: rule.template_key || undefined,
      vars,
      createdBy: opts.createdBy,
      type:
        rule.priority === "urgent"
          ? "fraud_alert"
          : rule.priority === "high"
            ? "warning"
            : "info",
    });

    aggregated.inApp += r.inApp;
    aggregated.email += r.email;
    aggregated.skipped += r.skipped;
    aggregated.failed += r.failed;
    aggregated.notificationIds.push(...r.notificationIds);
  }

  return aggregated;
}
