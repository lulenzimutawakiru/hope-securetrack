import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendTemplatedEmail, isResendConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().min(1).max(500).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  /** Use notification_templates row */
  template_key: z.string().optional(),
  vars: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
  replyTo: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  tags: z
    .array(z.object({ name: z.string(), value: z.string() }))
    .optional(),
  log: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error: "Resend is not configured",
        hint: "Set RESEND_API_KEY (and optionally RESEND_FROM_EMAIL) in environment variables.",
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  let result;
  let subjectUsed = body.subject || "";
  let templateKey: string | null = body.template_key || null;

  if (body.template_key) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = profile?.company_id;
    let q = supabase
      .from("notification_templates")
      .select("*")
      .eq("template_key", body.template_key)
      .eq("channel", "email")
      .eq("is_active", true)
      .limit(1);
    if (companyId) q = q.eq("company_id", companyId);

    const { data: templates } = await q;
    const tpl = templates?.[0];
    if (!tpl) {
      return NextResponse.json(
        { error: `Email template not found: ${body.template_key}` },
        { status: 404 }
      );
    }

    subjectUsed = String(tpl.subject || body.subject || "Notification");
    const bodyTpl = String(tpl.body || body.text || "");
    result = await sendTemplatedEmail({
      to: body.to,
      subjectTemplate: subjectUsed,
      bodyTemplate: bodyTpl,
      vars: {
        ...(body.vars || {}),
        email: Array.isArray(body.to) ? body.to[0] : body.to,
      },
      tags: body.tags || [
        { name: "template", value: body.template_key.slice(0, 50) },
      ],
    });
  } else {
    if (!body.subject) {
      return NextResponse.json(
        { error: "subject is required when template_key is not provided" },
        { status: 400 }
      );
    }
    if (!body.html && !body.text) {
      return NextResponse.json(
        { error: "html or text is required" },
        { status: 400 }
      );
    }
    result = await sendEmail({
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      replyTo: body.replyTo,
      tags: body.tags,
    });
    subjectUsed = body.subject;
  }

  // Best-effort outbox log (service role if available)
  if (body.log !== false) {
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient()
        : supabase;

      await admin.from("email_outbox").insert({
        company_id: profile?.company_id || null,
        provider: "resend",
        to_addresses: Array.isArray(body.to) ? body.to : [body.to],
        subject: subjectUsed,
        template_key: templateKey,
        status: result.ok ? "sent" : "failed",
        provider_message_id: result.ok ? result.id : null,
        error_message: result.ok ? null : result.error,
        sent_by: user.id,
        payload: { vars: body.vars || {} },
      });

      // Also mirror into bi_notification_queue if present
      await admin.from("bi_notification_queue").insert({
        company_id: profile?.company_id,
        channel: "email",
        recipient: Array.isArray(body.to) ? body.to.join(",") : body.to,
        subject: subjectUsed,
        body: body.text || body.html || null,
        status: result.ok ? "sent" : "failed",
        related_type: templateKey ? "template" : "direct",
        related_id: null,
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok ? null : result.error,
        payload: { provider: "resend", id: result.ok ? result.id : null },
      });
    } catch {
      // non-fatal if tables missing
    }
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    provider: "resend",
  });
}
