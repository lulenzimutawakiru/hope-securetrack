import { NextRequest, NextResponse } from "next/server";
import {
  ingestZktecoAttLog,
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
 * Simplified ZKTeco ADMS/ICLOCK ATTLOG receiver.
 * Prefer header X-Device-Token; ?token= still accepted for legacy devices.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("device-zkteco-iclock", 180, 60_000, req);
    if (!rl.ok) {
      return new NextResponse("ERROR: rate limit", {
        status: 429,
        headers: {
          "Content-Type": "text/plain",
          "Retry-After": rl.response.headers.get("Retry-After") || "60",
        },
      });
    }

    const token = extractDeviceToken(req);
    if (!isPlausibleSecretToken(token)) {
      return new NextResponse("ERROR: missing token", { status: 401 });
    }

    const integ = await resolveCompanyByToken("zkteco", token);
    if (!integ?.company_id) {
      return new NextResponse("ERROR: invalid token", { status: 401 });
    }

    const sn =
      req.nextUrl.searchParams.get("SN") ||
      req.nextUrl.searchParams.get("sn") ||
      undefined;
    const table = (req.nextUrl.searchParams.get("table") || "ATTLOG").toUpperCase();
    const text = await req.text();

    // Cap payload size to limit abuse (devices send small ATTLOG batches)
    if (text.length > 512_000) {
      return new NextResponse("ERROR: payload too large", { status: 413 });
    }

    if (table === "ATTLOG" || table === "ATTENDANCELOG" || !table) {
      const results = await ingestZktecoAttLog(
        String(integ.company_id),
        text,
        sn || undefined
      );
      const ok = results.filter((r) => r.ok).length;
      return new NextResponse(`OK: ${ok}`, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new NextResponse("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (e) {
    return new NextResponse(
      `ERROR: ${e instanceof Error ? e.message : "failed"}`,
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}

export async function GET(req: NextRequest) {
  const rl = await ingressRateLimit("device-zkteco-iclock-get", 60, 60_000, req);
  if (!rl.ok) {
    return new NextResponse("ERROR: rate limit", {
      status: 429,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const token = extractDeviceToken(req);
  if (!isPlausibleSecretToken(token)) {
    return new NextResponse("ERROR: missing token", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const integ = await resolveCompanyByToken("zkteco", token);
  if (!integ?.company_id) {
    return new NextResponse("ERROR: invalid token", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const sn = req.nextUrl.searchParams.get("SN") || "";
  return new NextResponse(
    [
      "GET OPTION FROM: " + sn,
      "Stamp=9999",
      "OpStamp=9999",
      "ErrorDelay=60",
      "Delay=30",
      "TransTimes=00:00;14:00",
      "TransInterval=1",
      "TransFlag=1111000000",
      "Realtime=1",
      "Encrypt=1",
    ].join("\n"),
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
