import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** REST: list / query enterprise audit events */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = req.nextUrl.searchParams;
    const module = sp.get("module");
    const severity = sp.get("severity");
    const q = sp.get("q");
    const limit = Math.min(Number(sp.get("limit") || 100), 500);

    let query = supabase
      .from("eal_events")
      .select(
        "id, audit_id, event_id, module, action, severity, risk_score, user_email, full_name, entity_reference, ip_address, created_at, integrity_hash, chain_index"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (module) query = query.eq("module", module);
    if (severity) query = query.eq("severity", severity);
    if (q) {
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

/** REST: append audit event (service clients) */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { logAuditEvent } = await import("@/lib/audit/service");

    // Resolve company from profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, company_id, email, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();

    const company_id = body.company_id || profile?.company_id;
    if (!company_id) {
      return NextResponse.json({ error: "company_id required" }, { status: 400 });
    }

    const event = await logAuditEvent({
      company_id,
      user_id: profile?.id || user.id,
      user_email: body.user_email || profile?.email,
      full_name:
        body.full_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
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
      ip_address: body.ip_address,
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
