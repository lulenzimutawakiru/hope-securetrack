/**
 * Enterprise Control Plane — command center snapshot (platform staff only).
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
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
    if (!ctx.isPlatformAdmin && !ctx.isElevated) {
      return apiError(
        "FORBIDDEN",
        "Enterprise Control Plane is restricted to SecureTrack platform staff",
        403
      );
    }
    const snapshot = await getCommandCenterSnapshot();
    return apiOk(snapshot);
  }
);
