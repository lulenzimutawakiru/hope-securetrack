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
    .enum(["medical", "life", "pension", "transport", "housing", "education", "other"])
    .default("medical"),
  description: z.string().max(500).optional().nullable(),
  ...base,
});

const enrollmentSchema = z.object({
  entity: z.literal("enrollment"),
  employee_id: z.string().uuid(),
  plan_id: z.string().uuid(),
});

/**
 * Create a benefit plan or enroll an employee into one (money path).
 *
 * company_id always comes from the authenticated session. The plan / employee
 * must belong to the caller's company, and enrollment amounts are taken from
 * the plan, never from the client.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-benefits:${auth.ctx.user.id}:${ip}`,
    30,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("VALIDATION", "Invalid JSON");
  }
  const raw = body as Record<string, unknown>;
  const kind = raw?.entity;
  const schema = kind === "plan" ? planSchema : kind === "enrollment" ? enrollmentSchema : null;
  if (!schema) return apiError("VALIDATION", "entity must be 'plan' or 'enrollment'");
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    if (parsed.data.entity === "plan") {
      const { data: plan, error } = await admin
        .from("pay_benefit_plans")
        .insert({
          company_id: companyId,
          plan_code: String(parsed.data.plan_code).toUpperCase(),
          name: parsed.data.name,
          benefit_type: parsed.data.benefit_type,
          employee_contribution: parsed.data.employee_contribution,
          employer_contribution: parsed.data.employer_contribution,
          is_active: true,
          description: parsed.data.description ?? null,
        })
        .select("*")
        .single();
      if (error) {
        return apiError(
          error.code === "23505" ? "VALIDATION" : "INTERNAL",
          error.code === "23505" ? "A plan with this code already exists" : error.message,
          error.code === "23505" ? 400 : 500
        );
      }
      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: auth.ctx.user.id,
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
      .eq("id", parsed.data.plan_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (planErr) return apiError("INTERNAL", planErr.message, 500);
    if (!plan) return apiError("NOT_FOUND", "Benefit plan not found in this company", 404);

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id")
      .eq("id", parsed.data.employee_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) return apiError("INTERNAL", empErr.message, 500);
    if (!emp) return apiError("NOT_FOUND", "Employee not found in this company", 404);

    const { data: enrollment, error } = await admin
      .from("pay_employee_benefits")
      .insert({
        company_id: companyId,
        employee_id: parsed.data.employee_id,
        plan_id: parsed.data.plan_id,
        employee_amount: Number(plan.employee_contribution) || 0,
        employer_amount: Number(plan.employer_contribution) || 0,
        status: "active",
      })
      .select("*")
      .single();
    if (error) return apiError("INTERNAL", error.message, 500);

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
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
