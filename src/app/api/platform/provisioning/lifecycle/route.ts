/**
 * Tenant lifecycle commands from the provisioning control plane.
 * activate | suspend | upgrade | downgrade | archive | restore | delete | clone
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import {
  getLifecycleCatalog,
  lifecycleAction,
} from "@/lib/platform/provisioning/service";
import type { TenantLifecycleCommand } from "@/lib/platform/provisioning/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const lifecycleSchema = z.object({
  action: z.enum([
    "activate",
    "suspend",
    "upgrade",
    "downgrade",
    "archive",
    "restore",
    "delete",
    "clone",
  ]),
  tenant_id: z.string().uuid(),
  reason: z.string().max(300).optional(),
  plan_code: z.string().max(40).optional(),
  organization_name: z.string().max(200).optional(),
  admin_email: z.string().email().max(255).optional(),
  admin_name: z.string().max(150).optional(),
  admin_password: z.string().min(10).max(100).optional(),
});

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
    return apiOk(await getLifecycleCatalog());
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: lifecycleSchema,
    module: "platform-provisioning",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const input = body as z.infer<typeof lifecycleSchema>;
    const payload: Record<string, unknown> = {
      reason: input.reason,
      plan_code: input.plan_code,
      organization_name: input.organization_name,
      admin_email: input.admin_email,
      admin_name: input.admin_name,
      admin_password: input.admin_password,
    };
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k];
    }

    try {
      const result = await lifecycleAction(
        input.action as TenantLifecycleCommand,
        input.tenant_id,
        payload,
        ctx.user.id
      );
      return apiOk(result);
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Lifecycle action failed",
        500
      );
    }
  }
);
