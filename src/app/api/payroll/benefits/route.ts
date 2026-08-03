import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const base = {
  employee_contribution: z.number().nonnegative().optional().default(0),
  employer_contribution: z.number().nonnegative().optional().default(0),
};

const planSchema = z.object({
  entity: z.literal("plan"),
  plan_code: z.string().min(1).max(40),
  name: z.string().min(1).max(150),
  benefit_type: z
    .enum([
      "medical",
      "life",
      "pension",
      "transport",
      "housing",
      "education",
      "other",
    ])
    .default("medical"),
  description: z.string().max(500).optional().nullable(),
  ...base,
});

const enrollmentSchema = z.object({
  entity: z.literal("enrollment"),
  employee_id: z.string().uuid(),
  plan_id: z.string().uuid(),
});

const schema = z.union([planSchema, enrollmentSchema]);

/** Create a benefit plan or enroll an employee (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;
    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      if (data.entity === "plan") {
        const { data: plan, error } = await admin
          .from("pay_benefit_plans")
          .insert({
            company_id: companyId,
            plan_code: String(data.plan_code).toUpperCase(),
            name: data.name,
            benefit_type: data.benefit_type,
            employee_contribution: data.employee_contribution,
            employer_contribution: data.employer_contribution,
            is_active: true,
            description: data.description ?? null,
          })
          .select("*")
          .single();
        if (error) {
          return apiError(
            error.code === "23505" ? "VALIDATION" : "INTERNAL",
            error.code === "23505"
              ? "A plan with this code already exists"
              : error.message,
            error.code === "23505" ? 400 : 500
          );
        }
        await writeServerAudit(admin, {
          company_id: companyId,
          user_id: ctx.user.id,
          action: "payroll.benefit_plan_created",
          module: "payroll",
          entity_type: "pay_benefit_plans",
          entity_id: plan.id,
          entity_reference: plan.plan_code ?? undefined,
          after_state: {
            name: plan.name,
            benefit_type: plan.benefit_type,
            employee_contribution: plan.employee_contribution,
            employer_contribution: plan.employer_contribution,
          },
          metadata: { source: "api/payroll/benefits" },
          ip_address: ip,
          user_agent: req.headers.get("user-agent"),
        });
        return apiOk({ plan }, { status: 201 });
      }

      const { data: plan, error: planErr } = await admin
        .from("pay_benefit_plans")
        .select("id, employee_contribution, employer_contribution")
        .eq("id", data.plan_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (planErr) return apiError("INTERNAL", planErr.message, 500);
      if (!plan) {
        return apiError(
          "NOT_FOUND",
          "Benefit plan not found in this company",
          404
        );
      }

      const { data: emp, error: empErr } = await admin
        .from("employees")
        .select("id")
        .eq("id", data.employee_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (empErr) return apiError("INTERNAL", empErr.message, 500);
      if (!emp) {
        return apiError("NOT_FOUND", "Employee not found in this company", 404);
      }

      const { data: enrollment, error } = await admin
        .from("pay_employee_benefits")
        .insert({
          company_id: companyId,
          employee_id: data.employee_id,
          plan_id: data.plan_id,
          employee_amount: Number(plan.employee_contribution) || 0,
          employer_amount: Number(plan.employer_contribution) || 0,
          status: "active",
        })
        .select("*")
        .single();
      if (error) return apiError("INTERNAL", error.message, 500);

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "payroll.benefit_enrolled",
        module: "payroll",
        entity_type: "pay_employee_benefits",
        entity_id: enrollment.id,
        after_state: {
          employee_id: enrollment.employee_id,
          plan_id: enrollment.plan_id,
          employee_amount: enrollment.employee_amount,
          employer_amount: enrollment.employer_amount,
        },
        metadata: { source: "api/payroll/benefits" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ enrollment }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Benefit operation failed",
        500
      );
    }
  }
);
