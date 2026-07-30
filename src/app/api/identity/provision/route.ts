import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, passwordExpiresAt, simpleHashHint } from "@/lib/idm/password";
import { requireApiAuth, authError } from "@/lib/security/api-auth";
import { clientIp, rateLimit } from "@/lib/api";

/**
 * Activate an approved IAM provision request.
 * Requires iam.manage. Company-scoped unless platform admin.
 * Temp password returned only when return_password=true (break-glass).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`idm-provision:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many provision attempts" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const auth = await requireApiAuth({
      permissions: ["iam.manage", "iam.provision", "users.manage"],
      allowPlatformAdmin: true,
      requireMfa: "privileged",
    });
    if ("response" in auth) return auth.response;
    const { ctx } = auth;

    const body = await req.json().catch(() => ({}));
    const requestId = String((body as { request_id?: string }).request_id || "").trim();
    const returnPassword = Boolean((body as { return_password?: boolean }).return_password);
    const dualControlId = (body as { dual_control_id?: string }).dual_control_id;

    const { assertDualControl } = await import("@/lib/security/dual-control");
    const dc = await assertDualControl({
      company_id: ctx.companyId,
      action: "identity.provision",
      actor_id: ctx.user.id,
      request_id: dualControlId,
    });
    if (!dc.ok) {
      return NextResponse.json({ error: dc.error, code: "DUAL_CONTROL_REQUIRED" }, { status: 403 });
    }

    if (!requestId) {
      return NextResponse.json({ error: "request_id required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: reqRow, error: fetchErr } = await admin
      .from("idm_provision_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !reqRow) {
      return NextResponse.json({ error: "Provision request not found" }, { status: 404 });
    }

    if (
      !ctx.isPlatformAdmin &&
      String(reqRow.company_id) !== ctx.companyId
    ) {
      return authError("Provision request is outside your company", 403);
    }

    if (reqRow.status === "activated") {
      return NextResponse.json({ error: "Already activated" }, { status: 400 });
    }
    if (reqRow.status === "rejected" || reqRow.status === "cancelled") {
      return NextResponse.json({ error: `Cannot activate status ${reqRow.status}` }, { status: 400 });
    }

    // Require approved states for non-platform-admins
    const approved = ["admin_approved", "security_review", "manager_approved", "pending"];
    if (!ctx.isPlatformAdmin && !approved.includes(String(reqRow.status))) {
      return NextResponse.json(
        { error: `Request status ${reqRow.status} cannot be activated` },
        { status: 400 }
      );
    }

    const email = String(reqRow.email).toLowerCase().trim();
    const tempPassword = generateTempPassword();

    // Prefer getUserByEmail when available; fallback to createUser conflict handling
    let userId: string | undefined;
    try {
      const { data: byEmail } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      // Avoid full 1000-user dump — try create and catch duplicate
      void byEmail;
    } catch {
      /* ignore */
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: reqRow.first_name,
        last_name: reqRow.last_name,
        provisioned: true,
      },
    });

    if (createErr) {
      // Existing user — update password instead of listing all users
      const msg = createErr.message || "";
      if (/already|exists|registered/i.test(msg)) {
        // Lookup via profiles first
        const { data: existingProfile } = await admin
          .from("user_profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (existingProfile?.id) {
          const existingId = String(existingProfile.id);
          userId = existingId;
          await admin.auth.admin.updateUserById(existingId, {
            password: tempPassword,
            email_confirm: true,
          });
        } else {
          return NextResponse.json(
            { error: "User exists in Auth but has no profile; resolve manually" },
            { status: 409 }
          );
        }
      } else {
        return NextResponse.json(
          { error: createErr.message || "Auth user creation failed" },
          { status: 500 }
        );
      }
    } else {
      userId = created.user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Failed to resolve user id" }, { status: 500 });
    }

    let roleId = reqRow.role_id as string | null;
    if (!roleId) {
      const { data: defaultRole } = await admin
        .from("roles")
        .select("id")
        .eq("slug", "employee")
        .maybeSingle();
      if (!defaultRole) {
        const { data: anyRole } = await admin.from("roles").select("id").limit(1).maybeSingle();
        roleId = anyRole?.id || null;
      } else {
        roleId = defaultRole.id;
      }
    }

    if (!roleId) {
      return NextResponse.json({ error: "No role available for assignment" }, { status: 500 });
    }

    const payload = (reqRow.payload || {}) as Record<string, unknown>;
    const { data: policy } = await admin
      .from("security_policies")
      .select("*")
      .eq("company_id", reqRow.company_id)
      .maybeSingle();

    const { data: mfaPolicy } = await admin
      .from("idm_mfa_policies")
      .select("*")
      .eq("company_id", reqRow.company_id)
      .maybeSingle();

    const userType = reqRow.user_type || "employee";
    const requireMfa =
      Boolean(payload.require_mfa) ||
      userType === "administrator" ||
      (mfaPolicy?.require_admins && userType === "administrator") ||
      (mfaPolicy?.require_finance &&
        String(reqRow.department || "").toLowerCase().includes("finance")) ||
      Boolean(mfaPolicy?.require_all_employees);

    const profilePayload = {
      id: userId,
      company_id: reqRow.company_id,
      role_id: roleId,
      first_name: reqRow.first_name,
      last_name: reqRow.last_name,
      email,
      phone: reqRow.phone,
      username: reqRow.username,
      employee_id: reqRow.employee_id,
      employee_record_id: reqRow.employee_record_id,
      job_title: reqRow.job_title,
      user_type: userType,
      user_kind: mapUserKind(userType),
      division: reqRow.division,
      team_name: reqRow.team_name,
      location_name: reqRow.location_name,
      cost_center: reqRow.cost_center,
      account_status: "active",
      lifecycle_status: "active",
      is_active: true,
      provisioned_from: reqRow.source || "manual",
      data_scope: (payload.data_scope as string) || "company",
      require_mfa: requireMfa,
      mfa_enforced: requireMfa,
      must_change_password: policy?.force_reset_on_first_login !== false,
      temp_password_set: true,
      password_changed_at: new Date().toISOString(),
      password_expires_at: passwordExpiresAt({
        password_expiry_days: Number(policy?.password_expiry_days ?? 90),
      }).toISOString(),
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: profileErr } = await admin.from("user_profiles").upsert(profilePayload, {
      onConflict: "id",
    });
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const roleIds: string[] =
      Array.isArray(reqRow.role_ids) && reqRow.role_ids.length
        ? reqRow.role_ids
        : [roleId];
    for (const rid of roleIds) {
      await admin.from("idm_user_roles").upsert(
        {
          company_id: reqRow.company_id,
          user_id: userId,
          role_id: rid,
          is_primary: rid === roleId,
          granted_by: ctx.user.id,
        },
        { onConflict: "user_id,role_id" }
      );
    }

    await admin.from("idm_password_history").insert({
      company_id: reqRow.company_id,
      user_id: userId,
      password_hash: simpleHashHint(tempPassword),
    });

    if (reqRow.employee_record_id) {
      await admin
        .from("employees")
        .update({ user_id: userId, email, updated_at: new Date().toISOString() })
        .eq("id", reqRow.employee_record_id);
    }

    await admin
      .from("idm_provision_requests")
      .update({
        status: "activated",
        provisioned_user_id: userId,
        temp_password_hint: "issued",
        updated_at: new Date().toISOString(),
        admin_approved_by: ctx.user.id,
        admin_approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    await admin.from("idm_audit").insert({
      company_id: reqRow.company_id,
      actor_id: ctx.user.id,
      target_user_id: userId,
      action: "provision",
      details: `Activated ${reqRow.request_number} for ${email}`,
      metadata: { request_id: requestId, source: reqRow.source },
    });

    const result: Record<string, unknown> = {
      ok: true,
      user_id: userId,
      email,
      username: reqRow.username,
      must_change_password: true,
    };
    if (returnPassword) {
      result.temp_password = tempPassword;
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}

function mapUserKind(userType: string): string {
  switch (userType) {
    case "customer":
      return "external_customer";
    case "supplier":
      return "external_supplier";
    case "contractor":
      return "external_contractor";
    case "partner":
      return "external_partner";
    case "auditor":
      return "external_auditor";
    case "guest":
      return "external_partner";
    default:
      return "internal";
  }
}
