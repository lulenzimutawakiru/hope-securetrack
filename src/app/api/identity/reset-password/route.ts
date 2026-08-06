import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, createApiHandler } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, simpleHashHint } from "@/lib/idm/password";
import {
  assertDualControl,
  identityDualControlRequired,
} from "@/lib/security/dual-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  user_id: z.string().uuid(),
  return_password: z.boolean().optional(),
  dual_control_id: z.string().uuid().optional().nullable(),
});

/**
 * Forced password reset for IAM admins only.
 * Does NOT return the temporary password by default.
 */
export const POST = createApiHandler(
  {
    auth: true,
    permissions: ["iam.manage", "iam.security", "users.manage"],
    allowPlatformAdmin: true,
    requireMfa: "privileged",
    bodySchema: schema,
    rateLimit: { limit: 10, windowMs: 60_000 },
    module: "identity",
  },
  async ({ ctx, body }) => {
    if (!ctx) return apiError("UNAUTHORIZED", "Sign in required", 401);
    const data = body as z.infer<typeof schema>;

    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "identity.reset_password",
      actor_id: ctx.user.id,
      request_id: data.dual_control_id,
      // Tenant admins resetting users inside their own tenant can proceed
      // directly (RBAC + MFA + tenant isolation still enforced). Platform
      // staff keep dual-control in production.
      required: identityDualControlRequired({
        isPlatformAdmin: ctx.isPlatformAdmin,
        dualControlId: data.dual_control_id,
      }),
    });
    if (!dc.ok) {
      return NextResponse.json(
        { ok: false, error: dc.error, code: "DUAL_CONTROL_REQUIRED" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const userId = data.user_id;

    const { data: target } = await admin
      .from("user_profiles")
      .select("id,company_id,email,is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return apiError("NOT_FOUND", "User not found", 404);
    }

    if (!ctx.isPlatformAdmin && String(target.company_id) !== ctx.companyId) {
      return apiError("FORBIDDEN", "Cannot reset users outside your company", 403);
    }

    if (target.is_platform_admin && !ctx.isPlatformAdmin) {
      return apiError("FORBIDDEN", "Cannot reset a platform administrator", 403);
    }

    const tempPassword = generateTempPassword();

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (error) {
      return apiError("INTERNAL", error.message, 500);
    }

    await admin
      .from("user_profiles")
      .update({
        must_change_password: true,
        temp_password_set: true,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await admin.from("idm_password_history").insert({
      company_id: target.company_id || ctx.companyId,
      user_id: userId,
      password_hash: simpleHashHint(tempPassword),
    });

    await admin.from("idm_password_resets").insert({
      company_id: target.company_id || ctx.companyId,
      user_id: userId,
      token_hash: simpleHashHint(`${userId}-${Date.now()}-${ctx.user.id}`),
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
      forced: true,
      created_by: ctx.user.id,
    });

    await admin.from("idm_audit").insert({
      company_id: target.company_id || ctx.companyId,
      actor_id: ctx.user.id,
      target_user_id: userId,
      action: "reset_password",
      details: "Forced password reset by IAM admin",
    });

    // Preserve legacy envelope for existing callers (ok + top-level fields)
    const payload: Record<string, unknown> = {
      ok: true,
      user_id: userId,
      must_change_password: true,
      message:
        "Password reset. Share the temporary password via a secure channel if return_password was requested.",
    };
    if (
      data.return_password &&
      (ctx.isPlatformAdmin || ctx.permissions.includes("iam.manage"))
    ) {
      payload.temp_password = tempPassword;
    }

    return NextResponse.json(payload);
  }
);
