/**
 * Platform cPanel — single-tenant CRUD (read / update / delete).
 *
 * GET    — full tenant detail
 * PATCH  — lifecycle, plan, meta, modules, flags
 * PUT    — full meta update (name, contact, locale, plan)
 * DELETE — soft-delete (default) or hard delete (?hard=1&force=1)
 */

import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import {
  cpanelGetTenant,
  cpanelMutateTenant,
  cpanelDeleteTenant,
  type TenantLifecycleAction,
} from "@/lib/platform/cpanel";
import { staffCanAccess } from "@/lib/platform";

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
  primary_contact_email: z.string().email().optional().or(z.literal("")),
  country_code: z.string().max(5).optional(),
  primary_currency: z.string().max(10).optional(),
  timezone: z.string().max(60).optional(),
  module_code: z.string().max(60).optional(),
  flag_key: z.string().max(80).optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

const putSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legal_name: z.string().max(255).optional().nullable(),
  primary_contact_email: z.string().email().optional().nullable().or(z.literal("")),
  country_code: z.string().min(2).max(5).optional(),
  primary_currency: z.string().min(3).max(10).optional(),
  timezone: z.string().min(2).max(60).optional(),
  industry: z.string().max(100).optional().nullable(),
  language: z.string().min(2).max(10).optional(),
  data_region: z.string().min(2).max(40).optional(),
  domain: z.string().max(120).optional(),
  compliance_requirements: z.array(z.string().max(40)).max(20).optional(),
  plan_code: z
    .enum(["starter", "professional", "enterprise", "government"])
    .optional(),
  status: z.enum(["active", "trial", "suspended", "cancelled"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
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
    if (!staffCanAccess(ctx, "tenants")) {
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
    if (!staffCanAccess(ctx, "tenants")) {
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

/** Full meta update (edit tenant fields). */
export const PUT = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.tenants", "tenant.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: putSchema,
    module: "platform-cpanel",
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
  async ({ ctx, params, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "tenants")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "tenant id required", 400);

    const input = body as z.infer<typeof putSchema>;
    try {
      if (input.plan_code) {
        await cpanelMutateTenant(
          id,
          "update_plan",
          { plan_code: input.plan_code },
          ctx.user.id
        );
      }
      if (input.status === "active") {
        await cpanelMutateTenant(id, "activate", {}, ctx.user.id);
      } else if (input.status === "suspended") {
        await cpanelMutateTenant(
          id,
          "suspend",
          { reason: "Updated via cPanel" },
          ctx.user.id
        );
      } else if (input.status === "cancelled") {
        await cpanelMutateTenant(id, "cancel", {}, ctx.user.id);
      } else if (input.status === "trial") {
        await cpanelMutateTenant(id, "trial", { days: 30 }, ctx.user.id);
      }

      const meta: Record<string, unknown> = { ...input };
      delete meta.plan_code;
      delete meta.status;
      // notes stored under settings
      if (meta.notes !== undefined) {
        meta.settings = {
          ...((meta.settings as Record<string, unknown>) || {}),
          admin_notes: meta.notes,
        };
        delete meta.notes;
      }
      if (Object.keys(meta).length > 0) {
        await cpanelMutateTenant(id, "update_meta", meta, ctx.user.id);
      }

      const detail = await cpanelGetTenant(id);
      return apiOk({ tenant_id: id, tenant: detail, message: "Tenant updated" });
    } catch (e) {
      return apiError(
        "VALIDATION",
        e instanceof Error ? e.message : "Update failed",
        400
      );
    }
  }
);

/** Soft-delete (default) or hard-delete tenant via query flags. */
export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: ["platform.admin", "platform.tenants", "tenant.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "platform-cpanel",
    rateLimit: { limit: 15, windowMs: 60_000 },
  },
  async ({ ctx, params, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    if (!staffCanAccess(ctx, "tenants")) {
      return apiError("FORBIDDEN", "Platform staff only", 403);
    }
    const id = params.id;
    if (!id) return apiError("VALIDATION", "tenant id required", 400);

    const url = new URL(req.url);
    const hard =
      url.searchParams.get("hard") === "1" ||
      url.searchParams.get("hard") === "true";
    const force =
      url.searchParams.get("force") === "1" ||
      url.searchParams.get("force") === "true";
    const reason = url.searchParams.get("reason") || undefined;
    const confirmSlug = url.searchParams.get("confirm_slug") || undefined;

    if (hard && !ctx.isPlatformAdmin) {
      return apiError(
        "FORBIDDEN",
        "Hard delete requires platform admin (not elevation alone)",
        403
      );
    }

    try {
      if (hard && confirmSlug) {
        const detail = await cpanelGetTenant(id);
        if (!detail || detail.slug !== confirmSlug) {
          return apiError(
            "VALIDATION",
            "confirm_slug must match the tenant slug for hard delete",
            400
          );
        }
      }

      const result = await cpanelDeleteTenant(id, ctx.user.id, {
        hard,
        force,
        reason,
      });
      return apiOk({
        ...result,
        message:
          result.mode === "soft"
            ? "Tenant soft-deleted (cancelled). Users cannot access it."
            : "Tenant hard-deleted from catalog. Business data may remain detached.",
      });
    } catch (e) {
      return apiError(
        "VALIDATION",
        e instanceof Error ? e.message : "Delete failed",
        400
      );
    }
  }
);


