/**
 * POST /api/auth/mfa/enroll — start TOTP enrollment (returns QR + factor id).
 * Completing enrollment requires POST /api/auth/mfa/verify with mode=enroll.
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  friendly_name: z.string().min(1).max(80).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    module: "mfa",
    skipMfaCheck: true,
    bodySchema: schema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const input = body as z.infer<typeof schema>;
    const sb = await createClient();

    const { data, error } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: input.friendly_name || "Authenticator app",
    });

    if (error || !data) {
      return apiError(
        "VALIDATION",
        error?.message || "Could not start MFA enrollment. Ensure MFA is enabled in Supabase Auth settings.",
        400
      );
    }

    return apiOk({
      factor_id: data.id,
      type: data.type,
      totp: {
        qr_code: data.totp?.qr_code ?? null,
        secret: data.totp?.secret ?? null,
        uri: data.totp?.uri ?? null,
      },
      message:
        "Scan the QR code with Google Authenticator, Authy, or 1Password, then verify with a 6-digit code.",
    });
  }
);
