/**
 * API-first Service Desk tickets.
 *
 *   POST /api/v2/servicedesk/tickets  -- create ticket (session tenant)
 *   GET  /api/v2/servicedesk/tickets  -- list company tickets
 */

import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { apiError, apiOk } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createTicketServer } from "@/lib/service-desk/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().max(100_000).optional().nullable(),
  category: z.string().max(120).optional(),
  subcategory: z.string().max(120).optional().nullable(),
  ticket_type: z.string().max(40).optional(),
  service_type: z.string().max(80).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  impact: z.string().max(40).optional(),
  urgency: z.string().max(40).optional(),
  channel: z.string().max(40).optional(),
  requester_name: z.string().max(150).optional().nullable(),
  requester_email: z.string().max(255).optional().nullable(),
  requester_phone: z.string().max(60).optional().nullable(),
  team_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  catalog_item_id: z.string().uuid().optional().nullable(),
  is_major: z.boolean().optional(),
  auto_route: z.boolean().optional(),
});

export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["sd.agent", "sd.manage", "sd.portal", "sd.admin"],
    allowPlatformAdmin: true,
    rateLimit: { limit: 30, windowMs: 60_000 },
    idempotent: true,
    module: "servicedesk",
    bodySchema: createSchema,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    try {
      const canAssign = ["sd.agent", "sd.manage", "sd.admin"].some((p) =>
        ctx.permissions.includes(p)
      );
      const ticket = await createTicketServer(supabase, {
        company_id: ctx.companyId,
        tenant_id: ctx.tenantId,
        created_by: ctx.user.id,
        actor_name: ctx.user.email || null,
        auto_route: body.auto_route !== false,
        ticket: {
          subject: body.subject,
          description: body.description || undefined,
          category: body.category,
          subcategory: body.subcategory || undefined,
          ticket_type: body.ticket_type,
          service_type: body.service_type,
          priority: body.priority,
          impact: body.impact,
          urgency: body.urgency,
          channel: body.channel || "api",
          requester_name: body.requester_name || undefined,
          requester_email: body.requester_email || undefined,
          requester_phone: body.requester_phone || undefined,
          team_id: canAssign ? body.team_id || undefined : undefined,
          assigned_to: canAssign ? body.assigned_to || undefined : undefined,
          catalog_item_id: body.catalog_item_id || undefined,
          is_major: canAssign ? body.is_major : false,
        },
      });
      return apiOk({ ticket }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Ticket create failed",
        500
      );
    }
  }
);

export const GET = createApiHandler(
  {
    auth: true,
    permissions: ["sd.view", "sd.agent", "sd.manage", "sd.portal"],
    allowPlatformAdmin: true,
    module: "servicedesk",
  },
  async ({ ctx, req }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const supabase = await createClient();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.trunc(limitRaw)), 200)
      : 50;
    const mine = url.searchParams.get("mine") === "1";

    let query = supabase
      .from("support_tickets")
      .select("*")
      .eq("company_id", ctx.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (mine) {
      query = query.or(
        `created_by.eq.${ctx.user.id},assigned_to.eq.${ctx.user.id}`
      );
    }

    const { data, error } = await query;
    if (error) {
      return apiError("INTERNAL", error.message, 500);
    }
    return apiOk({ tickets: data || [] });
  }
);
