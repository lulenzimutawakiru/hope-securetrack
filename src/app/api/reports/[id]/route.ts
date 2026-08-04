/**
 * Report definition detail API.
 *
 * GET    - fetch one report definition (with source metadata)
 * PATCH  - partial update (version bump, soft fields only)
 * DELETE - soft delete (deleted_at), audit-safe
 *
 * Identity fields (company_id, tenant_id, report_code, id) are immutable.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createScopedAdminFromAuth } from "@/lib/supabase/scoped-admin";
import { resolveSource, isKnownSource, isLegacySource } from "@/lib/reporting/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = ["reports.view", "reports.export", "reports.manage"];
const MANAGE = ["reports.manage"];

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(50).optional(),
  module_key: z.string().max(50).optional().nullable(),
  report_type: z.string().max(50).optional(),
  data_source: z.string().max(100).optional().nullable(),
  query_config: z.record(z.unknown()).optional().nullable(),
  layout_config: z.record(z.unknown()).optional().nullable(),
  parameters: z.array(z.unknown()).optional().nullable(),
  columns_config: z.array(z.unknown()).optional().nullable(),
  is_published: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  tags: z.array(z.string()).optional().nullable(),
});

export const GET = createApiHandler(
  {
    auth: true,
    permissions: VIEW,
    allowPlatformAdmin: true,
    module: "reports",
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async ({ ctx, params }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);
    const { data, error } = await scoped.client
      .from("bi_report_definitions")
      .select("*")
      .eq("id", params.id)
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return apiError("INTERNAL", error.message, 500);
    if (!data) return apiError("NOT_FOUND", "Report definition not found in scope", 404);

    const sourceKey = String(data.data_source || "");
    return apiOk({
      report: data,
      source: {
        key: sourceKey,
        known: isKnownSource(sourceKey),
        legacy: isLegacySource(sourceKey),
        table: isKnownSource(sourceKey) ? resolveSource(sourceKey)?.table : null,
      },
    });
  }
);

export const PATCH = createApiHandler(
  {
    auth: true,
    permissions: MANAGE,
    allowPlatformAdmin: true,
    module: "reports",
    bodySchema: patchSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, body, params }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);

    const { data: existing } = await scoped.client
      .from("bi_report_definitions")
      .select("version")
      .eq("id", params.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (!existing) return apiError("NOT_FOUND", "Report definition not found in scope", 404);

    const { data: updated, error } = await scoped.client
      .from("bi_report_definitions")
      .update({
        ...body,
        version: Number(existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("company_id", ctx.companyId)
      .select()
      .maybeSingle();
    if (error || !updated) {
      return apiError("INTERNAL", error?.message || "Failed to update report", 500);
    }
    return apiOk({ report: updated });
  }
);

export const DELETE = createApiHandler(
  {
    auth: true,
    permissions: MANAGE,
    allowPlatformAdmin: true,
    module: "reports",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async ({ ctx, params }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);
    const { data: existing } = await scoped.client
      .from("bi_report_definitions")
      .select("id")
      .eq("id", params.id)
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return apiError("NOT_FOUND", "Report definition not found in scope", 404);

    const { error } = await scoped.client
      .from("bi_report_definitions")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("company_id", ctx.companyId);
    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk({ deleted: true, id: params.id });
  }
);