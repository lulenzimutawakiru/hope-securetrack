import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flushSiemOutbox } from "@/lib/audit/siem";

/** List SIEM connectors / flush outbox */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: connectors } = await supabase
      .from("eal_siem_connectors")
      .select("id, connector_code, name, provider, enabled, min_severity, last_push_at, last_status")
      .order("name");

    const { count: pending } = await supabase
      .from("eal_siem_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    return NextResponse.json({
      connectors: connectors || [],
      pending_outbox: pending ?? 0,
      providers: ["splunk", "sentinel", "qradar", "elastic", "webhook"],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    const companyId = body.company_id || profile?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "company_id required" }, { status: 400 });
    }

    if (body.action === "flush") {
      const result = await flushSiemOutbox(companyId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
