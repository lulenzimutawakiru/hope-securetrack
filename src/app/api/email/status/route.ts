import { NextResponse } from "next/server";
import { isResendConfigured, getResendFrom } from "@/lib/email";
import { requireApiAuth } from "@/lib/security/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Auth + settings permission — never exposes API key. */
export async function GET() {
  const auth = await requireApiAuth({
    permissions: ["settings.manage", "communications.manage", "comm.manage", "iam.manage"],
    allowPlatformAdmin: true,
  });
  if ("response" in auth) return auth.response;

  const configured = isResendConfigured();
  const from = getResendFrom();

  return NextResponse.json({
    configured,
    provider: "resend",
    from: configured ? from.email : null,
    fromName: configured ? from.name : null,
    replyTo: process.env.RESEND_REPLY_TO || null,
    envHints: {
      RESEND_API_KEY: configured ? "set" : "missing",
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ? "set" : "default",
      RESEND_FROM_NAME: process.env.RESEND_FROM_NAME ? "set" : "default",
    },
  });
}
