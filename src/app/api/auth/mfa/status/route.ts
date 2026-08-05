/**
 * GET /api/auth/mfa/status — session MFA factors + AAL + profile flags.
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { resolveMfaStatus } from "@/lib/security/mfa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    module: "mfa",
    skipMfaCheck: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    requireBaselinePermission: false,
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sb = await createClient();
    const status = await resolveMfaStatus(sb, ctx.user, {
      mfa_enabled: ctx.profile.mfa_enabled,
      require_mfa: ctx.profile.require_mfa,
      mfa_enforced: ctx.profile.mfa_enforced,
      is_platform_admin: ctx.profile.is_platform_admin,
      tenant_id: ctx.profile.tenant_id,
      roleSlug: ctx.roleSlug,
    });
    return apiOk(status);
  }
);
