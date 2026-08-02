import { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/security/api-auth";
import {
  apiError,
  apiOk,
  clientIp,
  rateLimitStrict,
} from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Approve a purchase requisition (money path).
 *
 * Only submitted requisitions can be approved; approver identity is taken
 * from the session, never the request body.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth({
    permissions: ["procurement.manage", "procurement.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
  });
  if ("response" in auth) return auth.response;

  const ip = clientIp(req);
  const rl = await rateLimitStrict(
    `procurement-requisition-approve:${auth.ctx.user.id}:${ip}`,
    30,
    60_000
  );
  if (!rl.allowed) return apiError("RATE_LIMIT", "Rate limit exceeded", 429);

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const companyId = auth.ctx.companyId;

  try {
    const { data: pr, error: prErr } = await admin
      .from("purchase_requisitions")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (prErr) return apiError("INTERNAL", prErr.message, 500);
    if (!pr) return apiError("NOT_FOUND", "Requisition not found", 404);
    if (pr.status !== "submitted") {
      return apiError(
        "VALIDATION",
        `Only submitted requisitions can be approved (status: ${pr.status})`,
        400
      );
    }
    if (pr.created_by === auth.ctx.user.id && !auth.ctx.isPlatformAdmin && !auth.ctx.isElevated) {
      return apiError("FORBIDDEN", "Requisitions cannot be approved by the requester", 403);
    }

    const { data: updated, error: updErr } = await admin
      .from("purchase_requisitions")
      .update({
        status: "approved",
        approved_by: auth.ctx.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (updErr || !updated) {
      return apiError("INTERNAL", updErr?.message ?? "Failed to approve requisition", 500);
    }

    await writeServerAudit(admin, {
      company_id: companyId,
      user_id: auth.ctx.user.id,
      action: "procurement.requisition_approved",
      module: "procurement",
      entity_type: "purchase_requisitions",
      entity_id: pr.id,
      entity_reference: pr.requisition_number,
      before_state: { status: pr.status },
      after_state: { status: "approved" },
      metadata: { source: "api/procurement/requisitions/[id]/approve" },
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
    });

    return apiOk({ requisition: updated });
  } catch (e) {
    return apiError(
      "INTERNAL",
      e instanceof Error ? e.message : "Requisition approval failed",
      500
    );
  }
}
