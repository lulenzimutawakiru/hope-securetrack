import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flushSiemOutbox } from "@/lib/audit/siem";
import { requireApiAuth } from "@/lib/security/api-auth";
import { clientIp, rateLimit } from "@/lib/api";

/** List SIEM connectors / flush outbox */
export async function GET() {
  try {
    const auth = await requireApiAuth({
      permissions: ["eal.view", "audit.view", "eal.security", "eal.export"],
      allowPlatformAdmin: true,
    });
    if ("response" in auth) return auth.response;

    const supabase = await createClient();
    const { data: connectors } = await supabase
      .from("eal_siem_connectors")
      .select("id, connector_code, name, provider, enabled, min_severity, last_push_at, last_status")
      .eq("company_id", auth.ctx.companyId)
      .order("name");

    const { count: pending } = await supabase
      .from("eal_siem_outbox")
      .select("*", { count: "exact", head: true })
      .eq("company_id", auth.ctx.companyId)
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
    const ip = clientIp(req);
    const rl = rateLimit(`siem-flush:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const auth = await requireApiAuth({
      permissions: ["eal.export", "eal.manage", "audit.manage", "eal.security"],
      allowPlatformAdmin: true,
    });
    if ("response" in auth) return auth.response;

    const body = await req.json().catch(() => ({}));
    // Session company only — ignore body.company_id
    const companyId = auth.ctx.companyId;

    if ((body as { action?: string }).action === "flush") {
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
