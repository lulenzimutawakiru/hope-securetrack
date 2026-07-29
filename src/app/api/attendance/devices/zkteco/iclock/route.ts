import { NextRequest, NextResponse } from "next/server";
import {
  ingestZktecoAttLog,
  resolveCompanyByToken,
} from "@/lib/attendance/integrations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Simplified ZKTeco ADMS/ICLOCK ATTLOG receiver
 * Device config example:
 *   Server: https://your-app/api/attendance/devices/zkteco/iclock
 *   Key/token as query ?token=
 *   SN as ?SN=
 */
export async function POST(req: NextRequest) {
  try {
    const token =
      req.nextUrl.searchParams.get("token") ||
      req.nextUrl.searchParams.get("key") ||
      req.headers.get("x-device-token") ||
      "";

    if (!token) {
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

    if (table === "ATTLOG" || table === "ATTENDANCELOG" || !table) {
      const results = await ingestZktecoAttLog(String(integ.company_id), text, sn || undefined);
      const ok = results.filter((r) => r.ok).length;
      // ADMS devices often expect plain OK
      return new NextResponse(`OK: ${ok}`, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Heartbeat / options
    return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (e) {
    return new NextResponse(
      `ERROR: ${e instanceof Error ? e.message : "failed"}`,
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}

export async function GET(req: NextRequest) {
  // Device registration / options probe
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
      "Encrypt=0",
    ].join("\n"),
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
