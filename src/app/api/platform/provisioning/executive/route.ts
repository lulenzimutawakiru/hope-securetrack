/**
 * Executive dashboard snapshot for the provisioning control plane.
 */

import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { executiveSnapshot } from "@/lib/platform/provisioning/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-provisioning",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const snapshot = await executiveSnapshot();
    return apiOk(snapshot);
  }
);
