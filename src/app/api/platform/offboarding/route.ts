/**
 * Platform tenant offboarding control plane.
 * Auth: platform admin / elevated only. Purge schedule never deletes data here.
 */

import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  markPurgeEligible,
  scheduleOffboarding,
  setLegalHold,
} from "@/lib/tenant/offboarding";
import { assertDualControl } from "@/lib/security/dual-control";
import { writeServerAudit } from "@/lib/api/audit";
import { staffCanAccess } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum([
    "schedule",
    "legal_hold",
    "clear_hold",
    "mark_purge_eligible",
  ]),
  tenant_id: z.string().uuid(),
  reason: z.string().min(3).max(2000).optional(),
  legal_hold: z.boolean().optional(),
  retain_days: z.number().int().min(7).max(3650).optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["platform.tenants", "platform.admin", "tenant.manage"],
    allowPlatformAdmin: true,
    requireMfa: true,
    bodySchema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "platform",
  },
  async ({ ctx, body, ip, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "ops")) {
      return apiError(
        "FORBIDDEN",
        "Platform staff with ops access required",
        403
      );
    }

    const data = body as z.infer<typeof bodySchema>;
    const admin = createAdminClient();

    try {
      if (data.action === "mark_purge_eligible") {
        const dc = await assertDualControl({
          company_id: ctx.companyId,
          action: "platform.tenant_purge",
          actor_id: ctx.user.id,
          request_id: data.dual_control_id,
          required: true,
        });
        if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

        const result = await markPurgeEligible(admin, data.tenant_id);
        if (!result.ok) return apiError("VALIDATION", result.error, 400);
      } else if (data.action === "legal_hold") {
        await setLegalHold(admin, data.tenant_id, true, ctx.user.id);
      } else if (data.action === "clear_hold") {
        await setLegalHold(admin, data.tenant_id, false, ctx.user.id);
      } else {
        const status = await scheduleOffboarding(admin, {
          tenantId: data.tenant_id,
          requestedBy: ctx.user.id,
          reason: data.reason || "scheduled offboarding",
          legalHold: data.legal_hold,
          retainDays: data.retain_days,
        });
        await writeServerAudit(admin, {
          company_id: ctx.companyId,
          user_id: ctx.user.id,
          action: "tenant.offboard_scheduled",
          module: "platform",
          entity_type: "tenants",
          entity_id: data.tenant_id,
          after_state: status as unknown as Record<string, unknown>,
          metadata: { source: "api/platform/offboarding" },
          ip_address: ip,
          user_agent: req.headers.get("user-agent"),
        });
        return apiOk({ offboarding: status });
      }

      await writeServerAudit(admin, {
        company_id: ctx.companyId,
        user_id: ctx.user.id,
        action: `tenant.offboard_${data.action}`,
        module: "platform",
        entity_type: "tenants",
        entity_id: data.tenant_id,
        metadata: { source: "api/platform/offboarding" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ ok: true, action: data.action, tenant_id: data.tenant_id });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Offboarding failed",
        500
      );
    }
  }
);

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.tenants", "platform.admin", "tenant.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "platform",
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "ops")) {
      return apiError("FORBIDDEN", "Platform staff with ops access required", 403);
    }
    const tenantId = req.nextUrl.searchParams.get("tenant_id");
    const admin = createAdminClient();
    let q = admin.from("tenant_offboarding").select("*").order("updated_at", {
      ascending: false,
    });
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q.limit(100);
    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk({ data: data || [] });
  }
);
