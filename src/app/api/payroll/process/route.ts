import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { assertDualControl } from "@/lib/security/dual-control";
import { serverProcessPayrollRun } from "@/lib/payroll/server-ops";
import { enqueueJob } from "@/lib/jobs/queue";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  country_code: z.string().max(8).optional(),
  currency: z.string().max(8).optional(),
  pay_group: z.string().max(40).optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
  async: z.boolean().optional(),
});

/**
 * Server-side payroll run processing (money path).
 * Prefer this over browser processPayrollRun for production.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.process", "payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    idempotent: true,
    rateLimit: { limit: 10, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "payroll.release",
      actor_id: ctx.user.id,
      request_id: data.dual_control_id,
      // Process is lower risk than release — only enforce if dual_control_id sent or forced
      required: Boolean(data.dual_control_id) || false,
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    try {
      if (data.async) {
        const admin = createAdminClient();
        const job = await enqueueJob(admin, {
          companyId: ctx.companyId,
          tenantId: ctx.tenantId,
          jobType: "payroll.async_process",
          payload: {
            country_code: data.country_code,
            currency: data.currency,
            pay_group: data.pay_group,
            actor_id: ctx.user.id,
          },
          idempotencyKey: `payroll-process:${ctx.tenantId}:${ctx.companyId}:${new Date().toISOString().slice(0, 10)}`,
        });
        return apiOk({ queued: true, job_id: job?.id || null });
      }

      // Tenant context from session only — never client company/tenant
      const result = await serverProcessPayrollRun({
        company_id: ctx.companyId,
        created_by: ctx.user.id,
        country_code: data.country_code,
        currency: data.currency,
        pay_group: data.pay_group,
      });
      return apiOk({
        run: result,
        tenant_id: ctx.tenantId,
        company_id: ctx.companyId,
      });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Payroll process failed",
        500
      );
    }
  }
);
