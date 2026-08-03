import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";
import {
  calcOvertimeAmount,
  estimateHourlyFromMonthly,
} from "@/lib/payroll/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  work_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "work_date must be YYYY-MM-DD"),
  hours: z.number().positive().max(24),
  ot_type: z
    .enum(["weekday", "weekend", "holiday", "night"])
    .default("weekday"),
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

/** Submit an overtime claim (money path). Amounts computed server-side. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.admin", "payroll.self"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const companyId = ctx.companyId;
    const otType = data.ot_type;

    try {
      const { data: emp, error: empErr } = await admin
        .from("employees")
        .select("id, salary")
        .eq("id", data.employee_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (empErr) return apiError("INTERNAL", empErr.message, 500);
      if (!emp) {
        return apiError("NOT_FOUND", "Employee not found in this company", 404);
      }

      const hourly = estimateHourlyFromMonthly(Number(emp.salary) || 0);
      const amount = calcOvertimeAmount(data.hours, hourly, otType);

      let claim: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 3 && !claim; attempt++) {
        const { count, error: countErr } = await admin
          .from("pay_overtime_claims")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId);
        if (countErr) return apiError("INTERNAL", countErr.message, 500);

        const { data: row, error } = await admin
          .from("pay_overtime_claims")
          .insert({
            company_id: companyId,
            claim_number: nextClaimNumber(count ?? 0),
            employee_id: data.employee_id,
            work_date: data.work_date,
            hours: data.hours,
            ot_type: otType,
            rate_multiplier: RATE_MULTIPLIERS[otType] ?? 1.5,
            hourly_rate: Math.round(hourly),
            amount,
            status: "pending",
            notes: data.notes ?? null,
            created_by: ctx.user.id,
          })
          .select("*")
          .single();
        if (!error && row) {
          claim = row;
          break;
        }
        if (
          error &&
          (error.code === "23505" ||
            String(error.message).includes("duplicate"))
        ) {
          continue;
        }
        return apiError(
          "INTERNAL",
          error?.message ?? "Failed to create OT claim",
          500
        );
      }
      if (!claim) {
        return apiError("INTERNAL", "Failed to create OT claim", 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
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
);
