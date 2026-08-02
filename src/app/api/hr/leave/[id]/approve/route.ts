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
  status: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Approve / reject a leave request.
 *
 * The approver identity (approved_by / approved_at) always comes from the
 * authenticated session, never the client. The request must belong to the
 * caller's company.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const auth = await requireApiAuth({
    permissions: ["hr.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `hr-leave-approve:${auth.ctx.user.id}:${ip}`,
    20,
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

  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: leave, error: getErr } = await admin
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (getErr) return apiError("INTERNAL", getErr.message, 500);
    if (!leave) {
      return apiError("NOT_FOUND", "Leave request not found in this company", 404);
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("leave_requests")
      .update({
        status: parsed.data.status,
        approved_by: auth.ctx.user.id,
        approved_at: now,
        notes: parsed.data.notes ?? leave.notes ?? null,
      })
      .eq("id", id)
      .eq("company_id", companyId);
    if (updErr) return apiError("INTERNAL", updErr.message, 500);

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: `hr.leave_${parsed.data.status}`,
      module: "hr",
      entity_type: "leave_requests",
      entity_id: id,
      entity_reference: leave.leave_type ?? undefined,
      before_state: { status: leave.status, approved_by: leave.approved_by },
      after_state: { status: parsed.data.status, approved_by: auth.ctx.user.id },
      metadata: { source: "api/hr/leave/[id]/approve" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ id, status: parsed.data.status });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Leave approval failed",
      500
    );
  }
}
