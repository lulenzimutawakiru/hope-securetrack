import { NextRequest, NextResponse } from "next/server";
import {
  ingestZktecoJson,
  resolveCompanyByToken,
} from "@/lib/attendance/integrations";
import {
  extractDeviceToken,
  ingressRateLimit,
  isPlausibleSecretToken,
} from "@/lib/security/public-ingress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ZKTeco / BioTime JSON push endpoint
 * Auth: ?token= or header X-Device-Token / Authorization: Bearer
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("device-zkteco-push", 180, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded" },
        { status: 429, headers: rl.response.headers }
      );
    }

    const token = extractDeviceToken(req);
    if (!isPlausibleSecretToken(token)) {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 401 });
    }

    const integ = await resolveCompanyByToken("zkteco", token);
    if (!integ?.company_id) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const deviceCode = req.nextUrl.searchParams.get("device_code") || undefined;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await ingestZktecoJson(String(integ.company_id), body, deviceCode);

    return NextResponse.json({ ok: true, vendor: "zkteco", result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "zkteco-push",
    status: "ready",
    usage: "POST JSON punches with X-Device-Token or ?token=PUSH_TOKEN",
  });
}
