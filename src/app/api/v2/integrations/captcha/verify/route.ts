/**
 * Server-side CAPTCHA verification (Turnstile / shared CAPTCHA_SECRET_KEY).
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { verifyCaptcha } from "@/lib/providers/security/captcha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1).max(4000),
});

export const POST = createApiHandler(
  {
    auth: false,
    module: "security",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ body, ip }) => {
    const input = body as z.infer<typeof schema>;
    const r = await verifyCaptcha({
      token: input.token,
      remoteIp: ip,
    });
    if (!r.ok) {
      return apiError("VALIDATION", r.error || "Verification failed", 400);
    }
    return apiOk({ success: true, hostname: r.data?.hostname });
  }
);
