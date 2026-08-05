/**
 * Platform cPanel — single-tenant control (lifecycle, plan, modules, flags).
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import {
  cpanelGetTenant,
  cpanelMutateTenant,
  type TenantLifecycleAction,
} from "@/lib/platform/cpanel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const mutateSchema = z.object({
  action: z.enum([
    "activate",
    "suspend",
    "cancel",
    "trial",
    "update_plan",
    "update_meta",
    "set_module",
    "set_flag",
  ]),
  reason: z.string().max(2000).optional(),
  plan_code: z.string().max(40).optional(),
  days: z.number().int().min(1).max(365).optional(),
  name: z.string().max(255).optional(),
  legal_name: z.string().max(255).optional(),
  primary_contact_email: z.string().email().optional(),
  country_code: z.string().max(5).optional(),
  primary_currency: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  module_code: z.string().max(60).optional(),
  flag_key: z.string().max(80).optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-cpanel",
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, params }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.isPlatformAdmin && !ctx.isElevated) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "tenant id required", 400);

    const detail = await cpanelGetTenant(id);
    if (!detail) return apiError("NOT_FOUND", "Tenant not found", 404);
    return apiOk(detail);
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.tenants", "tenant.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: mutateSchema,
    module: "platform-cpanel",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx, params, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!ctx.isPlatformAdmin && !ctx.isElevated) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "tenant id required", 400);

    const input = body as z.infer<typeof mutateSchema>;
    try {
      const result = await cpanelMutateTenant(
        id,
        input.action as TenantLifecycleAction,
        input as unknown as Record<string, unknown>,
        ctx.user.id
      );
      return apiOk({ tenant_id: id, action: input.action, result });
    } catch (e) {
      return apiError(
        "VALIDATION",
        e instanceof Error ? e.message : "Mutation failed",
        400
      );
    }
  }
);
