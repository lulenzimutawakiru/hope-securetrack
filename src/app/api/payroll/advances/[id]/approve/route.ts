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
 * Approve or reject a payroll advance (money path).
 *
 * Only pending advances can be reviewed. A user may not approve their own
 * request (no self-approval) unless they hold platform elevation.
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
    `payroll-advance-approve:${auth.ctx.user.id}:${ip}`,
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
    const { data: advance, error: advErr } = await admin
      .from("pay_advances")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (advErr) return apiError("INTERNAL", advErr.message, 500);
    if (!advance) return apiError("NOT_FOUND", "Advance not found", 404);
    if (advance.status !== "pending") {
      return apiError(
        "VALIDATION",
        `Only pending advances can be reviewed (status: ${advance.status})`,
        400
      );
    }
    if (
      advance.created_by === auth.ctx.user.id &&
      !auth.ctx.isPlatformAdmin &&
      !auth.ctx.isElevated
    ) {
      return apiError(
        "FORBIDDEN",
        "Advances cannot be approved by the requester",
        403
      );
    }

    const nextStatus = parsed.data.approve ? "approved" : "rejected";
    const { data: updated, error: updErr } = await admin
      .from("pay_advances")
      .update({
        status: nextStatus,
        approved_by: auth.ctx.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr || !updated) {
      return apiError("INTERNAL", updErr?.message ?? "Failed to update advance", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: parsed.data.approve
        ? "payroll.advance_approved"
        : "payroll.advance_rejected",
      module: "payroll",
      entity_type: "pay_advances",
      entity_id: advance.id,
      entity_reference: advance.advance_number,
      before_state: { status: advance.status },
      after_state: { status: nextStatus, reason: parsed.data.reason ?? null },
      metadata: { source: "api/payroll/advances/[id]/approve" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ advance: updated });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Advance review failed",
      500
    );
  }
}
