import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/security/api-auth";
import { assertDualControl } from "@/lib/security/dual-control";
import {
  apiError,
  apiOk,
  clientIp,
  parseJson,
  rateLimitStrict,
} from "@/lib/api";
import { serverReleasePayroll } from "@/lib/payroll/server-ops";
import { enqueueJob } from "@/lib/jobs/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { postAccountingEvent } from "@/lib/finance/engine";
import { createAdminClient as createFinanceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  payroll_run_id: z.string().uuid(),
  dual_control_id: z.string().uuid().optional().nullable(),
  post_gl: z.boolean().optional(),
  net_total: z.number().optional(),
});

/** Final payroll payment release — dual-control gated in production */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.pay", "payroll.admin", "payroll.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-release:${auth.ctx.user.id}:${ip}`,
    10,
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

  const dc = await assertDualControl({
    company_id: auth.ctx.companyId,
    action: "payroll.release",
    actor_id: auth.ctx.user.id,
    request_id: parsed.data.dual_control_id,
  });
  if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

  try {
    const result = await serverReleasePayroll({
      company_id: auth.ctx.companyId,
      payroll_run_id: parsed.data.payroll_run_id,
      actor_id: auth.ctx.user.id,
    });

    if (parsed.data.post_gl && parsed.data.net_total && parsed.data.net_total > 0) {
      try {
        await postAccountingEvent(
          {
            companyId: auth.ctx.companyId,
            eventType: "payroll_post",
            sourceModule: "payroll",
            sourceRef: parsed.data.payroll_run_id,
            amount: parsed.data.net_total,
            description: `Payroll release ${parsed.data.payroll_run_id}`,
            actorId: auth.ctx.user.id,
          },
          createFinanceClient()
        );
      } catch {
        /* GL best-effort */
      }
    }

    const admin = createAdminClient();
    await enqueueJob(admin, {
      companyId: auth.ctx.companyId,
      tenantId: auth.ctx.tenantId,
      jobType: "notification.dispatch",
      payload: {
        companyId: auth.ctx.companyId,
        tenantId: auth.ctx.tenantId,
        title: "Payroll released",
        message: `Payroll run ${parsed.data.payroll_run_id} marked paid`,
        userIds: [auth.ctx.user.id],
        channels: ["in_app", "email"],
        category: "payroll",
        priority: "high",
        sourceModule: "payroll",
        sourceEvent: "payroll.released",
        entityType: "payroll_run",
        entityId: parsed.data.payroll_run_id,
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
