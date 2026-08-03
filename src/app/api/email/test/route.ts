import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  isResendConfigured,
  sendEmail,
  wrapBrandedEmailHtml,
  getResendFrom,
} from "@/lib/email";
import {
  resolveCompanyBranding,
  brandToEmailBrand,
} from "@/lib/branding/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  to: z.string().email().optional(),
});

/** Sends a test email via Resend to the current user only. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "communications.manage",
      "comm.manage",
      "settings.manage",
      "iam.manage",
    ],
    allowPlatformAdmin: true,
    bodySchema: schema,
    rateLimit: { limit: 5, windowMs: 60_000 },
    module: "email",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    if (!isResendConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Resend is not configured",
          hint: "Add RESEND_API_KEY in Vercel project env / .env.local",
        },
        { status: 503 }
      );
    }

    const brand = brandToEmailBrand(
      await resolveCompanyBranding(await createClient(), ctx.companyId)
    );

    let to = ctx.user.email || ctx.profile.email || "";
    if (data.to) {
      if (data.to.toLowerCase() !== (to || "").toLowerCase()) {
        return apiError(
          "FORBIDDEN",
          "Test email may only be sent to your own address",
          403
        );
      }
      to = data.to;
    }

    if (!to) {
      return apiError("VALIDATION", "No email on account");
    }

    const from = getResendFrom();
    const result = await sendEmail({
      to,
      subject: `SecureTrack ERP test email`,
      html: wrapBrandedEmailHtml({
        title: "Test email",
        bodyHtml: `<p>This is a test message from SecureTrack ERP.</p>`,
        brand,
      }),
      brand,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.id,
      to,
      from: from.email,
    });
  }
);
