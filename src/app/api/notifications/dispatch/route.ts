import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isResendConfigured,
  sendTemplatedEmail,
  sendEmail,
  wrapEmailHtml,
  textToEmailHtml,
  applyTemplateVars,
} from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Dispatch a notification by channel.
 * Currently implements email via Resend; other channels are queued.
 */
const schema = z.object({
  channel: z.enum(["email", "sms", "push", "in_app", "whatsapp"]).default("email"),
  to: z.string().min(1),
  template_key: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  queue_only: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, email, first_name, last_name")
    .eq("id", user.id)
    .single();

  const companyId = profile?.company_id;
  const vars = {
    name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "User",
    email: profile?.email || "",
    ...(body.vars || {}),
  };

  let subject = body.subject || "Notification";
  let messageBody = body.body || "";

  if (body.template_key) {
    let q = supabase
      .from("notification_templates")
      .select("*")
      .eq("template_key", body.template_key)
      .eq("channel", body.channel)
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

  // Queue row for all channels
  const { data: queued, error: qErr } = await admin
    .from("bi_notification_queue")
    .insert({
      company_id: companyId,
      channel: body.channel,
      recipient: body.to,
      subject,
      body: messageBody,
      status: body.queue_only || body.channel !== "email" ? "queued" : "processing",
      payload: { template_key: body.template_key, vars },
      scheduled_for: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (qErr) {
    // table might not exist in older envs — continue for email
    console.warn("[notifications/dispatch] queue insert:", qErr.message);
  }

  if (body.channel !== "email") {
    return NextResponse.json({
      ok: true,
      queued: true,
      channel: body.channel,
      queue_id: queued?.id ?? null,
      message: `${body.channel} notifications are queued for worker delivery`,
    });
  }

  if (body.queue_only) {
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
        error: "Resend is not configured",
        queue_id: queued?.id ?? null,
      },
      { status: 503 }
    );
  }

  const result = body.template_key
    ? await sendTemplatedEmail({
        to: body.to,
        subjectTemplate: subject,
        bodyTemplate: messageBody,
        vars,
        tags: [{ name: "channel", value: "email" }],
      })
    : await sendEmail({
        to: body.to,
        subject,
        html: wrapEmailHtml({
          title: subject,
          bodyHtml: textToEmailHtml(messageBody),
        }),
        text: messageBody,
      });

  if (queued?.id) {
    await admin
      .from("bi_notification_queue")
      .update({
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok ? null : result.error,
        payload: {
          template_key: body.template_key,
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
      to_addresses: [body.to],
      subject,
      template_key: body.template_key || null,
      status: result.ok ? "sent" : "failed",
      provider_message_id: result.ok ? result.id : null,
      error_message: result.ok ? null : result.error,
      sent_by: user.id,
      payload: { vars },
    });
  } catch {
    /* optional table */
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code, queue_id: queued?.id },
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
