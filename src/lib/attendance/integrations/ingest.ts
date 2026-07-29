import { createAdminClient } from "@/lib/supabase/admin";
import type { DevicePunchInput, IngestResult } from "./types";

function admin() {
  return createAdminClient();
}

async function nextCode(table: string, companyId: string, prefix: string, field: string) {
  const year = new Date().getFullYear();
  const { count } = await admin()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function resolveEmployee(
  companyId: string,
  vendor: string,
  deviceUserId: string,
  cardNumber?: string
) {
  const sb = admin();

  // 1) Explicit device user mapping
  let q = sb
    .from("att_device_users")
    .select("employee_id, employee_number, employee_name, device_user_id")
    .eq("company_id", companyId)
    .eq("vendor", vendor)
    .eq("device_user_id", deviceUserId)
    .is("deleted_at", null)
    .maybeSingle();
  let { data: map } = await q;

  if (!map && cardNumber) {
    const { data: byCard } = await sb
      .from("att_device_users")
      .select("employee_id, employee_number, employee_name, device_user_id")
      .eq("company_id", companyId)
      .eq("vendor", vendor)
      .eq("card_number", cardNumber)
      .is("deleted_at", null)
      .maybeSingle();
    map = byCard;
  }

  if (map?.employee_id) {
    return {
      employeeId: map.employee_id as string,
      employeeNumber: (map.employee_number as string) || deviceUserId,
      employeeName: (map.employee_name as string) || "Unknown",
    };
  }

  // 2) Match employees.employee_number / national_id / payroll_number
  let empQuery = sb
    .from("employees")
    .select("id, first_name, last_name, preferred_name, employee_number, national_id, payroll_number")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  const { data: byNumber } = await empQuery
    .eq("employee_number", deviceUserId)
    .limit(1)
    .maybeSingle();

  let emp = byNumber;
  if (!emp) {
    const { data: byPayroll } = await sb
      .from("employees")
      .select("id, first_name, last_name, preferred_name, employee_number, national_id, payroll_number")
      .eq("company_id", companyId)
      .eq("payroll_number", deviceUserId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    emp = byPayroll;
  }
  if (!emp && cardNumber) {
    const { data: byNat } = await sb
      .from("employees")
      .select("id, first_name, last_name, preferred_name, employee_number, national_id, payroll_number")
      .eq("company_id", companyId)
      .eq("national_id", cardNumber)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    emp = byNat;
  }

  if (emp) {
    const name =
      emp.preferred_name ||
      [emp.first_name, emp.last_name].filter(Boolean).join(" ") ||
      "Employee";
    return {
      employeeId: emp.id as string,
      employeeNumber: String(emp.employee_number || deviceUserId),
      employeeName: name,
    };
  }

  return {
    employeeId: null as string | null,
    employeeNumber: deviceUserId,
    employeeName: `Device user ${deviceUserId}`,
  };
}

async function resolveDevice(companyId: string, vendor: string, deviceCode?: string, serial?: string) {
  const sb = admin();
  if (deviceCode) {
    const { data } = await sb
      .from("att_devices")
      .select("id, device_code, location_id, name, vendor")
      .eq("company_id", companyId)
      .eq("device_code", deviceCode)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data;
  }
  if (serial) {
    const { data } = await sb
      .from("att_devices")
      .select("id, device_code, location_id, name, vendor")
      .eq("company_id", companyId)
      .eq("serial_number", serial)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data;
  }
  // fallback: first device of vendor
  const { data } = await sb
    .from("att_devices")
    .select("id, device_code, location_id, name, vendor")
    .eq("company_id", companyId)
    .eq("vendor", vendor)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data;
}

async function decideEventType(
  companyId: string,
  employeeId: string | null,
  workDate: string,
  preferred?: string
): Promise<"clock_in" | "clock_out" | "break_start" | "break_end"> {
  if (preferred && preferred !== "auto" && preferred !== "check") {
    return preferred as "clock_in" | "clock_out" | "break_start" | "break_end";
  }
  if (!employeeId) return "clock_in";

  const { data: last } = await admin()
    .from("att_events")
    .select("event_type")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .is("deleted_at", null)
    .order("event_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return "clock_in";
  if (last.event_type === "clock_in" || last.event_type === "break_end") return "clock_out";
  if (last.event_type === "break_start") return "break_end";
  return "clock_in";
}

/** Ingest a single punch from ZKTeco / Hikvision (idempotent). */
export async function ingestDevicePunch(input: DevicePunchInput): Promise<IngestResult> {
  const sb = admin();
  const punchTime = new Date(input.punchTime);
  if (Number.isNaN(punchTime.getTime())) {
    return { ok: false, processStatus: "failed", message: "Invalid punch time" };
  }
  const workDate = punchTime.toISOString().slice(0, 10);

  // Idempotency by external id
  if (input.externalId) {
    const { data: existing } = await sb
      .from("att_device_punches")
      .select("id, punch_code, process_status, att_event_id")
      .eq("company_id", input.companyId)
      .eq("vendor", input.vendor)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        punchCode: existing.punch_code as string,
        processStatus: "duplicate",
        message: "Already ingested",
      };
    }
  }

  const device = await resolveDevice(
    input.companyId,
    input.vendor,
    input.deviceCode,
    input.deviceSerial
  );
  const emp = await resolveEmployee(
    input.companyId,
    input.vendor,
    input.deviceUserId,
    input.cardNumber
  );

  const punchCode = await nextCode("att_device_punches", input.companyId, "PCH", "punch_code");

  const { data: punch, error: pErr } = await sb
    .from("att_device_punches")
    .insert({
      company_id: input.companyId,
      punch_code: punchCode,
      device_id: device?.id || null,
      device_code: device?.device_code || input.deviceCode || null,
      vendor: input.vendor,
      device_user_id: input.deviceUserId,
      employee_id: emp.employeeId,
      employee_number: emp.employeeNumber,
      employee_name: emp.employeeName,
      punch_time: punchTime.toISOString(),
      punch_type: input.punchType || "auto",
      verify_mode: input.verifyMode || "fingerprint",
      raw_payload: input.raw || {},
      external_id: input.externalId || null,
      process_status: "pending",
    })
    .select("*")
    .single();

  if (pErr) {
    // unique conflict → duplicate
    if (String(pErr.message || "").toLowerCase().includes("duplicate")) {
      return { ok: true, processStatus: "duplicate", message: pErr.message };
    }
    return { ok: false, processStatus: "failed", message: pErr.message };
  }

  // Integration auto_process?
  const { data: integ } = await sb
    .from("att_device_integrations")
    .select("auto_process, auto_clock_pair, default_location_id, default_location_name")
    .eq("company_id", input.companyId)
    .eq("vendor", input.vendor)
    .eq("enabled", true)
    .maybeSingle();

  if (integ && integ.auto_process === false) {
    return {
      ok: true,
      punchCode,
      processStatus: "pending",
      message: "Queued (auto-process off)",
      employeeName: emp.employeeName,
    };
  }

  // Create att_event + update attendance_records
  try {
    const eventType = await decideEventType(
      input.companyId,
      emp.employeeId,
      workDate,
      input.punchType
    );

    let locationId = device?.location_id || integ?.default_location_id || null;
    let locationName = integ?.default_location_name || null;
    if (locationId) {
      const { data: loc } = await sb
        .from("att_locations")
        .select("name")
        .eq("id", locationId)
        .maybeSingle();
      locationName = loc?.name || locationName;
    }

    const eventCode = await nextCode("att_events", input.companyId, "EVT", "event_code");
    const { data: event, error: eErr } = await sb
      .from("att_events")
      .insert({
        company_id: input.companyId,
        event_code: eventCode,
        employee_id: emp.employeeId,
        employee_name: emp.employeeName,
        employee_number: emp.employeeNumber,
        event_type: eventType,
        event_at: punchTime.toISOString(),
        work_date: workDate,
        location_id: locationId,
        location_name: locationName || device?.name || `${input.vendor} terminal`,
        method: input.verifyMode === "card" ? "rfid" : "biometric",
        device_code: device?.device_code || input.deviceCode || null,
        rfid_badge: input.cardNumber || null,
        verification_status: emp.employeeId ? "approved" : "flagged",
        fraud_flags: emp.employeeId ? [] : ["unmapped_device_user"],
        reject_reason: emp.employeeId ? null : "Device user not mapped to employee",
        status: "recorded",
      })
      .select("*")
      .single();

    if (eErr) throw eErr;

    // Daily record upsert
    if (emp.employeeId) {
      const { data: existing } = await sb
        .from("attendance_records")
        .select("*")
        .eq("company_id", input.companyId)
        .eq("employee_id", emp.employeeId)
        .eq("work_date", workDate)
        .is("deleted_at", null)
        .maybeSingle();

      if (eventType === "clock_in") {
        if (existing) {
          await sb
            .from("attendance_records")
            .update({
              check_in: existing.check_in || punchTime.toISOString(),
              location_name: locationName || existing.location_name,
              verification_method: "biometric",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await sb.from("attendance_records").insert({
            company_id: input.companyId,
            employee_id: emp.employeeId,
            work_date: workDate,
            check_in: punchTime.toISOString(),
            status: "present",
            location_name: locationName,
            verification_method: "biometric",
          });
        }
      } else if (eventType === "clock_out") {
        if (existing) {
          const checkIn = existing.check_in ? new Date(String(existing.check_in)) : null;
          const hours =
            checkIn && !Number.isNaN(checkIn.getTime())
              ? Math.round(((punchTime.getTime() - checkIn.getTime()) / 36e5) * 100) / 100
              : 0;
          await sb
            .from("attendance_records")
            .update({
              check_out: punchTime.toISOString(),
              hours_worked: hours,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await sb.from("attendance_records").insert({
            company_id: input.companyId,
            employee_id: emp.employeeId,
            work_date: workDate,
            check_out: punchTime.toISOString(),
            status: "present",
            location_name: locationName,
            verification_method: "biometric",
          });
        }
      }
    }

    await sb
      .from("att_device_punches")
      .update({
        process_status: "processed",
        att_event_id: event.id,
        processed_at: new Date().toISOString(),
        employee_id: emp.employeeId,
        employee_name: emp.employeeName,
        employee_number: emp.employeeNumber,
      })
      .eq("id", punch.id);

    // Heartbeat / counters on device
    if (device?.id) {
      const { data: devRow } = await sb
        .from("att_devices")
        .select("total_punches")
        .eq("id", device.id)
        .maybeSingle();
      await sb
        .from("att_devices")
        .update({
          status: "online",
          last_heartbeat_at: new Date().toISOString(),
          last_attendance_at: punchTime.toISOString(),
          last_sync_at: new Date().toISOString(),
          total_punches: Number(devRow?.total_punches || 0) + 1,
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", device.id);

      await sb.from("att_device_sync_logs").insert({
        company_id: input.companyId,
        device_id: device.id,
        device_code: device.device_code,
        sync_type: "attendance",
        direction: "push",
        records_count: 1,
        status: "success",
        message: `${input.vendor} punch ${eventType} for ${emp.employeeName}`,
      });
    }

    return {
      ok: true,
      punchCode,
      processStatus: "processed",
      eventCode: event.event_code as string,
      employeeName: emp.employeeName,
      message: emp.employeeId ? "Processed" : "Processed (unmapped user — flagged)",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    await sb
      .from("att_device_punches")
      .update({ process_status: "failed", process_error: msg })
      .eq("id", punch.id);
    return { ok: false, punchCode, processStatus: "failed", message: msg };
  }
}

export async function validatePushToken(
  companyId: string,
  vendor: string,
  token: string | null | undefined
): Promise<boolean> {
  if (!token) return false;
  const { data } = await admin()
    .from("att_device_integrations")
    .select("id, push_token, enabled")
    .eq("company_id", companyId)
    .eq("vendor", vendor)
    .maybeSingle();
  if (!data || !data.enabled) return false;
  return String(data.push_token) === String(token);
}

export async function resolveCompanyByToken(vendor: string, token: string) {
  const { data } = await admin()
    .from("att_device_integrations")
    .select("company_id, push_token, enabled, auto_process")
    .eq("vendor", vendor)
    .eq("push_token", token)
    .eq("enabled", true)
    .maybeSingle();
  return data;
}
