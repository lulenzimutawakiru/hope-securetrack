/**
 * Enterprise Tenant Provisioning Platform - control plane API.
 *
 * GET  - list provisioning jobs (filters: status, kind, limit)
 * POST - create and run a provisioning job (template-driven, industry packs)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import {
  listProvisioningJobs,
  runProvisioning,
} from "@/lib/platform/provisioning/service";
import { validateAdminPassword } from "@/lib/platform/onboarding";

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
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const { searchParams } = new URL(req.url);
    const result = await listProvisioningJobs({
      status: searchParams.get("status") || undefined,
      kind: searchParams.get("kind") || undefined,
      limit: Number(searchParams.get("limit") || 100),
    });
    return apiOk(result);
  }
);

const createSchema = z.object({
  organization_name: z.string().min(2).max(200),
  slug: z.string().min(2).max(60).optional(),
  admin_email: z.string().email().max(255),
  admin_name: z.string().min(1).max(150).optional(),
  admin_password: z.string().min(10).max(100),
  country_code: z.string().min(2).max(5).optional(),
  currency: z.string().min(3).max(10).optional(),
  timezone: z.string().min(2).max(60).optional(),
  industry: z.string().max(100).optional(),
  language: z.string().min(2).max(10).optional(),
  data_region: z.string().min(2).max(40).optional(),
  domain: z.string().max(120).optional(),
  compliance_requirements: z.array(z.string().max(40)).max(20).optional(),
  seats: z.number().int().min(1).max(100000).optional(),
  modules: z.array(z.string().max(60)).max(100).optional(),
  plan_code: z
    .enum(["starter", "professional", "enterprise", "government"])
    .optional(),
  template_code: z.string().max(80).optional(),
  industry_pack: z.string().max(80).optional(),
  demo_data: z.boolean().optional(),
  registration_channel: z.string().max(40).optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.provision", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: createSchema,
    module: "platform-provisioning",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "provisioning")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const input = body as z.infer<typeof createSchema>;
    const pwd = validateAdminPassword(input.admin_password);
    if (!pwd.ok) {
      return apiError("VALIDATION", pwd.errors.join("; "), 400);
    }

    try {
      const result = await runProvisioning(input, {
        actorId: ctx.user.id,
        adminPassword: input.admin_password,
      });
      return apiOk(result);
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Provisioning failed",
        500
      );
    }
  }
);
