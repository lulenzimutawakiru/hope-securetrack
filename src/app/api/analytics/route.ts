/**
 * Enterprise Analytics / AI Analyst API.
 *
 * GET  - list AI insights (briefings, predictions, recommendations) with
 *        domain/status/severity filters
 * POST - actions:
 *    "analyze" : run the AI analyst for the company, persist new insights and
 *                return the composed daily briefing
 *    "resolve" : acknowledge / action / dismiss an insight (audit-friendly)
 *
 * All reads/writes are company-scoped from the authenticated session.
 * Client-supplied company_id / tenant_id are never accepted.
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createScopedAdminFromAuth } from "@/lib/supabase/scoped-admin";
import { analyzeCompany, composeBriefing } from "@/lib/reporting/analyst";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIEW = ["reports.ai", "reports.intelligence", "reports.view", "reports.dashboards", "reports.manage"];

const resolveSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "acknowledged", "actioned", "dismissed"]),
  note: z.string().max(2000).optional().nullable(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), horizon_days: z.number().int().min(1).max(365).optional() }),
  z.object({ action: z.literal("resolve"), insight: resolveSchema }),
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
    const domain = sp.get("domain");
    const status = sp.get("status");
    const severity = sp.get("severity");
    const insightType = sp.get("type");
    const limit = Math.min(200, Number(sp.get("limit") || 50) || 50);

    let query = scoped.client
      .from("bi_ai_insights")
      .select("id, insight_type, domain, title, summary, recommendation, confidence, severity, impact_score, horizon, status, created_at, expires_at, resolved_at")
      .eq("company_id", ctx.companyId);

    if (domain) query = query.eq("domain", domain);
    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", severity);
    if (insightType) query = query.eq("insight_type", insightType);
    query = query.order("created_at", { ascending: false }).limit(limit);

    const { data: insights, error } = await query;
    if (error) return apiError("INTERNAL", error.message, 500);

    const rows = (insights || []) as unknown as Array<Record<string, unknown>>;
    const open = rows.filter((r) => String(r.status || "open") === "open").length;

    return apiOk({
      total: rows.length,
      open,
      insights: rows,
      generated_at: new Date().toISOString(),
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
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const scoped = createScopedAdminFromAuth(ctx);
    const actorId = ctx.user.id;

    // ---- ANALYZE ----
    if (body.action === "analyze") {
      if (
        !ctx.permissions?.includes("reports.ai") &&
        !ctx.permissions?.includes("reports.intelligence") &&
        !ctx.permissions?.includes("reports.view")
      ) {
        return apiError("FORBIDDEN", "Missing reports.ai permission", 403);
      }
      const result = await analyzeCompany({
        admin: scoped.client,
        scope: scoped.scope,
        horizonDays: body.horizon_days,
      });
      const briefing = composeBriefing(result);
      return apiOk({
        briefing,
        briefings: result.briefings,
        predictions: result.predictions,
        recommendations: result.recommendations,
        totals: {
          briefings: result.briefings.length,
          predictions: result.predictions.length,
          recommendations: result.recommendations.length,
        },
        actor_id: actorId,
        analyzed_at: new Date().toISOString(),
      });
    }

    // ---- RESOLVE ----
    const canManage = Boolean(
      ctx.permissions?.includes("reports.manage") ||
      ctx.permissions?.includes("reports.ai")
    );
    if (!canManage) return apiError("FORBIDDEN", "Missing reports.ai permission", 403);

    const { data: existing } = await scoped.client
      .from("bi_ai_insights")
      .select("id, outputs")
      .eq("id", body.insight.id)
      .eq("company_id", ctx.companyId)
      .maybeSingle();
    if (!existing) return apiError("NOT_FOUND", "Insight not found in scope", 404);

    const outputs = (existing.outputs as Record<string, unknown>) || {};
    if (body.insight.note) {
      outputs.resolution_note = body.insight.note;
      outputs.resolved_by = actorId;
      outputs.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await scoped.client
      .from("bi_ai_insights")
      .update({
        status: body.insight.status,
        resolved_at: body.insight.status === "open" ? null : new Date().toISOString(),
        outputs,
      })
      .eq("id", body.insight.id)
      .eq("company_id", ctx.companyId)
      .select()
      .maybeSingle();
    if (error || !updated) return apiError("INTERNAL", error?.message || "Failed to resolve insight", 500);
    return apiOk({ insight: updated });
  }
);
