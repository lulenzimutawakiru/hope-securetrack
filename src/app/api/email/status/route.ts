import { apiOk, createApiHandler } from "@/lib/api/handler";
import { isResendConfigured, getResendFrom } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Auth + settings permission — never exposes API key. */
export const GET = createApiHandler(
  {
    auth: true,
    permissions: [
      "settings.manage",
      "communications.manage",
      "comm.manage",
      "iam.manage",
    ],
    allowPlatformAdmin: true,
    module: "email",
  },
  async () => {
    const configured = isResendConfigured();
    const from = getResendFrom();

    return apiOk({
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
);
