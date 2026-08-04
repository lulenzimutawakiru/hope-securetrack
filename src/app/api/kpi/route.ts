/**
 * Enterprise KPI Engine API.
 *
 * GET  - list KPIs with category/department facets
 * POST - actions:
 *    "compute" : recalculate KPI values from registry data sources (audited)
 *    "save"    : create a KPI definition (no-code formula builder)
 *    "update"  : update a KPI definition
 *
 * All reads/writes are company-scoped from the authenticated session.
 * Client-supplied company_id / tenant_id are never accepted.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createScopedAdminFromAuth } from "@/lib/supabase/scoped-admin";
import { recalculateKpis } from "@/lib/reporting/kpis";
import { listSources } from "@/lib/reporting/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = ["reports.kpis", "reports.view", "reports.dashboards", "reports.ai", "reports.manage"];
const MANAGE = ["reports.manage", "reports.kpis"];

const kpiSchema = z.object({
  kpi_code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(50).default("financial"),
  department: z.string().max(100).optional().nullable(),
  formula: z.string().max(500).optional().nullable(),
  unit: z.string().max(30).optional().nullable(),
  target_value: z.union([z.number(), z.string()]).optional().nullable(),
  actual_value: z.union([z.number(), z.string()]).optional().nullable(),
  frequency: z.string().max(30).default("monthly"),
  owner_name: z.string().max(150).optional().nullable(),
  threshold_warning: z.union([z.number(), z.string()]).optional().nullable(),
  threshold_critical: z.union([z.number(), z.string()]).optional().nullable(),
  higher_is_better: z.boolean().optional(),
  color_rules: z.record(z.unknown()).optional().nullable(),
  data_source: z.string().max(100).optional().nullable(),
  is_active: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("compute"),
    kpi_ids: z.array(z.string().uuid()).max(100).optional(),
  }),
  z.object({ action: z.literal("save"), kpi: kpiSchema }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), kpi: kpiSchema.partial() }),
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
    const category = sp.get("category");
    const department = sp.get("department");
    const q = sp.get("q");
    const limit = Math.min(500, Number(sp.get("limit") || 200) || 200);

    let query = scoped.client
      .from("bi_kpis")
      .select("id, kpi_code, name, description, category, department, formula, unit, target_value, actual_value, variance_value, variance_pct, trend, frequency, owner_name, threshold_warning, threshold_critical, higher_is_better, data_source, is_active, last_calculated_at, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null);

    if (category) query = query.eq("category", category);
    if (department) query = query.eq("department", department);
    if (q) query = query.or(`name.ilike.%${q}%,kpi_code.ilike.%${q}%`);
    query = query.order("category", { ascending: true }).order("name", { ascending: true }).limit(limit);

    const { data: kpis, error } = await query;
    if (error) return apiError("INTERNAL", error.message, 500);

    const rows = (kpis || []) as unknown as Array<Record<string, unknown>>;
    const byCategory = new Map<string, number>();
    const byDepartment = new Map<string, number>();
    for (const k of rows) {
      const cat = String(k.category || "financial");
      const dep = String(k.department || "general");
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
      byDepartment.set(dep, (byDepartment.get(dep) || 0) + 1);
    }

    return apiOk({
      total: rows.length,
      kpis: rows,
      facets: { categories: Object.fromEntries(byCategory), departments: Object.fromEntries(byDepartment) },
      sources: { registered: listSources().length },
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
      ctx.permissions?.includes("reports.kpis")
    );

    // ---- COMPUTE ----
    if (body.action === "compute") {
      if (!canManage && !ctx.permissions?.includes("reports.view")) {
        return apiError("FORBIDDEN", "Missing reports.kpis permission", 403);
      }
      const results = await recalculateKpis({
        admin: scoped.client,
        scope: scoped.scope,
        kpiIds: body.kpi_ids,
      });
      return apiOk({
        computed: results.length,
        results,
        at: new Date().toISOString(),
        actor_id: actorId,
      });
    }

    // ---- SAVE ----
    if (body.action === "save") {
      if (!canManage) return apiError("FORBIDDEN", "Missing reports.manage permission", 403);
      const k = body.kpi;
      const { data: existing } = await scoped.client
        .from("bi_kpis")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("kpi_code", k.kpi_code)
        .maybeSingle();
      if (existing) return apiError("VALIDATION", "kpi_code already exists in this company", 409);

      const { data: created, error } = await scoped.client
        .from("bi_kpis")
        .insert({
          company_id: ctx.companyId,
          tenant_id: scoped.scope.tenantId,
          kpi_code: k.kpi_code,
          name: k.name,
          description: k.description ?? null,
          category: k.category,
          department: k.department ?? null,
          formula: k.formula ?? null,
          unit: k.unit ?? "",
          target_value: k.target_value ?? null,
          actual_value: k.actual_value ?? null,
          frequency: k.frequency,
          owner_name: k.owner_name ?? actorId,
          threshold_warning: k.threshold_warning ?? null,
          threshold_critical: k.threshold_critical ?? null,
          higher_is_better: k.higher_is_better ?? true,
          color_rules: k.color_rules ?? {},
          data_source: k.data_source ?? null,
          is_active: k.is_active ?? true,
        })
        .select()
        .single();
      if (error || !created) return apiError("INTERNAL", error?.message || "Failed to save KPI", 500);
      return apiOk({ kpi: created });
    }

    // ---- UPDATE ----
    const patch: Record<string, unknown> = { ...body.kpi };
    delete patch.kpi_code;
    patch.updated_at = new Date().toISOString();

    const { data: updated, error } = await scoped.client
      .from("bi_kpis")
      .update(patch)
      .eq("id", body.id)
      .eq("company_id", ctx.companyId)
      .select()
      .maybeSingle();
    if (error || !updated) return apiError("INTERNAL", error?.message || "Failed to update KPI", 500);
    return apiOk({ kpi: updated });
  }
);
