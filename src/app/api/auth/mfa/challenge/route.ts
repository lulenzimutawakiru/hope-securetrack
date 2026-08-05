/**
 * POST /api/auth/mfa/challenge — create a TOTP challenge for login step-up.
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { listVerifiedFactors } from "@/lib/security/mfa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  factor_id: z.string().uuid().optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    module: "mfa",
    skipMfaCheck: true,
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const input = body as z.infer<typeof schema>;
    const sb = await createClient();

    let factorId = input.factor_id;
    if (!factorId) {
      const factors = await listVerifiedFactors(sb);
      if (!factors.length) {
        return apiError(
          "VALIDATION",
          "No verified authenticator on this account. Enroll MFA first.",
          400
        );
      }
      factorId = factors[0].id;
    }

    const { data, error } = await sb.auth.mfa.challenge({ factorId });
    if (error || !data) {
      return apiError(
        "VALIDATION",
        error?.message || "Could not create MFA challenge",
        400
      );
    }

    return apiOk({
      challenge_id: data.id,
      factor_id: factorId,
      expires_at: data.expires_at,
    });
  }
);
