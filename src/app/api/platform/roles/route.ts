/**
 * Admin Console RBAC roles & permissions matrix (platform staff only).
 */
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { getRolesMatrix } from "@/lib/platform/admin-console";

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
    if (!staffCanAccess(ctx, "roles")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: roles)",
        403
      );
    }
    const matrix = await getRolesMatrix();
    return apiOk(matrix);
  }
);