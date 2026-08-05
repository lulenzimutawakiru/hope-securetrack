/**
 * POST /api/auth/mfa/unenroll — remove a TOTP factor (requires current AAL2 or last factor with code).
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  getAssuranceLevel,
  listVerifiedFactors,
  refreshProfileMfaFromFactors,
} from "@/lib/security/mfa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  factor_id: z.string().uuid(),
  /** Optional current TOTP code for step-up before unenroll */
  code: z.string().min(6).max(12).optional(),
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

    const aal = await getAssuranceLevel(sb);
    const factors = await listVerifiedFactors(sb);
    const target = factors.find((f) => f.id === input.factor_id);

    // Allow unenrolling unverified/orphan factors too
    if (aal.currentLevel !== "aal2" && target && input.code) {
      const code = input.code.replace(/\s+/g, "");
      const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({
        factorId: input.factor_id,
      });
      if (cErr || !challenge) {
        return apiError("VALIDATION", cErr?.message || "Challenge failed", 400);
      }
      const { error: vErr } = await sb.auth.mfa.verify({
        factorId: input.factor_id,
        challengeId: challenge.id,
        code,
      });
      if (vErr) {
        return apiError("VALIDATION", vErr.message || "Invalid code", 400);
      }
    } else if (aal.currentLevel !== "aal2" && factors.length > 0) {
      return apiError(
        "FORBIDDEN",
        "Verify MFA (AAL2) or provide a current authenticator code before removing a factor",
        403
      );
    }

    const { error } = await sb.auth.mfa.unenroll({ factorId: input.factor_id });
    if (error) {
      return apiError("VALIDATION", error.message, 400);
    }

    const enabled = await refreshProfileMfaFromFactors(sb, ctx.user.id);

    try {
      await sb.from("domain_events").insert({
        event_type: "identity.mfa_unenrolled",
        aggregate_type: "user",
        aggregate_id: ctx.user.id,
        tenant_id: ctx.tenantId,
        company_id: ctx.companyId,
        actor_id: ctx.user.id,
        payload: { factor_id: input.factor_id, mfa_still_enabled: enabled },
        source_module: "identity",
        severity: "warning",
      });
    } catch {
      /* non-fatal */
    }

    return apiOk({
      unenrolled: true,
      mfa_enabled: enabled,
      factors: await listVerifiedFactors(sb),
    });
  }
);
