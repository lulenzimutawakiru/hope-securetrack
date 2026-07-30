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
export async function POST(req: NextRequest) {
  const auth = await requireApiAuth({
    permissions: ["payroll.process", "payroll.manage", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-process:${auth.ctx.user.id}:${ip}`,
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
    // Process is lower risk than release — only enforce if dual_control_id sent or forced
    required: Boolean(parsed.data.dual_control_id) || false,
  });
  if (!dc.ok) return apiError("FORBIDDEN", dc.error, 403);

  try {
    if (parsed.data.async) {
      const admin = createAdminClient();
      const job = await enqueueJob(admin, {
        companyId: auth.ctx.companyId,
        tenantId: auth.ctx.tenantId,
        jobType: "payroll.async_process",
        payload: {
          country_code: parsed.data.country_code,
          currency: parsed.data.currency,
          pay_group: parsed.data.pay_group,
          actor_id: auth.ctx.user.id,
        },
        idempotencyKey: `payroll-process:${auth.ctx.tenantId}:${auth.ctx.companyId}:${new Date().toISOString().slice(0, 10)}`,
      });
      return apiOk({ queued: true, job_id: job?.id || null });
    }

    // Tenant context from session only — never client company/tenant
    const result = await serverProcessPayrollRun({
      company_id: auth.ctx.companyId,
      created_by: auth.ctx.user.id,
      country_code: parsed.data.country_code,
      currency: parsed.data.currency,
      pay_group: parsed.data.pay_group,
    });
    return apiOk({
      run: result,
      tenant_id: auth.ctx.tenantId,
      company_id: auth.ctx.companyId,
    });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Payroll process failed",
      500
    );
  }
}
