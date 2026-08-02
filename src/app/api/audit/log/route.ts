import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Define the expected shape from the client
interface AuditPayload {
  event: string;
  details?: Record<string, unknown>;
  userId?: string;
  companyId?: string;
  clientTimestamp?: string;
}

// Validate at least that required fields are present and of correct type
function isValidPayload(body: unknown): body is AuditPayload {
  if (!body || typeof body !== "object") return false;
  const p = body as Record<string, unknown>;
  return typeof p.event === "string" && p.event.length > 0;
}

export async function POST(req: NextRequest) {
  // 1. Rate limiting is handled globally by middleware, no need to repeat here.
  // 2. Authenticate the caller using Supabase session cookie.
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse and validate the body
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

  // 4. Enforce tenant isolation
  //    The audit table should have a `company_id` column.
  //    For security we NEVER trust the client‑supplied companyId.
  //    Instead we derive it from the authenticated user's profile.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Unable to resolve tenant" },
      { status: 500 }
    );
  }

  const companyId = profile.company_id;

  // 5. Insert the audit event
  const eventData = {
    event: body.event,
    details: body.details ?? null,
    user_id: body.userId ?? session.user.id,
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
