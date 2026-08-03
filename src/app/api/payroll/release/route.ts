import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { assertDualControl } from "@/lib/security/dual-control";
import { serverReleasePayroll } from "@/lib/payroll/server-ops";
import { enqueueJob } from "@/lib/jobs/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { postAccountingEvent } from "@/lib/finance/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  payroll_run_id: z.string().uuid(),
  dual_control_id: z.string().uuid().optional().nullable(),
  post_gl: z.boolean().optional(),
  net_total: z.number().optional(),
});

/** Final payroll payment release — dual-control gated in production */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.pay", "payroll.admin", "payroll.manage"],
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
    });
    if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

    try {
      const result = await serverReleasePayroll({
        company_id: ctx.companyId,
        payroll_run_id: data.payroll_run_id,
        actor_id: ctx.user.id,
      });

      if (data.post_gl && data.net_total && data.net_total > 0) {
        try {
          await postAccountingEvent(
            {
              companyId: ctx.companyId,
              eventType: "payroll_post",
              sourceModule: "payroll",
              sourceRef: data.payroll_run_id,
              amount: data.net_total,
              description: `Payroll release ${data.payroll_run_id}`,
              actorId: ctx.user.id,
            },
            createAdminClient()
          );
        } catch {
          /* GL best-effort */
        }
      }

      const admin = createAdminClient();
      await enqueueJob(admin, {
        companyId: ctx.companyId,
        tenantId: ctx.tenantId,
        jobType: "notification.dispatch",
        payload: {
          companyId: ctx.companyId,
          tenantId: ctx.tenantId,
          title: "Payroll released",
          message: `Payroll run ${data.payroll_run_id} marked paid`,
          userIds: [ctx.user.id],
          channels: ["in_app", "email"],
          category: "payroll",
          priority: "high",
          sourceModule: "payroll",
          sourceEvent: "payroll.released",
          entityType: "payroll_run",
          entityId: data.payroll_run_id,
        },
      });

      return apiOk({ release: result });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Release failed",
        500
      );
    }
  }
);
