import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  approve: z.boolean(),
  reason: z.string().max(1000).optional().nullable(),
});

/** Approve or reject a payroll advance (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.approve", "payroll.admin"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Advance id required");
    const data = body as z.infer<typeof schema>;

    const admin = createAdminClient();
    const companyId = ctx.companyId;

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
        advance.created_by === ctx.user.id &&
        !ctx.isPlatformAdmin &&
        !ctx.isElevated
      ) {
        return apiError(
          "FORBIDDEN",
          "Advances cannot be approved by the requester",
          403
        );
      }

      const nextStatus = data.approve ? "approved" : "rejected";
      const { data: updated, error: updErr } = await admin
        .from("pay_advances")
        .update({
          status: nextStatus,
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updErr || !updated) {
        return apiError(
          "INTERNAL",
          updErr?.message ?? "Failed to update advance",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: data.approve
          ? "payroll.advance_approved"
          : "payroll.advance_rejected",
        module: "payroll",
        entity_type: "pay_advances",
        entity_id: advance.id,
        entity_reference: advance.advance_number,
        before_state: { status: advance.status },
        after_state: { status: nextStatus, reason: data.reason ?? null },
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
);
