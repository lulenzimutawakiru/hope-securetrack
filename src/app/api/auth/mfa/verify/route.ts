/**
 * POST /api/auth/mfa/verify
 *
 * mode=enroll  — complete TOTP enrollment (first code after QR scan)
 * mode=login   — complete login step-up (AAL1 → AAL2)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import {
  listVerifiedFactors,
  refreshProfileMfaFromFactors,
  syncProfileMfaFlags,
} from "@/lib/security/mfa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  mode: z.enum(["enroll", "login"]).default("login"),
  factor_id: z.string().uuid(),
  code: z
    .string()
    .min(6)
    .max(12)
    .regex(/^[0-9\s]+$/, "Code must be numeric"),
  challenge_id: z.string().uuid().optional(),
  /** When completing enroll, also require MFA for this account */
  require_mfa: z.boolean().optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    module: "mfa",
    skipMfaCheck: true,
    bodySchema: schema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const input = body as z.infer<typeof schema>;
    const code = input.code.replace(/\s+/g, "");
    const sb = await createClient();

    let challengeId = input.challenge_id;
    if (!challengeId) {
      const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({
        factorId: input.factor_id,
      });
      if (cErr || !challenge) {
        return apiError(
          "VALIDATION",
          cErr?.message || "Could not create MFA challenge",
          400
        );
      }
      challengeId = challenge.id;
    }

    const { data, error } = await sb.auth.mfa.verify({
      factorId: input.factor_id,
      challengeId,
      code,
    });

    if (error || !data) {
      return apiError(
        "VALIDATION",
        error?.message || "Invalid authentication code",
        400
      );
    }

    if (input.mode === "enroll") {
      await refreshProfileMfaFromFactors(sb, ctx.user.id);
      if (input.require_mfa) {
        await syncProfileMfaFlags(sb, ctx.user.id, {
          require_mfa: true,
          mfa_enforced: true,
          mfa_enabled: true,
        });
      }
      // Audit (best-effort)
      try {
        await sb.from("domain_events").insert({
          event_type: "identity.mfa_enrolled",
          aggregate_type: "user",
          aggregate_id: ctx.user.id,
          tenant_id: ctx.tenantId,
          company_id: ctx.companyId,
          actor_id: ctx.user.id,
          payload: { factor_id: input.factor_id },
          source_module: "identity",
          severity: "info",
        });
      } catch {
        /* non-fatal */
      }
    } else {
      await refreshProfileMfaFromFactors(sb, ctx.user.id);
      try {
        await sb.from("domain_events").insert({
          event_type: "identity.mfa_verified",
          aggregate_type: "user",
          aggregate_id: ctx.user.id,
          tenant_id: ctx.tenantId,
          company_id: ctx.companyId,
          actor_id: ctx.user.id,
          payload: { factor_id: input.factor_id, mode: "login" },
          source_module: "identity",
          severity: "info",
        });
      } catch {
        /* non-fatal */
      }
    }

    const factors = await listVerifiedFactors(sb);
    return apiOk({
      verified: true,
      mode: input.mode,
      factors,
      message:
        input.mode === "enroll"
          ? "Authenticator enrolled. MFA is now enabled on your account."
          : "Multi-factor verification successful.",
    });
  }
);
