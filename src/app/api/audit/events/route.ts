import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/security/api-auth";
import { sanitizePostgrestFilter } from "@/lib/security/shared";
import { clientIp, rateLimit } from "@/lib/api";

/** REST: list / query enterprise audit events */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiAuth({
      permissions: ["eal.view", "audit.view", "eal.export", "eal.investigate"],
      allowPlatformAdmin: true,
    });
    if ("response" in auth) return auth.response;

    const sp = req.nextUrl.searchParams;
    const module = sp.get("module");
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
      .eq("company_id", auth.ctx.companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (module) {
      const safeModule = sanitizePostgrestFilter(module, 40);
      if (safeModule) query = query.eq("module", safeModule);
    }
    if (severity) {
      const safeSev = sanitizePostgrestFilter(severity, 20);
      if (safeSev) query = query.eq("severity", safeSev);
    }
    if (q) {
      // Use separate ilike filters chained with or — values already sanitized
      query = query.or(
        `audit_id.ilike.%${q}%,action.ilike.%${q}%,user_email.ilike.%${q}%,entity_reference.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, events: [] }, { status: 200 });
    }
    return NextResponse.json({ events: data || [], count: data?.length || 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

/** REST: append audit event */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`audit-post:${ip}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const auth = await requireApiAuth({
      permissions: ["eal.view", "audit.view", "eal.manage", "audit.manage"],
      allowPlatformAdmin: true,
    });
    if ("response" in auth) return auth.response;
    const { ctx } = auth;

    const body = await req.json();
    const { logAuditEvent } = await import("@/lib/audit/service");

    // Never trust body.company_id — session company only
    const company_id = ctx.companyId;

    const event = await logAuditEvent({
      company_id,
      user_id: ctx.profile.id || ctx.user.id,
      user_email: ctx.profile.email || ctx.user.email,
      full_name: body.full_name,
      module: body.module || "api",
      event_type: body.event_type || "api.event",
      action: body.action || "API audit event",
      crud_op: body.crud_op,
      severity: body.severity || "info",
      title: body.title,
      details: body.details,
      before_state: body.before_state,
      after_state: body.after_state,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      entity_reference: body.entity_reference,
      correlation_id: body.correlation_id,
      // Do not accept spoofed IP from client for integrity — use edge later
      ip_address: body.ip_address ? undefined : undefined,
      metadata: { source: "rest_api", ...((body.metadata as object) || {}) },
    });

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
