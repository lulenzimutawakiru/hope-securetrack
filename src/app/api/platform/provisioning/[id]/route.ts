/**
 * Provisioning job detail + retry.
 *
 * GET  - job with step checkpoints and event timeline
 * POST - retry a failed/pending job (resumes from first incomplete step)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import {
  getProvisioningJob,
  retryProvisioning,
} from "@/lib/platform/provisioning/service";

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
  async ({ ctx, params }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Job id required", 400);
    const detail = await getProvisioningJob(id);
    if (!detail) return apiError("NOT_FOUND", "Provisioning job not found", 404);
    return apiOk(detail);
  }
);

const retrySchema = z.object({
  adminPassword: z.string().min(10).max(100).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: retrySchema,
    module: "platform-provisioning",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, params, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Job id required", 400);

    try {
      const result = await retryProvisioning(id, {
        actorId: ctx.user.id,
        adminPassword: (body as { adminPassword?: string })?.adminPassword,
      });
      return apiOk(result);
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Retry failed",
        500
      );
    }
  }
);
