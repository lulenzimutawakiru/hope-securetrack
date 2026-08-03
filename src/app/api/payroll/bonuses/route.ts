import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(150),
  bonus_type: z
    .enum([
      "performance",
      "production",
      "sales",
      "department",
      "holiday",
      "other",
    ])
    .default("performance"),
  amount: z.number().positive(),
  department: z.string().max(100).optional().nullable(),
  period_label: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function nextBonusNumber(count: number): string {
  const y = new Date().getFullYear();
  return `BN-${y}-${String(count + 1).padStart(4, "0")}`;
}

/** Create a bonus / incentive (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.admin"],
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

    try {
      if (data.employee_id) {
        const { data: emp, error: empErr } = await admin
          .from("employees")
          .select("id")
          .eq("id", data.employee_id)
          .eq("company_id", companyId)
          .maybeSingle();
        if (empErr) return apiError("INTERNAL", empErr.message, 500);
        if (!emp) {
          return apiError(
            "NOT_FOUND",
            "Employee not found in this company",
            404
          );
        }
      }

      let bonus: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 3 && !bonus; attempt++) {
        const { count, error: countErr } = await admin
          .from("pay_bonuses")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId);
        if (countErr) return apiError("INTERNAL", countErr.message, 500);

        const { data: row, error } = await admin
          .from("pay_bonuses")
          .insert({
            company_id: companyId,
            bonus_number: nextBonusNumber(count ?? 0),
            employee_id: data.employee_id ?? null,
            department: data.department ?? null,
            bonus_type: data.bonus_type,
            name: data.name,
            amount: Math.round(data.amount * 100) / 100,
            period_label: data.period_label ?? null,
            status: "pending",
            notes: data.notes ?? null,
            created_by: ctx.user.id,
          })
          .select("*")
          .single();
        if (!error && row) {
          bonus = row;
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
          error?.message ?? "Failed to create bonus",
          500
        );
      }
      if (!bonus) {
        return apiError("INTERNAL", "Failed to create bonus", 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "payroll.bonus_created",
        module: "payroll",
        entity_type: "pay_bonuses",
        entity_id: String(bonus.id),
        entity_reference: String(bonus.bonus_number ?? ""),
        after_state: {
          employee_id: bonus.employee_id,
          amount: bonus.amount,
        },
        metadata: { source: "api/payroll/bonuses" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ bonus }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Bonus creation failed",
        500
      );
    }
  }
);
