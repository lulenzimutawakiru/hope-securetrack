/**
 * Enterprise Dashboard API (Dashboard Builder).
 *
 * GET  - list dashboards (+ widget counts), or fetch one dashboard with its
 *        widgets when `?id=` is supplied.
 * POST - actions:
 *    "save"          : create a dashboard (no-code builder)
 *    "update"        : update a dashboard layout / fields
 *    "delete"        : soft delete a dashboard
 *    "widget_save"   : create or update a dashboard widget
 *    "widget_delete" : remove a dashboard widget
 *
 * All reads/writes are company-scoped from the authenticated session.
 * Client-supplied company_id / tenant_id are never accepted.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createScopedAdminFromAuth } from "@/lib/supabase/scoped-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = ["reports.dashboards", "reports.view", "reports.manage", "reports.kpis", "reports.ai"];
const MANAGE = ["reports.manage", "reports.dashboards"];

const dashboardSchema = z.object({
  dashboard_code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  audience: z.string().max(50).default("general"),
  layout: z.record(z.unknown()).optional().nullable(),
  is_published: z.boolean().optional(),
  is_default: z.boolean().optional(),
  refresh_seconds: z.number().int().min(0).max(86400).optional(),
  sort_order: z.number().int().optional(),
});

const widgetSchema = z.object({
  dashboard_id: z.string().uuid(),
  widget_key: z.string().min(1).max(80),
  title: z.string().min(1).max(255),
  widget_type: z
    .enum(["kpi", "chart_bar", "chart_line", "chart_pie", "chart_area", "heatmap", "map", "table", "alert", "text", "gauge"])
    .default("kpi"),
  data_source: z.string().max(100).optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
  position: z.record(z.unknown()).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), dashboard: dashboardSchema }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    dashboard: dashboardSchema.partial(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("widget_save"), widget: widgetSchema, id: z.string().uuid().optional() }),
  z.object({ action: z.literal("widget_delete"), id: z.string().uuid() }),
]);

export const GET = createApiHandler(
  {
    auth: true,
    permissions: VIEW,
    allowPlatformAdmin: true,
    module: "reports",
    rateLimit: { limit: 120, windowMs: 60_000 },
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);

    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    const audience = sp.get("audience");
    const q = sp.get("q");
    const limit = Math.min(200, Number(sp.get("limit") || 100) || 100);

    if (id) {
      const { data: dashboard, error } = await scoped.client
        .from("bi_dashboards")
        .select("*")
        .eq("id", id)
        .eq("company_id", ctx.companyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return apiError("INTERNAL", error.message, 500);
      if (!dashboard) return apiError("NOT_FOUND", "Dashboard not found in scope", 404);

      const { data: widgets, error: widgetError } = await scoped.client
        .from("bi_dashboard_widgets")
        .select("*")
        .eq("dashboard_id", id)
        .eq("company_id", ctx.companyId)
        .order("sort_order", { ascending: true });
      if (widgetError) return apiError("INTERNAL", widgetError.message, 500);

      return apiOk({ dashboard, widgets: widgets || [] });
    }

    let query = scoped.client
      .from("bi_dashboards")
      .select(
        "id, dashboard_code, name, description, audience, layout, is_system, is_default, is_published, refresh_seconds, sort_order, updated_at, widget_count:bi_dashboard_widgets(count)"
      )
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null);

    if (audience) query = query.eq("audience", audience);
    if (q) query = query.or(`name.ilike.%${q}%,dashboard_code.ilike.%${q}%,description.ilike.%${q}%`);
    query = query.order("sort_order", { ascending: true }).order("name", { ascending: true }).limit(limit);

    const { data: dashboards, error } = await query;
    if (error) return apiError("INTERNAL", error.message, 500);

    return apiOk({
      total: (dashboards || []).length,
      dashboards: dashboards || [],
    });
  }
);

export const POST = createApiHandler(
  {
    auth: true,
    permissions: VIEW,
    allowPlatformAdmin: true,
    module: "reports",
    bodySchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);
    const actorId = ctx.user.id;

    const canManage = Boolean(
      ctx.permissions?.includes("reports.manage") ||
      ctx.permissions?.includes("reports.dashboards")
    );

    // ---- SAVE (create dashboard) ----
    if (body.action === "save") {
      if (!canManage) return apiError("FORBIDDEN", "Missing reports.dashboards permission", 403);
      const d = body.dashboard;
      const { data: existing } = await scoped.client
        .from("bi_dashboards")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("dashboard_code", d.dashboard_code)
        .maybeSingle();
      if (existing) return apiError("VALIDATION", "dashboard_code already exists in this company", 409);

      const { data: created, error } = await scoped.client
        .from("bi_dashboards")
        .insert({
          company_id: ctx.companyId,
          tenant_id: scoped.scope.tenantId,
          dashboard_code: d.dashboard_code,
          name: d.name,
          description: d.description ?? null,
          audience: d.audience,
          layout: d.layout ?? { cols: 12, rowHeight: 80 },
          is_published: d.is_published ?? true,
          is_default: d.is_default ?? false,
          refresh_seconds: d.refresh_seconds ?? 300,
          owner_id: actorId,
          sort_order: d.sort_order ?? 100,
        })
        .select()
        .single();
      if (error || !created) return apiError("INTERNAL", error?.message || "Failed to save dashboard", 500);
      return apiOk({ dashboard: created });
    }

    // ---- UPDATE ----
    if (body.action === "update") {
      if (!canManage) return apiError("FORBIDDEN", "Missing reports.dashboards permission", 403);
      const patch: Record<string, unknown> = { ...body.dashboard };
      delete patch.dashboard_code;
      patch.updated_at = new Date().toISOString();

      const { data: updated, error } = await scoped.client
        .from("bi_dashboards")
        .update(patch)
        .eq("id", body.id)
        .eq("company_id", ctx.companyId)
        .select()
        .maybeSingle();
      if (error || !updated) return apiError("INTERNAL", error?.message || "Failed to update dashboard", 500);
      return apiOk({ dashboard: updated });
    }

    // ---- DELETE (soft) ----
    if (body.action === "delete") {
      if (!canManage) return apiError("FORBIDDEN", "Missing reports.dashboards permission", 403);
      const { data: existing } = await scoped.client
        .from("bi_dashboards")
        .select("id")
        .eq("id", body.id)
        .eq("company_id", ctx.companyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing) return apiError("NOT_FOUND", "Dashboard not found in scope", 404);

      const { error } = await scoped.client
        .from("bi_dashboards")
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("company_id", ctx.companyId);
      if (error) return apiError("INTERNAL", error.message, 500);
      return apiOk({ deleted: true, id: body.id });
    }

    // ---- WIDGET SAVE (create or update) ----
    if (body.action === "widget_save") {
      if (!canManage) return apiError("FORBIDDEN", "Missing reports.dashboards permission", 403);
      const w = body.widget;

      const { data: dashboard } = await scoped.client
        .from("bi_dashboards")
        .select("id")
        .eq("id", w.dashboard_id)
        .eq("company_id", ctx.companyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!dashboard) return apiError("NOT_FOUND", "Dashboard not found in scope", 404);

      if (body.id) {
        const { data: updated, error } = await scoped.client
          .from("bi_dashboard_widgets")
          .update({
            title: w.title,
            widget_type: w.widget_type,
            data_source: w.data_source ?? null,
            config: w.config ?? {},
            position: w.position ?? { x: 0, y: 0, w: 3, h: 2 },
            sort_order: w.sort_order ?? 0,
            is_visible: w.is_visible ?? true,
          })
          .eq("id", body.id)
          .eq("company_id", ctx.companyId)
          .select()
          .maybeSingle();
        if (error || !updated) return apiError("INTERNAL", error?.message || "Failed to update widget", 500);
        return apiOk({ widget: updated });
      }

      const { data: created, error } = await scoped.client
        .from("bi_dashboard_widgets")
        .insert({
          dashboard_id: w.dashboard_id,
          company_id: ctx.companyId,
          tenant_id: scoped.scope.tenantId,
          widget_key: w.widget_key,
          title: w.title,
          widget_type: w.widget_type,
          data_source: w.data_source ?? null,
          config: w.config ?? {},
          position: w.position ?? { x: 0, y: 0, w: 3, h: 2 },
          sort_order: w.sort_order ?? 0,
          is_visible: w.is_visible ?? true,
        })
        .select()
        .single();
      if (error || !created) return apiError("INTERNAL", error?.message || "Failed to save widget", 500);
      return apiOk({ widget: created });
    }

    // ---- WIDGET DELETE ----
    const { data: widget } = await scoped.client
      .from("bi_dashboard_widgets")
      .select("dashboard_id")
      .eq("id", body.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (!widget) return apiError("NOT_FOUND", "Widget not found in scope", 404);

    const { error } = await scoped.client
      .from("bi_dashboard_widgets")
      .delete()
      .eq("id", body.id)
      .eq("company_id", ctx.companyId);
    if (error) return apiError("INTERNAL", error.message, 500);
    return apiOk({ deleted: true, id: body.id });
  }
);
