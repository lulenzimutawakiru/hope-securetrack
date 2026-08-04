/**
 * Enterprise Reporting API.
 *
 * GET  - list the report catalog (module/category facets + search)
 * POST - action "run"    : execute a report (audited into bi_report_runs)
 *        action "export" : run + serialize to CSV/JSON/XML
 *        action "save"   : create a report definition (no-code designer)
 *        action "update" : update an existing definition
 *
 * All reads/writes are company-scoped from the authenticated session.
 * Client-supplied company_id / tenant_id are never accepted.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createScopedAdminFromAuth, adminGetById } from "@/lib/supabase/scoped-admin";
import { runReport, recordReportRun } from "@/lib/reporting/engine";
import { buildExport } from "@/lib/reporting/export";
import { listSources, sourceModules } from "@/lib/reporting/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = ["reports.view", "reports.export", "reports.manage", "reports.dashboards", "reports.kpis", "reports.ai", "reports.regulatory", "reports.schedule"];
const EXPORT = ["reports.export", "reports.manage"];
const MANAGE = ["reports.manage"];

const definitionSchema = z.object({
  report_code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(50).default("operational"),
  module_key: z.string().max(50).optional().nullable(),
  report_type: z.string().max(50).default("tabular"),
  data_source: z.string().max(100).optional().nullable(),
  query_config: z.record(z.unknown()).optional().nullable(),
  layout_config: z.record(z.unknown()).optional().nullable(),
  parameters: z.array(z.unknown()).optional().nullable(),
  columns_config: z.array(z.unknown()).optional().nullable(),
  is_published: z.boolean().optional(),
  requires_approval: z.boolean().optional(),
  tags: z.array(z.string()).optional().nullable(),
});

const bodySchema = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("run"),
      report_id: z.string().uuid(),
      parameters: z.record(z.unknown()).optional(),
      format: z.string().max(20).optional(),
      limit: z.number().int().min(1).max(5000).optional(),
    }),
    z.object({
      action: z.literal("export"),
      report_id: z.string().uuid(),
      format: z.enum(["csv", "json", "xml"]).default("csv"),
      parameters: z.record(z.unknown()).optional(),
      limit: z.number().int().min(1).max(5000).optional(),
    }),
    z.object({
      action: z.literal("save"),
      definition: definitionSchema,
    }),
    z.object({
      action: z.literal("update"),
      id: z.string().uuid(),
      definition: definitionSchema.partial(),
    }),
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
    const moduleKey = sp.get("module_key");
    const category = sp.get("category");
    const q = sp.get("q");
    const limit = Math.min(500, Number(sp.get("limit") || 200) || 200);

    let query = scoped.client
      .from("bi_report_definitions")
      .select("id, report_code, name, description, category, module_key, report_type, data_source, is_system, is_published, requires_approval, version, tags, updated_at")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null);

    if (moduleKey) query = query.eq("module_key", moduleKey);
    if (category) query = query.eq("category", category);
    if (q) query = query.or(`name.ilike.%${q}%,report_code.ilike.%${q}%,description.ilike.%${q}%`);
    query = query.order("name", { ascending: true }).limit(limit);

    const { data: reports, error } = await query;
    if (error) return apiError("INTERNAL", error.message, 500);

    const rows = (reports || []) as unknown as Array<Record<string, unknown>>;
    const byModule = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      const mk = String(r.module_key || "other");
      const cat = String(r.category || "operational");
      byModule.set(mk, (byModule.get(mk) || 0) + 1);
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }

    return apiOk({
      total: rows.length,
      reports: rows,
      facets: {
        modules: Object.fromEntries(byModule),
        categories: Object.fromEntries(byCategory),
      },
      sources: {
        registered: listSources().length,
        modules: sourceModules(),
      },
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

    // ---- RUN ----
    if (body.action === "run") {
      if (!hasPerm(ctx, "reports.view") && !hasPerm(ctx, "reports.export")) {
        return apiError("FORBIDDEN", "Missing reports.view permission", 403);
      }
      const definition = await adminGetById(scoped, "bi_report_definitions", body.report_id, {
        filterTenant: true,
      });
      if (!definition) {
        return apiError("NOT_FOUND", "Report definition not found in scope", 404);
      }
      const result = await runReport({
        admin: scoped.client,
        scope: scoped.scope,
        definition,
        parameters: body.parameters || {},
        format: body.format || "interactive",
        actorId,
        limit: body.limit,
      });
      const runId = await recordReportRun({
        admin: scoped.client,
        scope: scoped.scope,
        definition,
        result,
        format: body.format || "interactive",
        actorId,
      });
      if (result.status === "failed") {
        return apiError("INTERNAL", result.error || "Report execution failed", 500, {
          run_id: runId,
          note: result.note,
        });
      }
      return apiOk({
        run_id: runId,
        status: result.status,
        row_count: result.rowCount,
        duration_ms: result.durationMs,
        columns: result.columns,
        rows: result.rows,
        note: result.note,
      });
    }

    // ---- EXPORT ----
    if (body.action === "export") {
      if (!hasPerm(ctx, "reports.export")) {
        return apiError("FORBIDDEN", "Missing reports.export permission", 403);
      }
      const definition = await adminGetById(scoped, "bi_report_definitions", body.report_id, {
        filterTenant: true,
      });
      if (!definition) {
        return apiError("NOT_FOUND", "Report definition not found in scope", 404);
      }
      const result = await runReport({
        admin: scoped.client,
        scope: scoped.scope,
        definition,
        parameters: body.parameters || {},
        format: body.format,
        actorId,
        limit: body.limit,
      });
      const runId = await recordReportRun({
        admin: scoped.client,
        scope: scoped.scope,
        definition,
        result,
        format: body.format,
        actorId,
      });
      if (result.status === "failed") {
        return apiError("INTERNAL", result.error || "Report export failed", 500, {
          run_id: runId,
          note: result.note,
        });
      }
      const exported = buildExport({
        format: body.format,
        rows: result.rows,
        columns: result.columns,
        reportCode: String(definition.report_code || definition.name || "report"),
      });
      return apiOk({
        run_id: runId,
        status: result.status,
        row_count: result.rowCount,
        format: exported.format,
        mime_type: exported.mimeType,
        extension: exported.extension,
        content: exported.content,
        data_url: exported.dataUrl,
      });
    }

    // ---- SAVE (create) ----
    if (body.action === "save") {
      if (!hasPerm(ctx, "reports.manage")) {
        return apiError("FORBIDDEN", "Missing reports.manage permission", 403);
      }
      const d = body.definition;
      const { data: existing } = await scoped.client
        .from("bi_report_definitions")
        .select("id")
        .eq("company_id", ctx.companyId)
        .eq("report_code", d.report_code)
        .maybeSingle();
      if (existing) {
        return apiError("VALIDATION", "report_code already exists in this company", 409);
      }
      const { data: created, error } = await scoped.client
        .from("bi_report_definitions")
        .insert({
          company_id: ctx.companyId,
          tenant_id: scoped.scope.tenantId,
          report_code: d.report_code,
          name: d.name,
          description: d.description ?? null,
          category: d.category,
          module_key: d.module_key ?? null,
          report_type: d.report_type,
          data_source: d.data_source ?? null,
          query_config: d.query_config ?? {},
          layout_config: d.layout_config ?? {},
          parameters: d.parameters ?? [],
          columns_config: d.columns_config ?? [],
          is_published: d.is_published ?? true,
          requires_approval: d.requires_approval ?? false,
          owner_id: actorId,
          version: 1,
          tags: d.tags ?? [],
        })
        .select()
        .single();
      if (error || !created) {
        return apiError("INTERNAL", error?.message || "Failed to save report", 500);
      }
      return apiOk({ report: created });
    }

    // ---- UPDATE ----
    const d = body.definition;
    const patch: Record<string, unknown> = { ...d };
    delete patch.report_code; // identity is immutable per company
    patch.updated_at = new Date().toISOString();
    patch.version = undefined;

    const { data: existing } = await scoped.client
      .from("bi_report_definitions")
      .select("version")
      .eq("id", body.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (!existing) {
      return apiError("NOT_FOUND", "Report definition not found in scope", 404);
    }

    const { data: updated, error } = await scoped.client
      .from("bi_report_definitions")
      .update({
        ...patch,
        version: Number(existing.version || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("company_id", ctx.companyId)
      .select()
      .maybeSingle();
    if (error || !updated) {
      return apiError("INTERNAL", error?.message || "Failed to update report", 500);
    }
    return apiOk({ report: updated });
  }
);

function hasPerm(
  ctx: { permissions?: string[] },
  slug: string
): boolean {
  return Boolean(ctx.permissions?.includes(slug));
}