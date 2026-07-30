import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, simpleHashHint } from "@/lib/idm/password";
import { requireApiAuth, authError } from "@/lib/security/api-auth";
import { clientIp, rateLimit } from "@/lib/api";

/**
 * Forced password reset for IAM admins only.
 * Does NOT return the temporary password by default.
 * Set body.return_password=true only for break-glass (still requires iam.manage).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`reset-pw:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const auth = await requireApiAuth({
      permissions: ["iam.manage", "iam.security", "users.manage"],
      allowPlatformAdmin: true,
      requireMfa: "privileged",
    });
    if ("response" in auth) return auth.response;
    const { ctx } = auth;

    const body = await req.json().catch(() => ({}));
    const userId = String((body as { user_id?: string }).user_id || "").trim();
    const returnPassword = Boolean((body as { return_password?: boolean }).return_password);
    const dualControlId = (body as { dual_control_id?: string }).dual_control_id;

    const { assertDualControl } = await import("@/lib/security/dual-control");
    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "identity.reset_password",
      actor_id: ctx.user.id,
      request_id: dualControlId,
    });
    if (!dc.ok) {
      return NextResponse.json({ error: dc.error, code: "DUAL_CONTROL_REQUIRED" }, { status: 403 });
    }

    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    // Prevent self-lock without intentional path — still allow self reset for admins
    const admin = createAdminClient();

    // Scope: target must be same company unless platform admin
    const { data: target } = await admin
      .from("user_profiles")
      .select("id,company_id,email,is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      !ctx.isPlatformAdmin &&
      String(target.company_id) !== ctx.companyId
    ) {
      return authError("Cannot reset users outside your company", 403);
    }

    // Never allow non-platform-admin to reset another platform admin
    if (target.is_platform_admin && !ctx.isPlatformAdmin) {
      return authError("Cannot reset a platform administrator", 403);
    }

    const tempPassword = generateTempPassword();

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    // Prefer not returning secrets; optional break-glass for same-session admin UX
    const payload: Record<string, unknown> = {
      ok: true,
      user_id: userId,
      must_change_password: true,
      message:
        "Password reset. Share the temporary password via a secure channel if return_password was requested.",
    };
    if (returnPassword && (ctx.isPlatformAdmin || ctx.permissions.includes("iam.manage"))) {
      payload.temp_password = tempPassword;
    }

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
