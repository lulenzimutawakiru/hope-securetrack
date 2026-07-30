import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isResendConfigured,
  sendEmail,
  wrapEmailHtml,
  getResendFrom,
} from "@/lib/email";
import { requireApiAuth } from "@/lib/security/api-auth";
import { clientIp, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  to: z.string().email().optional(),
});

/**
 * Sends a test email via Resend to the current user only.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`email-test:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const auth = await requireApiAuth({
    permissions: ["communications.manage", "comm.manage", "settings.manage", "iam.manage"],
    allowPlatformAdmin: true,
  });
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error: "Resend is not configured",
        hint: "Add RESEND_API_KEY in Vercel project env / .env.local",
      },
      { status: 503 }
    );
  }

  let to = ctx.user.email || ctx.profile.email || "";
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(json);
    if (parsed.success && parsed.data.to) {
      if (parsed.data.to.toLowerCase() !== (to || "").toLowerCase()) {
        return NextResponse.json(
          { error: "Test email may only be sent to your own address" },
          { status: 403 }
        );
      }
      to = parsed.data.to;
    }
  } catch {
    /* empty body ok */
  }

  if (!to) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const from = getResendFrom();
  const result = await sendEmail({
    to,
    subject: `SecureTrack ERP test email`,
    html: wrapEmailHtml({
      title: "Test email",
      bodyHtml: `<p>This is a test message from SecureTrack ERP.</p>`,
    }),
    text: "This is a test message from SecureTrack ERP.",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.id, to, from: from.email });
}
