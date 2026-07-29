import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isResendConfigured, getResendFrom } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Auth required — returns whether Resend is configured (never exposes API key). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isResendConfigured();
  const from = getResendFrom();

  return NextResponse.json({
    configured,
    provider: "resend",
    from: configured ? from.email : null,
    fromName: configured ? from.name : null,
    replyTo: process.env.RESEND_REPLY_TO || null,
    // Hint for operators without leaking secrets
    envHints: {
      RESEND_API_KEY: configured ? "set" : "missing",
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ? "set" : "default",
      RESEND_FROM_NAME: process.env.RESEND_FROM_NAME ? "set" : "default",
    },
  });
}
