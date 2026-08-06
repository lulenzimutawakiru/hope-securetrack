/**
 * Admin Console privileged access reviews (platform staff only).
 */
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { getAccessReviewSummary } from "@/lib/platform/admin-console";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.ops_portal"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-control-plane",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "access-reviews")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: access-reviews)",
        403
      );
    }
    const summary = await getAccessReviewSummary();
    return apiOk(summary);
  }
);