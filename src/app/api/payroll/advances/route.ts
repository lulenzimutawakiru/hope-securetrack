import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  employee_id: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().max(1000).optional().nullable(),
  request_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "request_date must be YYYY-MM-DD")
    .optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

function nextAdvanceNumber(count: number): string {
  const y = new Date().getFullYear();
  return `ADV-${y}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Request a payroll advance (money path).
 * Employee must belong to caller's company; company_id from session.
 */
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

      const { count, error: countErr } = await admin
        .from("pay_advances")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (countErr) return apiError("INTERNAL", countErr.message, 500);

      const { data: advance, error: advErr } = await admin
        .from("pay_advances")
        .insert({
          company_id: companyId,
          advance_number: nextAdvanceNumber(count ?? 0),
          employee_id: data.employee_id,
          amount: Math.round(data.amount * 100) / 100,
          reason: data.reason ?? null,
          status: "pending",
          request_date:
            data.request_date ?? new Date().toISOString().slice(0, 10),
          created_by: ctx.user.id,
        })
        .select("*")
        .single();
      if (advErr || !advance) {
        return apiError(
          "INTERNAL",
          advErr?.message ?? "Failed to create advance",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: "payroll.advance_requested",
        module: "payroll",
        entity_type: "pay_advances",
        entity_id: advance.id,
        entity_reference: advance.advance_number,
        after_state: {
          employee_id: advance.employee_id,
          amount: advance.amount,
        },
        metadata: { source: "api/payroll/advances" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ advance }, { status: 201 });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Advance request failed",
        500
      );
    }
  }
);
