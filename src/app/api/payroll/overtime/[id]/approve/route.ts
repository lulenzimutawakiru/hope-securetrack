import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeServerAudit } from "@/lib/api/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  approve: z.boolean(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Approve or reject an overtime claim (money path). */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["payroll.manage", "payroll.admin", "payroll.approve"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    module: "payroll",
  },
  async ({ req, ctx, body, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Overtime claim id required");
    const data = body as z.infer<typeof schema>;

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: claim, error: getErr } = await admin
        .from("pay_overtime_claims")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (getErr) return apiError("INTERNAL", getErr.message, 500);
      if (!claim) {
        return apiError(
          "NOT_FOUND",
          "Overtime claim not found in this company",
          404
        );
      }
      if (claim.status !== "pending") {
        return apiError(
          "VALIDATION",
          `Only pending OT claims can be reviewed (status: ${claim.status})`,
          400
        );
      }
      if (
        claim.created_by === ctx.user.id &&
        !ctx.isPlatformAdmin &&
        !ctx.isElevated
      ) {
        return apiError(
          "FORBIDDEN",
          "OT claims cannot be approved by the requester",
          403
        );
      }

      const nextStatus = data.approve ? "approved" : "rejected";
      const { data: updated, error: updErr } = await admin
        .from("pay_overtime_claims")
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
          updErr?.message ?? "Failed to update OT claim",
          500
        );
      }

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: data.approve
          ? "payroll.overtime_approved"
          : "payroll.overtime_rejected",
        module: "payroll",
        entity_type: "pay_overtime_claims",
        entity_id: claim.id,
        entity_reference: claim.claim_number ?? undefined,
        before_state: { status: claim.status },
        after_state: { status: nextStatus, notes: data.notes ?? null },
        metadata: { source: "api/payroll/overtime/[id]/approve" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ claim: updated });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "OT claim review failed",
        500
      );
    }
  }
);
