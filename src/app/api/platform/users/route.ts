/**
 * Cross-tenant user directory + administration (platform staff).
 *
 * GET  — list estate users
 * PATCH — deactivate | activate | require_mfa | force_logout (sign out sessions)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { staffCanAccess } from "@/lib/platform";
import { listAllUsers } from "@/lib/platform/control-plane";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["platform.view", "platform.admin", "platform.tenants"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-control-plane",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "users")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const { searchParams } = new URL(req.url);
    try {
      const users = await listAllUsers({
        search: searchParams.get("search") || undefined,
        tenantId: searchParams.get("tenant_id") || undefined,
        limit: Number(searchParams.get("limit") || 200),
      });
      return apiOk({ users, count: users.length });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Failed to list users",
        500
      );
    }
  }
);

const mutateSchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum([
    "deactivate",
    "activate",
    "require_mfa",
    "clear_require_mfa",
    "force_logout",
  ]),
  reason: z.string().max(500).optional(),
});

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.tenants", "users.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: mutateSchema,
    module: "platform-control-plane",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "users")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }

    const input = body as z.infer<typeof mutateSchema>;
    const sb = createAdminClient();

    // Never allow demoting yourself accidentally
    if (
      input.user_id === ctx.user.id &&
      (input.action === "deactivate" || input.action === "force_logout")
    ) {
      return apiError(
        "VALIDATION",
        "Cannot deactivate or force-logout your own platform session this way",
        400
      );
    }

    const { data: target, error: tErr } = await sb
      .from("user_profiles")
      .select("id,email,is_platform_admin,tenant_id,is_active")
      .eq("id", input.user_id)
      .maybeSingle();
    if (tErr || !target) {
      return apiError("NOT_FOUND", "User not found", 404);
    }

    // Only Platform Owner path (is_platform_admin) may touch other platform admins
    if (target.is_platform_admin && !ctx.isPlatformAdmin) {
      return apiError(
        "FORBIDDEN",
        "Only platform admins may manage other platform staff",
        403
      );
    }

    try {
      if (input.action === "deactivate" || input.action === "activate") {
        const active = input.action === "activate";
        const { error } = await sb
          .from("user_profiles")
          .update({
            is_active: active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.user_id);
        if (error) throw new Error(error.message);
        if (!active) {
          try {
            await sb.auth.admin.signOut(input.user_id, "global");
          } catch {
            /* best effort */
          }
        }
      } else if (
        input.action === "require_mfa" ||
        input.action === "clear_require_mfa"
      ) {
        const { error } = await sb
          .from("user_profiles")
          .update({
            require_mfa: input.action === "require_mfa",
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.user_id);
        if (error) throw new Error(error.message);
      } else if (input.action === "force_logout") {
        await sb.auth.admin.signOut(input.user_id, "global");
      }

      await sb.from("domain_events").insert({
        event_type: `user.${input.action}`,
        aggregate_type: "user",
        aggregate_id: input.user_id,
        tenant_id: target.tenant_id,
        actor_id: ctx.user.id,
        payload: {
          email: target.email,
          reason: input.reason || null,
          via: "platform_cpanel",
        },
        source_module: "platform",
        severity: "warning",
      });

      return apiOk({
        user_id: input.user_id,
        action: input.action,
        message: `User ${input.action} completed`,
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "User action failed",
        500
      );
    }
  }
);


