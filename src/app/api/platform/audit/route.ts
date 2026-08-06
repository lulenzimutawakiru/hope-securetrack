/**
 * Admin Console audit log explorer (platform staff only).
 */
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { getAuditLogs } from "@/lib/platform/admin-console";

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
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "audit")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: audit)",
        403
      );
    }
    const sp = req.nextUrl.searchParams;
    const result = await getAuditLogs({
      search: sp.get("search") ?? undefined,
      action: sp.get("action") ?? undefined,
      limit: Number(sp.get("limit") ?? 300),
    });
    return apiOk(result);
  }
);