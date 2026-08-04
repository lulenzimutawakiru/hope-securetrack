/**
 * SecureChat start / resolve direct message.
 * POST /api/v2/hopechat/dm  { other_user_id, other_name? }
 *
 * Company from session; other user must be same company (or membership).
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { startDmServer } from "@/lib/hopechat/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  other_user_id: z.string().uuid(),
  other_name: z.string().max(200).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["hc.view", "hc.manage", "hc.admin"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
    idempotent: true,
    module: "hopechat",
    bodySchema,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const profile = ctx.profile as {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    };
    const selfName =
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      profile.email ||
      ctx.user.email ||
      "User";

    const sb = await createClient();
    try {
      const channel = await startDmServer(sb, {
        company_id: ctx.companyId,
        self_id: ctx.user.id,
        self_name: selfName,
        other_id: body.other_user_id,
        other_name: body.other_name || "User",
      });
      return apiOk({ channel });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start DM";
      const status = /not an active member|yourself|required/i.test(msg)
        ? 400
        : /permission|RLS|policy/i.test(msg)
          ? 403
          : 500;
      return apiError(
        status === 403 ? "FORBIDDEN" : status === 400 ? "VALIDATION" : "INTERNAL",
        msg,
        status
      );
    }
  }
);
