/**
 * Enterprise Control Plane — command center snapshot (platform staff only).
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { getCommandCenterSnapshot } from "@/lib/platform/control-plane";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.ops_portal"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-control-plane",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "command-center")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: command-center)",
        403
      );
    }
    const snapshot = await getCommandCenterSnapshot();
    return apiOk(snapshot);
  }
);

