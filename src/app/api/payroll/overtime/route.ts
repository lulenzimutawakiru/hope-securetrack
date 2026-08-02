import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";
import { calcOvertimeAmount, estimateHourlyFromMonthly } from "@/lib/payroll/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  work_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "work_date must be YYYY-MM-DD"),
  hours: z.number().positive().max(24),
  ot_type: z.enum(["weekday", "weekend", "holiday", "night"]).default("weekday"),
  notes: z.string().max(2000).optional().nullable(),
});

const RATE_MULTIPLIERS: Record<string, number> = {
  weekday: 1.5,
  night: 1.75,
  weekend: 2,
  holiday: 2,
};

function nextClaimNumber(count: number): string {
  const y = new Date().getFullYear();
  return `OT-${y}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Submit an overtime claim (money path).
 *
 * The hourly rate, multiplier and amount are computed server-side from the
 * employee's salary; company_id and created_by come from the session, never
 * the body. Mirrors the legacy createOvertimeClaim calculation exactly.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.admin", "payroll.self"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-overtime:${auth.ctx.user.id}:${ip}`,
    20,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;
  const otType = parsed.data.ot_type;

  try {
    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, salary")
      .eq("id", parsed.data.employee_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) return apiError("INTERNAL", empErr.message, 500);
    if (!emp) {
      return apiError("NOT_FOUND", "Employee not found in this company", 404);
    }

    const hourly = estimateHourlyFromMonthly(Number(emp.salary) || 0);
    const amount = calcOvertimeAmount(parsed.data.hours, hourly, otType);

    let claim: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3 && !claim; attempt++) {
      const { count, error: countErr } = await admin
        .from("pay_overtime_claims")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data, error } = await admin
        .from("pay_overtime_claims")
        .insert({
          company_id: companyId,
          claim_number: nextClaimNumber(count ?? 0),
          employee_id: parsed.data.employee_id,
          work_date: parsed.data.work_date,
          hours: parsed.data.hours,
          ot_type: otType,
          rate_multiplier: RATE_MULTIPLIERS[otType] ?? 1.5,
          hourly_rate: Math.round(hourly),
          amount,
          status: "pending",
          notes: parsed.data.notes ?? null,
          created_by: auth.ctx.user.id,
        })
        .select("*")
        .single();
      if (!error && data) {
        claim = data;
        break;
      }
      if (error && (error.code === "23505" || String(error.message).includes("duplicate"))) {
        continue; // claim_number collision — retry with a fresh count
      }
      return apiError("INTERNAL", error?.message ?? "Failed to create OT claim", 500);
    }
    if (!claim) {
      return apiError("INTERNAL", "Failed to create OT claim", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "payroll.overtime_claimed",
      module: "payroll",
      entity_type: "pay_overtime_claims",
      entity_id: claim.id as string,
      entity_reference: claim.claim_number as string,
      after_state: {
        employee_id: claim.employee_id,
        hours: claim.hours,
        ot_type: claim.ot_type,
        amount: claim.amount,
      },
      metadata: { source: "api/payroll/overtime" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ claim }, { status: 201 });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "OT claim failed",
      500
    );
  }
}
