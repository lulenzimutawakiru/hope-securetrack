import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  approve: z.boolean(),
  reason: z.string().max(1000).optional().nullable(),
});

/** Approve or reject a payroll loan (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.approve", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Loan id required");
    const data = body as z.infer<typeof schema>;

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: loan, error: loanErr } = await admin
        .from("pay_loans")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (loanErr) return apiError("INTERNAL", loanErr.message, 500);
      if (!loan) return apiError("NOT_FOUND", "Loan not found", 404);
      if (loan.status !== "pending") {
        return apiError(
          "VALIDATION",
          `Only pending loans can be reviewed (status: ${loan.status})`,
          400
        );
      }
      if (
        loan.created_by === ctx.user.id &&
        !ctx.isPlatformAdmin &&
        !ctx.isElevated
      ) {
        return apiError(
          "FORBIDDEN",
          "Loans cannot be approved by the requester",
          403
        );
      }

      const nextStatus = data.approve ? "active" : "rejected";
      const { data: updated, error: updErr } = await admin
        .from("pay_loans")
        .update({
          status: nextStatus,
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr || !updated) {
        return apiError(
          "INTERNAL",
          updErr?.message ?? "Failed to update loan",
          500
        );
      }

      if (data.approve) {
        const start = new Date();
        const rows = Array.from(
          { length: Number(updated.installments) || 1 },
          (_, i) => {
            const due = new Date(start);
            due.setMonth(due.getMonth() + (i + 1));
            return {
              company_id: companyId,
              loan_id: id,
              installment_no: i + 1,
              due_date: due.toISOString().slice(0, 10),
              amount: Number(updated.installment_amount) || 0,
              paid_amount: 0,
              status: "scheduled",
            };
          }
        );
        const { error: schedErr } = await admin
          .from("pay_loan_schedules")
          .insert(rows);
        if (schedErr) return apiError("INTERNAL", schedErr.message, 500);
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: data.approve ? "payroll.loan_approved" : "payroll.loan_rejected",
        module: "payroll",
        entity_type: "pay_loans",
        entity_id: loan.id,
        entity_reference: loan.loan_number,
        before_state: { status: loan.status },
        after_state: { status: nextStatus, reason: data.reason ?? null },
        metadata: { source: "api/payroll/loans/[id]/approve" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ loan: updated });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Loan review failed",
        500
      );
    }
  }
);
