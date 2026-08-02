import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface AuditPayload {
  event: string;
  details?: Record<string, unknown>;
  userId?: string;
  companyId?: string;
  clientTimestamp?: string;
}

function isValidPayload(body: unknown): body is AuditPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  return typeof p.event === "string" && p.event.length > 0;
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json(
      { error: "Payload must contain a non‑empty 'event' string" },
      { status: 400 }
    );
  }

  // Enforce tenant isolation – read tenant_id from the authenticated profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id, company_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Unable to resolve tenant" },
      { status: 500 }
    );
  }

  const tenantId = profile.tenant_id;
  const companyId = profile.company_id;

  const eventData = {
    event: body.event,
    details: body.details ?? null,
    user_id: body.userId ?? session.user.id,
    tenant_id: tenantId,
    company_id: companyId,
    timestamp: body.clientTimestamp ?? new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from("audit_log")
    .insert(eventData);

  if (insertError) {
    console.error("Failed to record audit event:", insertError);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok" });
}
