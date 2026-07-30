import { z } from "zod";
import { createApiHandler, apiOk, apiError } from "@/lib/api/handler";
import { assertDualControl } from "@/lib/security/dual-control";
import { serverGenerateBankFile } from "@/lib/payroll/server-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  payroll_run_id: z.string().uuid(),
  bank_name: z.string().max(120).optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/**
 * Server-side bank file generation — dual-control + idempotency via central handler.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.bank", "payroll.pay", "payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    module: "payroll",
    rateLimit: { limit: 15, windowMs: 60_000 },
    bodySchema: schema,
    idempotent: true,
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "payroll.bank_file",
      actor_id: ctx.user.id,
      request_id: body.dual_control_id,
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    try {
      const result = await serverGenerateBankFile({
        company_id: ctx.companyId,
        payroll_run_id: body.payroll_run_id,
        bank_name: body.bank_name,
        created_by: ctx.user.id,
      });
      return apiOk(result);
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Bank file failed",
        500
      );
    }
  }
);
