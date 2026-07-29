import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  isResendConfigured,
  sendEmail,
  wrapEmailHtml,
  getResendFrom,
} from "@/lib/email";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  to: z.string().email().optional(),
});

/**
 * Sends a test email via Resend to the current user (or provided address).
 */
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
        hint: "Add RESEND_API_KEY in Vercel project env / .env.local",
      },
      { status: 503 }
    );
  }

  let to = user.email || "";
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(json);
    if (parsed.success && parsed.data.to) to = parsed.data.to;
  } catch {
    /* empty body ok */
  }

  if (!to) {
    return NextResponse.json(
      { error: "No recipient email available" },
      { status: 400 }
    );
  }

  const from = getResendFrom();
  const html = wrapEmailHtml({
    title: "Resend test — Hope SecureTrack",
    preheader: "Your email integration is working",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello,</p>
      <p style="margin:0 0 12px;">This is a <strong>test message</strong> from <strong>${env.app.name}</strong> for ${env.app.company}.</p>
      <p style="margin:0 0 12px;">If you received this, Resend is correctly connected.</p>
      <ul style="margin:0 0 12px;padding-left:18px;color:#475569;">
        <li>Provider: Resend</li>
        <li>From: ${from.email}</li>
        <li>Time: ${new Date().toISOString()}</li>
      </ul>
      <p style="margin:0;color:#64748b;font-size:12px;">You can now send notifications, report packs, and transactional mail from Settings → Notifications.</p>
    `,
  });

  const result = await sendEmail({
    to,
    subject: `[Test] ${env.app.name} email via Resend`,
    html,
    text: `Test email from ${env.app.name}. Resend is working. Time: ${new Date().toISOString()}`,
    tags: [
      { name: "category", value: "test" },
      { name: "app", value: "hope-securetrack" },
    ],
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    to,
    provider: "resend",
    from: from.email,
  });
}
