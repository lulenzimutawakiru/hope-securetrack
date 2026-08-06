/**
 * Admin Console AI assistant (platform staff only, read-only).
 */
import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { getAssistantResponse } from "@/lib/platform/admin-console";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AssistantQuery = z.object({
  query: z.string().min(1, "Query is required").max(500),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.ops_portal"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-control-plane",
    rateLimit: { limit: 20, windowMs: 60_000 },
    bodySchema: AssistantQuery,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "assistant")) {
      return apiError(
        "FORBIDDEN",
        "Access denied by control-plane Access Matrix (capability: assistant)",
        403
      );
    }
    const response = await getAssistantResponse(body.query);
    return apiOk(response);
  }
);