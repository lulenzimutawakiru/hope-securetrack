import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";
import { sanitizePostgrestFilter } from "@/lib/security/shared";

const postSchema = z.object({
  full_name: z.string().max(200).optional(),
  module: z.string().max(50).optional(),
  event_type: z.string().max(80).optional(),
  action: z.string().max(200).optional(),
  crud_op: z.string().max(40).optional(),
  severity: z.string().max(20).optional(),
  title: z.string().max(300).optional(),
  details: z.string().max(4000).optional(),
  before_state: z.record(z.unknown()).nullable().optional(),
  after_state: z.record(z.unknown()).nullable().optional(),
  entity_type: z.string().max(80).optional(),
  entity_id: z.string().max(80).optional(),
  entity_reference: z.string().max(200).optional(),
  correlation_id: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** REST: list / query enterprise audit events */
export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["eal.view", "audit.view", "eal.export", "eal.investigate"],
    allowPlatformAdmin: true,
    module: "audit",
  },
  async ({ req, ctx }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const sp = req.nextUrl.searchParams;
    const moduleName = sp.get("module");
    const severity = sp.get("severity");
    const rawQ = sp.get("q") || "";
    const q = sanitizePostgrestFilter(rawQ, 80);
    const limit = Math.min(Number(sp.get("limit") || 100), 500);

    const supabase = await createClient();
    let query = supabase
      .from("eal_events")
      .select(
        "id, audit_id, event_id, module, action, severity, risk_score, user_email, full_name, entity_reference, ip_address, created_at, integrity_hash, chain_index"
      )
      .eq("company_id", ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (moduleName) {
      const safeModule = sanitizePostgrestFilter(moduleName, 40);
      if (safeModule) query = query.eq("module", safeModule);
    }
    if (severity) {
      const safeSev = sanitizePostgrestFilter(severity, 20);
      if (safeSev) query = query.eq("severity", safeSev);
    }
    if (q) {
      query = query.or(
        `audit_id.ilike.%${q}%,action.ilike.%${q}%,user_email.ilike.%${q}%,entity_reference.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return apiOk({ events: [], count: 0, warning: error.message });
    }
    return apiOk({ events: data || [], count: data?.length || 0 });
  }
);

/** REST: append audit event (session company only) */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["eal.view", "audit.view", "eal.manage", "audit.manage"],
    allowPlatformAdmin: true,
    bodySchema: postSchema,
    rateLimit: { limit: 60, windowMs: 60_000 },
    module: "audit",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof postSchema>;
    const { logAuditEvent } = await import("@/lib/audit/service");

    const event = await logAuditEvent({
      company_id: ctx.companyId,
      user_id: ctx.profile.id || ctx.user.id,
      user_email: ctx.profile.email || ctx.user.email,
      full_name: data.full_name,
      module: data.module || "api",
      event_type: data.event_type || "api.event",
      action: data.action || "API audit event",
      crud_op: data.crud_op,
      severity: data.severity || "info",
      title: data.title,
      details: data.details,
      before_state: data.before_state,
      after_state: data.after_state,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      entity_reference: data.entity_reference,
      correlation_id: data.correlation_id,
      ip_address: undefined,
      metadata: { source: "rest_api", ...(data.metadata || {}) },
    });

    return NextResponse.json({ ok: true, event }, { status: 201 });
  }
);
