import { attAudit, attNextNumber } from "./crud";
import {
  crudCount,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

export type GeoPoint = { lat: number; lng: number; accuracy?: number };

export type AttLocation = {
  id: string;
  location_code: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  require_gps: boolean;
  require_wifi: boolean;
  require_beacon: boolean;
  require_qr: boolean;
  require_nfc: boolean;
  require_biometric: boolean;
  max_gps_accuracy_m: number;
  wifi_ssids?: string | null;
  wifi_bssids?: string | null;
  beacon_ids?: string | null;
  status: string;
  allow_field_exception?: boolean;
};

/** Haversine distance in meters */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function listActiveLocations(companyId: string) {
  void companyId;
  const data = await mustList<AttLocation>("att_locations", {
    pageSize: 200,
    sort: "name",
    order: "asc",
    filters: { status: "active" },
  });
  return data;
}

export function findMatchingLocation(
  point: GeoPoint,
  locations: AttLocation[]
): { location: AttLocation | null; distance: number; reasons: string[] } {
  const reasons: string[] = [];
  let best: AttLocation | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const loc of locations) {
    if (!loc.require_gps && loc.allow_field_exception) continue;
    const d = distanceMeters(point, { lat: Number(loc.lat), lng: Number(loc.lng) });
    if (d <= Number(loc.radius_m || 0) && d < bestDist) {
      best = loc;
      bestDist = d;
    }
  }

  if (!best) {
    reasons.push("Outside all authorized geofences");
    return { location: null, distance: bestDist === Number.POSITIVE_INFINITY ? -1 : bestDist, reasons };
  }

  const maxAcc = Number(best.max_gps_accuracy_m || 25);
  if (point.accuracy != null && point.accuracy > maxAcc) {
    reasons.push(`GPS accuracy ${point.accuracy.toFixed(1)}m exceeds ${maxAcc}m`);
  }

  return { location: best, distance: bestDist, reasons };
}

export type ClockInput = {
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber?: string;
  eventType: "clock_in" | "clock_out" | "break_start" | "break_end";
  point?: GeoPoint | null;
  wifiSsid?: string;
  wifiBssid?: string;
  beaconId?: string;
  qrToken?: string;
  nfcTag?: string;
  rfidBadge?: string;
  deviceCode?: string;
  projectCode?: string;
  workOrderRef?: string;
  isFieldWork?: boolean;
  photoUrl?: string;
  actorId?: string | null;
  /** mock location flag from client */
  mockLocation?: boolean;
};

export type ClockResult = {
  ok: boolean;
  event?: Record<string, unknown>;
  attendance?: Record<string, unknown> | null;
  message: string;
  locationName?: string;
  distanceM?: number;
  rejectReason?: string;
};

/**
 * Secure multi-layer clock validation + record write.
 */
export async function processClock(input: ClockInput): Promise<ClockResult> {
  const fraudFlags: string[] = [];
  const now = new Date();
  const workDate = now.toISOString().slice(0, 10);

  // Settings (session-scoped via CRUD)
  const settingsRows = await mustList<Record<string, unknown>>("att_settings", {
    pageSize: 100,
  });
  const settings: Record<string, unknown> = {};
  for (const r of settingsRows) {
    settings[String(r.setting_key)] = r.setting_value;
  }
  const blockMock =
    settings.block_mock_gps !== false && settings.block_mock_gps !== "false";
  const requireGeofence =
    settings.require_geofence_default !== false &&
    settings.require_geofence_default !== "false";
  const dupWindow = Number(settings.duplicate_window_minutes ?? 2);

  if (input.mockLocation && blockMock) {
    fraudFlags.push("mock_gps");
    await logViolation(input, "mock_gps", "Mock/spoofed GPS detected");
    return reject("Mock GPS / location spoofing detected", fraudFlags);
  }

  if (!input.point && requireGeofence && !input.isFieldWork) {
    return reject("GPS required — enable location services", fraudFlags);
  }

  let matchedLoc: AttLocation | null = null;
  let distance = -1;

  if (input.point) {
    const locations = await listActiveLocations(input.companyId);
    const match = findMatchingLocation(input.point, locations);
    distance = match.distance;
    matchedLoc = match.location;

    if (!matchedLoc && !input.isFieldWork && requireGeofence) {
      fraudFlags.push("outside_geofence");
      await logViolation(
        input,
        "outside_geofence",
        `Distance ${distance.toFixed(0)}m`
      );
      return reject(
        match.reasons[0] ||
          "You must be at an authorized company location to clock in",
        fraudFlags,
        { distance }
      );
    }

    if (matchedLoc && match.reasons.length) {
      return reject(match.reasons.join("; "), fraudFlags, {
        distance,
        locationName: matchedLoc.name,
      });
    }

    if (matchedLoc?.require_wifi) {
      const allowed = String(matchedLoc.wifi_ssids || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const ssid = (input.wifiSsid || "").toLowerCase();
      if (allowed.length && !allowed.includes(ssid)) {
        return reject("Not connected to approved corporate Wi-Fi", fraudFlags, {
          distance,
          locationName: matchedLoc.name,
        });
      }
    }

    if (matchedLoc?.require_beacon && !input.beaconId) {
      return reject(
        "Bluetooth beacon verification required at this site",
        fraudFlags,
        { distance, locationName: matchedLoc.name }
      );
    }

    if (matchedLoc?.require_qr) {
      if (!input.qrToken) {
        return reject("QR checkpoint scan required", fraudFlags);
      }
      const qrs = await mustList<Record<string, unknown>>("att_qr_tokens", {
        pageSize: 1,
        filters: { token_code: input.qrToken, status: "active" },
      });
      const qr = qrs[0];
      if (!qr || new Date(String(qr.valid_until)) < now) {
        fraudFlags.push("fake_qr");
        return reject("QR token invalid or expired", fraudFlags);
      }
      await mustUpdate("att_qr_tokens", String(qr.id), {
        use_count: Number(qr.use_count || 0) + 1,
      });
    }

    if (matchedLoc?.require_nfc && !input.nfcTag) {
      return reject("NFC checkpoint required", fraudFlags);
    }
  }

  // Field work authorization
  if (input.isFieldWork || (!matchedLoc && input.projectCode)) {
    let fields = await mustList<Record<string, unknown>>(
      "att_field_assignments",
      {
        pageSize: 5,
        filters: { status: "active", employee_id: input.employeeId },
      }
    );
    if (!fields.length) {
      // Fallback: list active and match by name client-side
      const allActive = await mustList<Record<string, unknown>>(
        "att_field_assignments",
        { pageSize: 50, filters: { status: "active" } }
      );
      const name = input.employeeName.toLowerCase();
      fields = allActive.filter((f) =>
        String(f.employee_name || "")
          .toLowerCase()
          .includes(name)
      );
    }
    if (!fields.length && !matchedLoc) {
      return reject(
        "No authorized field assignment for off-site clock-in",
        fraudFlags
      );
    }
  }

  // Duplicate check (range filter on event_at)
  const since = new Date(now.getTime() - dupWindow * 60 * 1000).toISOString();
  const recent = await mustList<Record<string, unknown>>("att_events", {
    pageSize: 1,
    filters: {
      employee_id: input.employeeId,
      event_type: input.eventType,
      event_at: { gte: since },
    },
  });
  if (recent.length > 0) {
    fraudFlags.push("duplicate");
    return reject(
      `Duplicate ${input.eventType} within ${dupWindow} minutes`,
      fraudFlags
    );
  }

  const eventCode = await attNextNumber(
    "att_events",
    input.companyId,
    "EVT",
    "event_code"
  );
  const method = input.deviceCode
    ? "terminal"
    : input.qrToken
      ? "qr"
      : input.nfcTag
        ? "nfc"
        : input.beaconId
          ? "beacon"
          : input.point
            ? "gps"
            : "app";

  const event = await mustCreate<Record<string, unknown>>("att_events", {
    event_code: eventCode,
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    employee_number: input.employeeNumber || null,
    event_type: input.eventType,
    event_at: now.toISOString(),
    work_date: workDate,
    location_id: matchedLoc?.id || null,
    location_name: matchedLoc?.name || (input.isFieldWork ? "Field" : null),
    method,
    lat: input.point?.lat ?? null,
    lng: input.point?.lng ?? null,
    gps_accuracy_m: input.point?.accuracy ?? null,
    distance_m: distance >= 0 ? Math.round(distance) : null,
    wifi_ssid: input.wifiSsid || null,
    wifi_bssid: input.wifiBssid || null,
    beacon_id: input.beaconId || null,
    qr_token: input.qrToken || null,
    nfc_tag: input.nfcTag || null,
    rfid_badge: input.rfidBadge || null,
    device_code: input.deviceCode || null,
    verification_status: "approved",
    fraud_flags: fraudFlags,
    project_code: input.projectCode || null,
    work_order_ref: input.workOrderRef || null,
    is_field_work: !!input.isFieldWork,
    photo_url: input.photoUrl || null,
    status: "recorded",
  });

  // Upsert daily attendance_records
  let attendance: Record<string, unknown> | null = null;
  const existingRows = await mustList<Record<string, unknown>>(
    "attendance_records",
    {
      pageSize: 1,
      filters: {
        employee_id: input.employeeId,
        work_date: workDate,
      },
    }
  );
  const existing = existingRows[0] || null;

  if (input.eventType === "clock_in") {
    if (existing?.check_in && !existing?.check_out) {
      attendance = existing;
    } else if (existing?.id) {
      attendance = await mustUpdate("attendance_records", String(existing.id), {
        check_in: now.toISOString(),
        check_out: null,
        status: "present",
        method: event.method,
        check_in_lat: input.point?.lat ?? null,
        check_in_lng: input.point?.lng ?? null,
        location_id: matchedLoc?.id || null,
        location_name: matchedLoc?.name || null,
        gps_accuracy_m: input.point?.accuracy ?? null,
        verification_method: event.method,
        is_field_work: !!input.isFieldWork,
        project_code: input.projectCode || null,
      });
    } else {
      attendance = await mustCreate("attendance_records", {
        employee_id: input.employeeId,
        work_date: workDate,
        check_in: now.toISOString(),
        status: "present",
        method: event.method,
        check_in_lat: input.point?.lat ?? null,
        check_in_lng: input.point?.lng ?? null,
        location_id: matchedLoc?.id || null,
        location_name: matchedLoc?.name || null,
        gps_accuracy_m: input.point?.accuracy ?? null,
        verification_method: event.method,
        is_field_work: !!input.isFieldWork,
        project_code: input.projectCode || null,
      });
    }
  } else if (input.eventType === "clock_out") {
    if (!existing?.check_in) {
      return reject("No active clock-in found for today", fraudFlags);
    }
    const checkIn = new Date(String(existing.check_in));
    const hours = Math.max(0, (now.getTime() - checkIn.getTime()) / 3600000);
    const overtime = Math.max(0, hours - 8);
    attendance = await mustUpdate(
      "attendance_records",
      String(existing.id),
      {
        check_out: now.toISOString(),
        check_out_lat: input.point?.lat ?? null,
        check_out_lng: input.point?.lng ?? null,
        hours_worked: Math.round(hours * 100) / 100,
        overtime_minutes: Math.round(overtime * 60),
        productive_minutes: Math.round(hours * 60),
        status: "completed",
      }
    );
  }

  if (attendance?.id && event.id) {
    await mustUpdate("att_events", String(event.id), {
      attendance_record_id: attendance.id,
    });
  }

  await attAudit({
    company_id: input.companyId,
    actor_id: input.actorId,
    action: input.eventType,
    entity_table: "att_events",
    entity_id: event.id,
    entity_code: eventCode,
    details: `${input.employeeName} @ ${matchedLoc?.name || "field"}`,
  });

  try {
    await mustCreate("att_notifications", {
      title: `${input.eventType.replace("_", " ")} recorded`,
      body: `${input.employeeName} at ${matchedLoc?.name || "field site"}`,
      severity: "info",
      category: "clock",
      employee_name: input.employeeName,
    });
  } catch {
    /* non-blocking */
  }

  return {
    ok: true,
    event,
    attendance,
    message: `${input.eventType === "clock_in" ? "Clock-in" : "Clock-out"} approved`,
    locationName: matchedLoc?.name,
    distanceM: distance >= 0 ? Math.round(distance) : undefined,
  };
}

function reject(
  message: string,
  fraudFlags: string[],
  extra?: { distance?: number; locationName?: string }
): ClockResult {
  return {
    ok: false,
    message,
    rejectReason: message,
    distanceM: extra?.distance != null && extra.distance >= 0 ? Math.round(extra.distance) : undefined,
    locationName: extra?.locationName,
  };
}

async function logViolation(
  input: ClockInput,
  type: string,
  details: string
) {
  try {
    const code = await attNextNumber(
      "att_violations",
      input.companyId,
      "VIO",
      "violation_code"
    );
    await mustCreate("att_violations", {
      violation_code: code,
      employee_name: input.employeeName,
      violation_type: type,
      details,
      severity: type === "mock_gps" ? "critical" : "high",
      status: "open",
    });
  } catch {
    /* non-blocking */
  }
}

export async function getAttendanceDashboard(companyId: string) {
  void companyId; // company scope is session-derived on the CRUD path
  const today = new Date().toISOString().slice(0, 10);
  const [
    presentNow,
    eventsToday,
    devicesOnline,
    devicesOffline,
    pendingCorrections,
    openViolations,
    activeLocations,
  ] = await Promise.all([
    // Present: checked in today — approximate with work_date filter
    // (check_out IS NULL not expressible; use work_date count as proxy + open events)
    crudCount("attendance_records", { work_date: today }),
    crudCount("att_events", { work_date: today }),
    crudCount("att_devices", { status: "online" }),
    crudCount("att_devices", { status: "offline" }),
    crudCount("att_corrections", { status: "pending" }),
    crudCount("att_violations", { status: "open" }),
    crudCount("att_locations", { status: "active" }),
  ]);

  return {
    presentNow,
    eventsToday,
    devicesOnline,
    devicesOffline,
    pendingCorrections,
    openViolations,
    activeLocations,
  };
}
