import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendEmail,
  sendTemplatedEmail,
  isResendConfigured,
} from "@/lib/email";
import { sanitizeHtml } from "@/lib/security/shared";
import {
  resolveCompanyBranding,
  brandToEmailBrand,
} from "@/lib/branding/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.union([
    z.string().email(),
    z.array(z.string().email()).min(1).max(20),
  ]),
  subject: z.string().min(1).max(500).optional(),
  html: z.string().max(100_000).optional(),
  text: z.string().max(100_000).optional(),
  template_key: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  replyTo: z
    .union([z.string().email(), z.array(z.string().email())])
    .optional(),
  tags: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .optional(),
  log: z.boolean().optional().default(true),
});

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
    bodySchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "email",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof bodySchema>;

    if (!isResendConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Resend is not configured",
          hint: "Set RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) in environment variables.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const brand = brandToEmailBrand(
      await resolveCompanyBranding(supabase, ctx.companyId)
    );
    let result: { ok: true; id: string } | { ok: false; error: string; code?: string };
    let subjectUsed = data.subject || "";
    const templateKey: string | null = data.template_key || null;

    if (data.template_key) {
      let q = supabase
        .from("notification_templates")
        .select("*")
        .eq("template_key", data.template_key)
        .eq("channel", "email")
        .eq("is_active", true)
        .limit(1);
      if (ctx.companyId) q = q.eq("company_id", ctx.companyId);

      const { data: templates } = await q;
      const tpl = templates?.[0];
      if (!tpl) {
        return apiError(
          "NOT_FOUND",
          `Email template not found: ${data.template_key}`,
          404
        );
      }

      subjectUsed = String(tpl.subject || data.subject || "Notification");
      const bodyTpl = String(tpl.body || data.text || "");
      result = await sendTemplatedEmail({
        to: data.to,
        subjectTemplate: subjectUsed,
        bodyTemplate: bodyTpl,
        vars: {
          ...(data.vars || {}),
          email: Array.isArray(data.to) ? data.to[0] : data.to,
        },
        tags: data.tags || [
          { name: "template", value: data.template_key.slice(0, 50) },
        ],
        brand,
      });
    } else {
      if (!data.subject) {
        return apiError(
          "VALIDATION",
          "subject is required when template_key is not provided"
        );
      }
      if (!data.html && !data.text) {
        return apiError("VALIDATION", "html or text is required");
      }
      result = await sendEmail({
        to: data.to,
        subject: data.subject,
        html: data.html ? sanitizeHtml(data.html) : undefined,
        text: data.text,
        replyTo: data.replyTo,
        tags: data.tags,
        brand,
      });
      subjectUsed = data.subject;
    }

    if (data.log !== false) {
      try {
        const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
          ? createAdminClient()
          : supabase;

        await admin.from("email_outbox").insert({
          company_id: ctx.companyId || null,
          provider: "resend",
          to_addresses: Array.isArray(data.to) ? data.to : [data.to],
          subject: subjectUsed,
          template_key: templateKey,
          status: result.ok ? "sent" : "failed",
          provider_message_id: result.ok ? result.id : null,
          error_message: result.ok ? null : result.error,
          sent_by: ctx.user.id,
          payload: { vars: data.vars || {} },
        });

        await admin.from("bi_notification_queue").insert({
          company_id: ctx.companyId,
          channel: "email",
          recipient: Array.isArray(data.to) ? data.to.join(",") : data.to,
          subject: subjectUsed,
          body: data.text || data.html || null,
          status: result.ok ? "sent" : "failed",
          related_type: templateKey ? "template" : "direct",
          related_id: null,
          sent_at: result.ok ? new Date().toISOString() : null,
          error_message: result.ok ? null : result.error,
          payload: {
            provider: "resend",
            id: result.ok ? result.id : null,
          },
        });
      } catch {
        /* non-fatal */
      }
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      provider: "resend",
    });
  }
);
