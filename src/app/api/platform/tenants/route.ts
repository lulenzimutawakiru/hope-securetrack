/**
 * Platform cPanel — tenant directory (SecureTrack staff only).
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import {
  cpanelListTenants,
  cpanelOverview,
} from "@/lib/platform/cpanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function assertPlatformStaff(ctx: {
  isPlatformAdmin?: boolean;
  isElevated?: boolean;
}) {
  return Boolean(ctx.isPlatformAdmin || ctx.isElevated);
}

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-cpanel",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!assertPlatformStaff(ctx)) {
      return apiError(
        "FORBIDDEN",
        "Platform staff only — tenant cPanel is not available to tenant users",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    if (searchParams.get("overview") === "1") {
      const overview = await cpanelOverview();
      return apiOk(overview);
    }

    const tenants = await cpanelListTenants({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      plan: searchParams.get("plan") || undefined,
      limit: Number(searchParams.get("limit") || 200),
    });
    return apiOk({ tenants, count: tenants.length });
  }
);

const createHint = z.object({
  note: z.string().optional(),
});

/** POST reserved — creation goes through provision API; returns guidance. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: createHint,
    module: "platform-cpanel",
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!assertPlatformStaff(ctx)) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    return apiOk({
      message:
        "Create tenants via POST /api/public/platform/provision or Platform → Provisioning.",
      provision_path: "/platform/provisioning",
      api: "/api/public/platform/provision",
    });
  }
);
