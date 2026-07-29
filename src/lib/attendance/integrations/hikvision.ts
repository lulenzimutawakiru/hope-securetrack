/**
 * Hikvision attendance / access control integration
 * Supports ISAPI event notification payloads (AccessControllerEvent)
 * and simplified JSON push.
 *
 * Typical devices: DS-K1T671, MinMoe face terminals, access controllers.
 */

import { ingestDevicePunch } from "./ingest";
import type { DevicePunchInput, IngestResult } from "./types";

function mapHikVerify(mode?: string | number): string {
  const m = String(mode || "").toLowerCase();
  if (m.includes("face") || m === "face" || m === "15") return "face";
  if (m.includes("card") || m === "card" || m === "1") return "card";
  if (m.includes("finger") || m === "fingerprint") return "fingerprint";
  if (m.includes("qr")) return "qr";
  return "face";
}

function mapHikAttendanceStatus(status?: string | number): DevicePunchInput["punchType"] {
  const s = String(status ?? "").toLowerCase();
  // Hikvision attendanceStatus: checkIn, checkOut, breakOut, breakIn, overtimeIn, overtimeOut
  if (s === "checkin" || s === "check_in" || s === "0" || s === "overtimein") return "clock_in";
  if (s === "checkout" || s === "check_out" || s === "1" || s === "overtimeout") return "clock_out";
  if (s === "breakout" || s === "break_out") return "break_start";
  if (s === "breakin" || s === "break_in") return "break_end";
  return "auto";
}

/** Extract AccessControllerEvent from ISAPI JSON/XML-ish object */
export function extractHikEvent(body: Record<string, unknown>): Record<string, unknown> | null {
  if (body.AccessControllerEvent) {
    return body.AccessControllerEvent as Record<string, unknown>;
  }
  if (body.EventNotificationAlert) {
    const n = body.EventNotificationAlert as Record<string, unknown>;
    if (n.AccessControllerEvent) return n.AccessControllerEvent as Record<string, unknown>;
    return n;
  }
  // flat simplified
  if (body.employeeNoString || body.employeeNo || body.cardNo || body.user_id) {
    return body;
  }
  return null;
}

export async function ingestHikvisionPayload(
  companyId: string,
  body: Record<string, unknown>,
  deviceCode?: string
): Promise<IngestResult | IngestResult[]> {
  // Batch of events
  if (Array.isArray(body.events)) {
    const out: IngestResult[] = [];
    for (const ev of body.events as Array<Record<string, unknown>>) {
      const r = await ingestHikvisionPayload(companyId, ev, deviceCode);
      out.push(...(Array.isArray(r) ? r : [r]));
    }
    return out;
  }

  const ev = extractHikEvent(body);
  if (!ev) {
    return { ok: false, processStatus: "failed", message: "Unrecognized Hikvision payload" };
  }

  const deviceUserId = String(
    ev.employeeNoString ||
      ev.employeeNo ||
      ev.employeeNoString ||
      ev.user_id ||
      ev.userId ||
      ev.cardNo ||
      ""
  );
  if (!deviceUserId) {
    return { ok: false, processStatus: "failed", message: "Missing employee/card number" };
  }

  const timeRaw = String(
    ev.time ||
      ev.dateTime ||
      body.dateTime ||
      body.time ||
      new Date().toISOString()
  );
  const punchTime = new Date(timeRaw);
  if (Number.isNaN(punchTime.getTime())) {
    return { ok: false, processStatus: "failed", message: "Invalid event time" };
  }

  const serial = String(
    body.deviceID || body.macAddress || ev.deviceID || ev.serialNo || ""
  );
  const ext =
    ev.serialNo || body.serialNo || ev.eventId || body.eventId
      ? `hik-${ev.serialNo || body.serialNo || ev.eventId || body.eventId}`
      : `hik-${deviceUserId}-${punchTime.toISOString()}`;

  return ingestDevicePunch({
    companyId,
    vendor: "hikvision",
    deviceCode: deviceCode || (body.device_code ? String(body.device_code) : undefined),
    deviceSerial: serial || undefined,
    deviceUserId,
    punchTime: punchTime.toISOString(),
    punchType: mapHikAttendanceStatus(
      (ev.attendanceStatus as string | number | undefined) ??
        (ev.majorEventType as string | number | undefined)
    ),
    verifyMode: mapHikVerify(
      String(ev.currentVerifyMode || ev.verifyMode || ev.credentialType || "face")
    ),
    externalId: String(ext),
    cardNumber: ev.cardNo ? String(ev.cardNo) : undefined,
    raw: { body, event: ev },
  });
}
