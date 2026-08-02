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
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Approve or reject a bonus (money path).
 *
 * Only pending bonuses can be reviewed. Approver identity comes from the
 * authenticated session; a user cannot approve their own bonus unless
 * platform-elevated.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["payroll.manage", "payroll.admin", "payroll.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `payroll-bonus-approve:${auth.ctx.user.id}:${ip}`,
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
    const { data: bonus, error: getErr } = await admin
      .from("pay_bonuses")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (getErr) return apiError("INTERNAL", getErr.message, 500);
    if (!bonus) {
      return apiError("NOT_FOUND", "Bonus not found in this company", 404);
    }
    if (bonus.status !== "pending") {
      return apiError(
        "VALIDATION",
        `Only pending bonuses can be reviewed (status: ${bonus.status})`,
        400
      );
    }
    if (
      bonus.created_by === auth.ctx.user.id &&
      !auth.ctx.isPlatformAdmin &&
      !auth.ctx.isElevated
    ) {
      return apiError("FORBIDDEN", "Bonuses cannot be approved by the requester", 403);
    }

    const nextStatus = parsed.data.approve ? "approved" : "rejected";
    const { data: updated, error: updErr } = await admin
      .from("pay_bonuses")
      .update({
        status: nextStatus,
        approved_by: auth.ctx.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr || !updated) {
      return apiError("INTERNAL", updErr?.message ?? "Failed to update bonus", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: parsed.data.approve
        ? "payroll.bonus_approved"
        : "payroll.bonus_rejected",
      module: "payroll",
      entity_type: "pay_bonuses",
      entity_id: bonus.id,
      entity_reference: bonus.bonus_number ?? undefined,
      before_state: { status: bonus.status },
      after_state: { status: nextStatus, notes: parsed.data.notes ?? null },
      metadata: { source: "api/payroll/bonuses/[id]/approve" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ bonus: updated });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Bonus review failed",
      500
    );
  }
}
