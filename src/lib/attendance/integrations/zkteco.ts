/**
 * ZKTeco attendance integration
 * Supports:
 *  - JSON push: POST /api/attendance/devices/zkteco/push
 *  - ADMS/ICLOCK-style text: POST /api/attendance/devices/zkteco/iclock?table=ATTLOG
 *
 * Common models: SpeedFace, uFace, K40, MB series, BioTime cloud push.
 */

import { ingestDevicePunch } from "./ingest";
import type { DevicePunchInput, IngestResult } from "./types";

/** Parse BioTime / ADMS ATTLOG line: pin\ttime\tstatus\tverify\tworkcode... */
export function parseAttLogLine(line: string): {
  deviceUserId: string;
  punchTime: string;
  status: number;
  verify: number;
} | null {
  const parts = line.trim().split(/\t|,|\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const deviceUserId = parts[0];
  const timeRaw = parts[1].includes("T") ? parts[1] : parts[1].replace(" ", "T");
  const punchTime = new Date(timeRaw);
  if (Number.isNaN(punchTime.getTime())) return null;
  const status = Number(parts[2] ?? 0);
  const verify = Number(parts[3] ?? 1);
  return {
    deviceUserId,
    punchTime: punchTime.toISOString(),
    status,
    verify,
  };
}

function mapZkStatus(status: number): DevicePunchInput["punchType"] {
  // 0 check-in, 1 check-out, 2 break-out, 3 break-in, 4 overtime-in, 5 overtime-out
  if (status === 0 || status === 4) return "clock_in";
  if (status === 1 || status === 5) return "clock_out";
  if (status === 2) return "break_start";
  if (status === 3) return "break_end";
  return "auto";
}

function mapZkVerify(verify: number): string {
  const map: Record<number, string> = {
    0: "password",
    1: "fingerprint",
    2: "card",
    3: "password",
    4: "card",
    15: "face",
    16: "face",
  };
  return map[verify] || "fingerprint";
}

export async function ingestZktecoJson(
  companyId: string,
  body: Record<string, unknown>,
  deviceCode?: string
): Promise<IngestResult | IngestResult[]> {
  // Single punch
  if (body.pin || body.user_id || body.device_user_id || body.emp_code) {
    const userId = String(
      body.pin || body.user_id || body.device_user_id || body.emp_code || ""
    );
    const time = String(
      body.punch_time || body.timestamp || body.time || body.record_time || new Date().toISOString()
    );
    const status = Number(body.status ?? body.punch_state ?? body.state ?? 255);
    return ingestDevicePunch({
      companyId,
      vendor: "zkteco",
      deviceCode: deviceCode || String(body.device_code || body.sn || body.serial_number || "") || undefined,
      deviceSerial: body.sn ? String(body.sn) : undefined,
      deviceUserId: userId,
      punchTime: new Date(time).toISOString(),
      punchType: status === 255 ? "auto" : mapZkStatus(status),
      verifyMode: mapZkVerify(Number(body.verify || body.verify_type || 1)),
      externalId: body.id ? `zk-${body.id}` : body.uuid ? `zk-${body.uuid}` : undefined,
      cardNumber: body.card_no ? String(body.card_no) : undefined,
      raw: body,
    });
  }

  // Batch
  const list = (body.records || body.data || body.attlog || body.punches) as
    | Array<Record<string, unknown>>
    | string
    | undefined;

  if (typeof list === "string") {
    return ingestZktecoAttLog(companyId, list, deviceCode || String(body.sn || ""));
  }

  if (Array.isArray(list)) {
    const results: IngestResult[] = [];
    for (const row of list) {
      const r = await ingestZktecoJson(companyId, row, deviceCode || String(body.sn || body.device_code || ""));
      results.push(...(Array.isArray(r) ? r : [r]));
    }
    return results;
  }

  return { ok: false, processStatus: "failed", message: "Unrecognized ZKTeco payload" };
}

export async function ingestZktecoAttLog(
  companyId: string,
  bodyText: string,
  deviceSerial?: string
): Promise<IngestResult[]> {
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("OPLOG") && !l.startsWith("USER"));

  const results: IngestResult[] = [];
  for (const line of lines) {
    const parsed = parseAttLogLine(line);
    if (!parsed) continue;
    const r = await ingestDevicePunch({
      companyId,
      vendor: "zkteco",
      deviceSerial,
      deviceUserId: parsed.deviceUserId,
      punchTime: parsed.punchTime,
      punchType: mapZkStatus(parsed.status),
      verifyMode: mapZkVerify(parsed.verify),
      externalId: `zk-attlog-${deviceSerial || "dev"}-${parsed.deviceUserId}-${parsed.punchTime}`,
      raw: { line, protocol: "iclock" },
    });
    results.push(r);
  }
  return results;
}
