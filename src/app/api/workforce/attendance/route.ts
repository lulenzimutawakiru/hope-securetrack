import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  action: z.enum(["in", "out"]),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function localHourMin(date: Date): { hour: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour"), min: get("minute") };
}

/** Web clock in/out — labor cost snapshot on clock-out (server-side). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["att.clock", "att.manage", "att.admin", "att.field"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "attendance",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const companyId = ctx.companyId;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();
    const lat = data.lat ?? null;
    const lng = data.lng ?? null;

    try {
      const { data: employee, error: empErr } = await admin
        .from("employees")
        .select(
          "id, first_name, last_name, employee_number, hourly_rate, department, cost_center"
        )
        .eq("id", data.employee_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (empErr) return apiError("INTERNAL", empErr.message, 500);
      if (!employee) {
        return apiError("NOT_FOUND", "Employee not found in this company", 404);
      }

      const { data: existing, error: exErr } = await admin
        .from("attendance_records")
        .select("*")
        .eq("employee_id", data.employee_id)
        .eq("work_date", today)
        .maybeSingle();
      if (exErr) return apiError("INTERNAL", exErr.message, 500);

      if (data.action === "in") {
        if (existing?.check_in) {
          return apiError("VALIDATION", "Already clocked in today", 400);
        }

        const { hour, min } = localHourMin(now);
        const late =
          hour > 8 || (hour === 8 && min > 15)
            ? (hour - 8) * 60 + Math.max(0, min - 15)
            : 0;
        const status = late > 0 ? "late" : "present";
        const method = lat ? "mobile_gps" : "web";

        let recordId: string;
        if (existing) {
          const { data: upd, error: updErr } = await admin
            .from("attendance_records")
            .update({
              check_in: nowIso,
              method,
              check_in_lat: lat,
              check_in_lng: lng,
              late_minutes: late,
              status,
              notes: data.notes ?? existing.notes ?? null,
              updated_at: nowIso,
            })
            .eq("id", existing.id)
            .select("id")
            .single();
          if (updErr || !upd) {
            return apiError(
              "INTERNAL",
              updErr?.message ?? "Clock in failed",
              500
            );
          }
          recordId = upd.id;
        } else {
          const { data: ins, error: insErr } = await admin
            .from("attendance_records")
            .insert({
              company_id: companyId,
              employee_id: data.employee_id,
              work_date: today,
              check_in: nowIso,
              method,
              check_in_lat: lat,
              check_in_lng: lng,
              late_minutes: late,
              status,
              notes: data.notes ?? null,
              created_by: ctx.user.id,
              updated_at: nowIso,
            })
            .select("id")
            .single();
          if (insErr || !ins) {
            return apiError(
              "INTERNAL",
              insErr?.message ?? "Clock in failed",
              500
            );
          }
          recordId = ins.id;
        }

        await writeServerAudit(admin, {
          company_id: companyId,
          user_id: ctx.user.id,
          action: "attendance.clock_in",
          module: "attendance",
          entity_type: "attendance_records",
          entity_id: recordId,
          entity_reference: `${today} ${employee.employee_number ?? ""}`.trim(),
          after_state: {
            employee_id: data.employee_id,
            late_minutes: late,
            status,
            method,
          },
          metadata: { source: "api/workforce/attendance" },
          ip_address: ip,
          user_agent: req.headers.get("user-agent"),
        });

        return apiOk(
          { id: recordId, check_in: nowIso, status, late_minutes: late },
          { status: 201 }
        );
      }

      // Clock out
      if (!existing?.check_in) {
        return apiError("VALIDATION", "No clock-in found for today", 400);
      }
      if (existing.check_out) {
        return apiError("VALIDATION", "Already clocked out", 400);
      }

      const workedMin = Math.max(
        0,
        Math.round(
          (now.getTime() - new Date(existing.check_in).getTime()) / 60000
        )
      );
      const overtime = Math.max(0, workedMin - 8 * 60);
      const hoursWorked = Math.round((workedMin / 60) * 100) / 100;

      const { error: outErr } = await admin
        .from("attendance_records")
        .update({
          check_out: nowIso,
          check_out_lat: lat,
          check_out_lng: lng,
          productive_minutes: workedMin,
          overtime_minutes: overtime,
          hours_worked: hoursWorked,
          status: "present",
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (outErr) return apiError("INTERNAL", outErr.message, 500);

      const rate = Number(employee.hourly_rate || 15000) || 15000;
      const regH = Math.min(8, workedMin / 60);
      const otH = overtime / 60;
      const { error: costErr } = await admin.from("labor_cost_entries").insert({
        company_id: companyId,
        employee_id: data.employee_id,
        work_date: today,
        department: employee.department || null,
        cost_center: employee.cost_center || null,
        regular_hours: Math.round(regH * 100) / 100,
        overtime_hours: Math.round(otH * 100) / 100,
        regular_cost: Math.round(regH * rate * 100) / 100,
        overtime_cost: Math.round(otH * rate * 1.5 * 100) / 100,
        total_cost: Math.round((regH * rate + otH * rate * 1.5) * 100) / 100,
        currency: "UGX",
        source: "attendance",
      });
      if (costErr) {
        await admin
          .from("attendance_records")
          .update({
            check_out: null,
            check_out_lat: null,
            check_out_lng: null,
            productive_minutes: 0,
            overtime_minutes: 0,
            hours_worked: 0,
            status: existing.status || "present",
            updated_at: nowIso,
          })
          .eq("id", existing.id);
        return apiError("INTERNAL", costErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "attendance.clock_out",
        module: "attendance",
        entity_type: "attendance_records",
        entity_id: existing.id,
        entity_reference: `${today} ${employee.employee_number ?? ""}`.trim(),
        after_state: {
          employee_id: data.employee_id,
          productive_minutes: workedMin,
          overtime_minutes: overtime,
          hours_worked: hoursWorked,
          labor_cost: {
            regular_hours: Math.round(regH * 100) / 100,
            overtime_hours: Math.round(otH * 100) / 100,
            total_cost:
              Math.round((regH * rate + otH * rate * 1.5) * 100) / 100,
          },
        },
        metadata: { source: "api/workforce/attendance" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk(
        {
          id: existing.id,
          check_out: nowIso,
          productive_minutes: workedMin,
          overtime_minutes: overtime,
          hours_worked: hoursWorked,
        },
        { status: 201 }
      );
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Attendance clock failed",
        500
      );
    }
  }
);
