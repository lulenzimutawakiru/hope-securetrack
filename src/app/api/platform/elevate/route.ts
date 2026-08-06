import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { staffCanAccess } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const elevateSchema = z.object({
  reason: z.string().min(10).max(2000),
  minutes: z.number().int().min(5).max(120).optional(),
  ticket_ref: z.string().max(120).optional().nullable(),
});

/**
 * JIT platform elevation — break-glass only.
 * Does NOT silently grant cross-tenant access; sets is_platform_elevated() window.
 */
export const POST = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    permissions: ["platform.elevate", "platform.view", "platform.admin"],
    requireMfa: "privileged",
    module: "platform",
    rateLimit: { limit: 10, windowMs: 60_000 },
    bodySchema: elevateSchema,
  },
  async ({ ctx, body, correlationId, ip }) => {
    if (!ctx || !staffCanAccess(ctx, "ops")) {
      return apiError("FORBIDDEN", "Platform staff with ops access required", 403);
    }
    if (!ctx.mfaOk && process.env.MFA_ENFORCE_PRIVILEGED === "true") {
      return apiError("FORBIDDEN", "MFA required for elevation", 403);
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_platform_elevation", {
      p_reason: body.reason,
      p_minutes: body.minutes ?? 30,
      p_ticket: body.ticket_ref || null,
    });

    if (error) {
      return apiError("FORBIDDEN", error.message, 403);
    }

    log.warn("platform.elevation.granted", {
      correlationId,
      userId: ctx.user.id,
      companyId: ctx.companyId,
      tenantId: ctx.tenantId,
      ip,
      action: "elevate",
      minutes: body.minutes ?? 30,
    });

    return apiOk({
      elevation_id: data,
      expires_in_minutes: body.minutes ?? 30,
      message: "Elevation active. All access is audited. End when finished.",
    });
  }
);

export const DELETE = createApiHandler(
  {
    auth: true,
    allowPlatformAdmin: true,
    module: "platform",
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, correlationId }) => {
    if (!ctx || !staffCanAccess(ctx, "ops")) {
      return apiError("FORBIDDEN", "Platform staff with ops access required", 403);
    }
    const supabase = await createClient();
    await supabase.rpc("end_platform_elevation");
    log.info("platform.elevation.ended", {
      correlationId,
      userId: ctx.user.id,
      action: "end_elevation",
    });
    return apiOk({ ended: true });
  }
);
