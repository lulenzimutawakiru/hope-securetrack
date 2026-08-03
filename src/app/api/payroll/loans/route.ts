import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  loan_type: z.string().max(40).optional(),
  principal: z.number().positive(),
  interest_rate_pct: z.number().min(0).max(100).optional(),
  installments: z.number().int().min(1).max(120).default(1),
  notes: z.string().max(2000).optional().nullable(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

function nextLoanNumber(count: number): string {
  const y = new Date().getFullYear();
  return `LN-${y}-${String(count + 1).padStart(4, "0")}`;
}

/** Create an employee loan (money path). Interest/totals computed server-side. */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: [
      "payroll.manage",
      "payroll.self",
      "payroll.approve",
      "payroll.admin",
    ],
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

      const principal = Math.round(data.principal * 100) / 100;
      const interest =
        Math.round(principal * ((data.interest_rate_pct || 0) / 100) * 100) /
        100;
      const total = Math.round((principal + interest) * 100) / 100;
      const installments = data.installments;
      const installmentAmount =
        Math.round((total / installments) * 100) / 100;

      const { count, error: countErr } = await admin
        .from("pay_loans")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data: loan, error: loanErr } = await admin
        .from("pay_loans")
        .insert({
          company_id: companyId,
          loan_number: nextLoanNumber(count ?? 0),
          employee_id: data.employee_id,
          loan_type: data.loan_type || "salary_advance",
          principal,
          interest_rate_pct: data.interest_rate_pct || 0,
          total_payable: total,
          installment_amount: installmentAmount,
          installments,
          paid_installments: 0,
          outstanding: total,
          start_date: new Date().toISOString().slice(0, 10),
          status: "pending",
          notes: data.notes ?? null,
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (loanErr || !loan) {
        return apiError(
          "INTERNAL",
          loanErr?.message ?? "Failed to create loan",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "payroll.loan_created",
        module: "payroll",
        entity_type: "pay_loans",
        entity_id: loan.id,
        entity_reference: loan.loan_number,
        after_state: {
          employee_id: loan.employee_id,
          principal,
          total,
          installments,
        },
        metadata: { source: "api/payroll/loans" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ loan }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Loan creation failed",
        500
      );
    }
  }
);
