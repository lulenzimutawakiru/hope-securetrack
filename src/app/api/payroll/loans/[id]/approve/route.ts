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

const schema = z.object({
  approve: z.boolean(),
  reason: z.string().max(1000).optional().nullable(),
});

/**
 * Approve or reject a payroll loan (money path).
 *
 * Only pending loans can be reviewed. Approving activates the loan and
 * generates the installment schedule. A user may not approve their own loan
 * unless they hold platform elevation.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.approve", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-loan-approve:${auth.ctx.user.id}:${ip}`,
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
  const parsed = parseJson(schema, body);
  if (!parsed.success) return apiError("VALIDATION", parsed.error);

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

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
      loan.created_by === auth.ctx.user.id &&
      !auth.ctx.isPlatformAdmin &&
      !auth.ctx.isElevated
    ) {
      return apiError(
        "FORBIDDEN",
        "Loans cannot be approved by the requester",
        403
      );
    }

    const nextStatus = parsed.data.approve ? "active" : "rejected";
    const { data: updated, error: updErr } = await admin
      .from("pay_loans")
      .update({
        status: nextStatus,
        approved_by: auth.ctx.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr || !updated) {
      return apiError("INTERNAL", updErr?.message ?? "Failed to update loan", 500);
    }

    // Generate installment schedule when activating.
    if (parsed.data.approve) {
      const start = new Date();
      const rows = Array.from({ length: Number(updated.installments) || 1 }, (_, i) => {
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
      });
      const { error: schedErr } = await admin.from("pay_loan_schedules").insert(rows);
      if (schedErr) {
        return apiError("INTERNAL", schedErr.message, 500);
      }
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: parsed.data.approve
        ? "payroll.loan_approved"
        : "payroll.loan_rejected",
      module: "payroll",
      entity_type: "pay_loans",
      entity_id: loan.id,
      entity_reference: loan.loan_number,
      before_state: { status: loan.status },
      after_state: { status: nextStatus, reason: parsed.data.reason ?? null },
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
