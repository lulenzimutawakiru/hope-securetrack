import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCompanyByToken } from "@/lib/attendance/integrations";
import {
  extractDeviceToken,
  ingressRateLimit,
  isPlausibleSecretToken,
} from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";

/** Device heartbeat: ?token=&vendor=zkteco|hikvision&device_code= */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("device-heartbeat", 120, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded" },
        { status: 429, headers: rl.response.headers }
      );
    }

    const token = extractDeviceToken(req);
    const vendor = (req.nextUrl.searchParams.get("vendor") || "zkteco").toLowerCase();
    if (!isPlausibleSecretToken(token)) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }
    const integ = await resolveCompanyByToken(vendor, token);
    if (!integ?.company_id) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceCode =
      req.nextUrl.searchParams.get("device_code") ||
      String(body.device_code || body.sn || "");

    const sb = createAdminClient();
    if (deviceCode) {
      await sb
        .from("att_devices")
        .update({
          status: "online",
          last_heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("company_id", integ.company_id)
        .eq("device_code", deviceCode);

      await sb.from("att_device_sync_logs").insert({
        company_id: integ.company_id,
        device_code: deviceCode,
        sync_type: "heartbeat",
        direction: "push",
        records_count: 0,
        status: "success",
        message: "Heartbeat OK",
      });
    }

    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
