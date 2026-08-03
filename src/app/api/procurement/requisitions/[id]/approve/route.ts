import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Approve a purchase requisition (money path).
 * Approver identity from session; no self-approval without elevation.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["procurement.manage", "procurement.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "procurement",
  },
  async ({ req, ctx, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Requisition id required");

    const admin = createAdminClient();
    const companyId = ctx.companyId;

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
      if (
        pr.created_by === ctx.user.id &&
        !ctx.isPlatformAdmin &&
        !ctx.isElevated
      ) {
        return apiError(
          "FORBIDDEN",
          "Requisitions cannot be approved by the requester",
          403
        );
      }

      const { data: updated, error: updErr } = await admin
        .from("purchase_requisitions")
        .update({
          status: "approved",
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr || !updated) {
        return apiError(
          "INTERNAL",
          updErr?.message ?? "Failed to approve requisition",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
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
);
