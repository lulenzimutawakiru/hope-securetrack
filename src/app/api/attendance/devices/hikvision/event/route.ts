import { NextRequest, NextResponse } from "next/server";
import {
  ingestHikvisionPayload,
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
 * Hikvision ISAPI event notification endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("device-hikvision", 180, 60_000, req);
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

    const integ = await resolveCompanyByToken("hikvision", token);
    if (!integ?.company_id) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const deviceCode = req.nextUrl.searchParams.get("device_code") || undefined;
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};

    if (contentType.includes("application/json") || contentType.includes("text/json")) {
      body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const emp = text.match(/<employeeNoString>([^<]+)<\/employeeNoString>/i)?.[1];
        const time = text.match(/<time>([^<]+)<\/time>/i)?.[1];
        const card = text.match(/<cardNo>([^<]+)<\/cardNo>/i)?.[1];
        body = {
          AccessControllerEvent: {
            employeeNoString: emp,
            time,
            cardNo: card,
            attendanceStatus: "checkIn",
            currentVerifyMode: "face",
          },
        };
      }
    }

    const result = await ingestHikvisionPayload(
      String(integ.company_id),
      body,
      deviceCode
    );

    return NextResponse.json({ ok: true, vendor: "hikvision", result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: "hikvision-event",
    status: "ready",
    usage: "POST AccessControllerEvent JSON with X-Device-Token or ?token=PUSH_TOKEN",
  });
}
