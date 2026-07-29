import { NextRequest, NextResponse } from "next/server";
import {
  ingestZktecoJson,
  resolveCompanyByToken,
} from "@/lib/attendance/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ZKTeco / BioTime JSON push endpoint
 * Auth: ?token= or header X-Device-Token / Authorization: Bearer
 * Optional: ?device_code=
 */
export async function POST(req: NextRequest) {
  try {
    const token =
      req.nextUrl.searchParams.get("token") ||
      req.headers.get("x-device-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (!token) {
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
    usage: "POST JSON punches with ?token=PUSH_TOKEN",
  });
}
