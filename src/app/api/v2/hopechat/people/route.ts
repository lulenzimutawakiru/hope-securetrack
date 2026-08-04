/**
 * SecureChat people directory for DM picker.
 * GET /api/v2/hopechat/people?search=&limit=
 *
 * Company/tenant from session only.
 */

import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { listCompanyPeopleServer } from "@/lib/hopechat/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["hc.view", "hc.manage", "hc.admin"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "hopechat",
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const limit = Number(url.searchParams.get("limit") || "100");

    const sb = await createClient();
    try {
      const people = await listCompanyPeopleServer(sb, ctx.companyId, {
        search,
        excludeUserId: ctx.user.id,
        limit: Number.isFinite(limit) ? limit : 100,
      });
      return apiOk({ people, total: people.length });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Failed to load people",
        500
      );
    }
  }
);
