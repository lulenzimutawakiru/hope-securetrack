import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isResendConfigured,
  sendTemplatedEmail,
  sendEmail,
  wrapBrandedEmailHtml,
  textToEmailHtml,
  applyTemplateVars,
} from "@/lib/email";
import {
  resolveCompanyBranding,
  brandToEmailBrand,
} from "@/lib/branding/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  channel: z
    .enum(["email", "sms", "push", "in_app", "whatsapp"])
    .default("email"),
  to: z.string().min(1),
  template_key: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  queue_only: z.boolean().optional().default(false),
});

/**
 * Dispatch a notification by channel.
 * Email via Resend; other channels queued.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "communications.manage",
      "comm.manage",
      "notifications.manage",
      "settings.manage",
      "iam.manage",
    ],
    allowPlatformAdmin: true,
    bodySchema: schema,
    rateLimit: { limit: 40, windowMs: 60_000 },
    module: "notifications",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, email, first_name, last_name")
      .eq("id", ctx.user.id)
      .single();

    const companyId = profile?.company_id || ctx.companyId;
    const brand = brandToEmailBrand(
      await resolveCompanyBranding(supabase, companyId)
    );
    const vars = {
      name:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "User",
      email: profile?.email || "",
      ...(data.vars || {}),
    };

    let subject = data.subject || "Notification";
    let messageBody = data.body || "";

    if (data.template_key) {
      let q = supabase
        .from("notification_templates")
        .select("*")
        .eq("template_key", data.template_key)
        .eq("channel", data.channel)
        .eq("is_active", true)
        .limit(1);
      if (companyId) q = q.eq("company_id", companyId);
      const { data: tpls } = await q;
      const tpl = tpls?.[0];
      if (tpl) {
        subject = String(tpl.subject || subject);
        messageBody = String(tpl.body || messageBody);
      }
    }

    subject = applyTemplateVars(subject, vars);
    messageBody = applyTemplateVars(messageBody, vars);

    const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createAdminClient()
      : supabase;

    const { data: queued, error: qErr } = await admin
      .from("bi_notification_queue")
      .insert({
        company_id: companyId,
        channel: data.channel,
        recipient: data.to,
        subject,
        body: messageBody,
        status:
          data.queue_only || data.channel !== "email"
            ? "queued"
            : "processing",
        payload: { template_key: data.template_key, vars },
        scheduled_for: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (qErr) {
      console.warn("[notifications/dispatch] queue insert:", qErr.message);
    }

    if (data.channel !== "email") {
      return NextResponse.json({
        ok: true,
        queued: true,
        channel: data.channel,
        queue_id: queued?.id ?? null,
        message: `${data.channel} notifications are queued for worker delivery`,
      });
    }

    if (data.queue_only) {
      return NextResponse.json({
        ok: true,
        queued: true,
        channel: "email",
        queue_id: queued?.id ?? null,
      });
    }

    if (!isResendConfigured()) {
      if (queued?.id) {
        await admin
          .from("bi_notification_queue")
          .update({
            status: "failed",
            error_message: "RESEND_API_KEY not configured",
          })
          .eq("id", queued.id);
      }
      return NextResponse.json(
        {
          ok: false,
          error: "Resend is not configured",
          queue_id: queued?.id ?? null,
        },
        { status: 503 }
      );
    }

    const result = data.template_key
      ? await sendTemplatedEmail({
          to: data.to,
          subjectTemplate: subject,
          bodyTemplate: messageBody,
          vars,
          tags: [{ name: "channel", value: "email" }],
          brand,
        })
      : await sendEmail({
          to: data.to,
          subject,
          html: wrapBrandedEmailHtml({
            title: subject,
            bodyHtml: textToEmailHtml(messageBody),
            brand,
          }),
          text: messageBody,
          brand,
        });

    if (queued?.id) {
      await admin
        .from("bi_notification_queue")
        .update({
          status: result.ok ? "sent" : "failed",
          sent_at: result.ok ? new Date().toISOString() : null,
          error_message: result.ok ? null : result.error,
          payload: {
            template_key: data.template_key,
            vars,
            provider: "resend",
            message_id: result.ok ? result.id : null,
          },
        })
        .eq("id", queued.id);
    }

    try {
      await admin.from("email_outbox").insert({
        company_id: companyId,
        provider: "resend",
        to_addresses: [data.to],
        subject,
        template_key: data.template_key || null,
        status: result.ok ? "sent" : "failed",
        provider_message_id: result.ok ? result.id : null,
        error_message: result.ok ? null : result.error,
        sent_by: ctx.user.id,
        payload: { vars },
      });
    } catch {
      /* optional table */
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          code: result.code,
          queue_id: queued?.id,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      channel: "email",
      provider: "resend",
      queue_id: queued?.id ?? null,
    });
  }
);
