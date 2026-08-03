import { z } from "zod";
import { apiError, apiOk, createApiHandler } from "@/lib/api/handler";
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
 * Approver identity always comes from the session.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["hr.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 20, windowMs: 60_000 },
    module: "hr",
  },
  async ({ req, ctx, body, params, ip }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const id = params.id;
    if (!id) return apiError("VALIDATION", "Leave request id required");
    const data = body as z.infer<typeof schema>;

    const admin = createAdminClient();
    const companyId = ctx.companyId;

    try {
      const { data: leave, error: getErr } = await admin
        .from("leave_requests")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (getErr) return apiError("INTERNAL", getErr.message, 500);
      if (!leave) {
        return apiError(
          "NOT_FOUND",
          "Leave request not found in this company",
          404
        );
      }

      const now = new Date().toISOString();
      const { error: updErr } = await admin
        .from("leave_requests")
        .update({
          status: data.status,
          approved_by: ctx.user.id,
          approved_at: now,
          notes: data.notes ?? leave.notes ?? null,
        })
        .eq("id", id)
        .eq("company_id", companyId);
      if (updErr) return apiError("INTERNAL", updErr.message, 500);

      await writeServerAudit(admin, {
        company_id: companyId,
        user_id: ctx.user.id,
        action: `hr.leave_${data.status}`,
        module: "hr",
        entity_type: "leave_requests",
        entity_id: id,
        entity_reference: leave.leave_type ?? undefined,
        before_state: { status: leave.status, approved_by: leave.approved_by },
        after_state: { status: data.status, approved_by: ctx.user.id },
        metadata: { source: "api/hr/leave/[id]/approve" },
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      });

      return apiOk({ id, status: data.status });
    } catch (e) {
      return apiError(
        "INTERNAL",
        e instanceof Error ? e.message : "Leave approval failed",
        500
      );
    }
  }
);
