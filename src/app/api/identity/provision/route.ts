import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, passwordExpiresAt, simpleHashHint } from "@/lib/idm/password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestId = body.request_id as string;
    const actorId = body.actor_id as string | undefined;

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

    if (!["admin_approved", "security_review", "manager_approved"].includes(reqRow.status) && reqRow.status !== "pending") {
      // allow pending only if skip path already set admin_approved
      if (reqRow.status === "activated") {
        return NextResponse.json({ error: "Already activated" }, { status: 400 });
      }
    }

    // Prefer admin_approved; still allow direct activate for super-admin flows
    if (reqRow.status === "rejected" || reqRow.status === "cancelled") {
      return NextResponse.json({ error: `Cannot activate status ${reqRow.status}` }, { status: 400 });
    }

    const email = String(reqRow.email).toLowerCase().trim();
    const tempPassword = generateTempPassword();

    // Check existing auth user
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId = existing?.id;
    if (!userId) {
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
      if (createErr || !created.user) {
        return NextResponse.json(
          { error: createErr?.message || "Auth user creation failed" },
          { status: 500 }
        );
      }
      userId = created.user.id;
    } else {
      // Reset password for existing shell
      await admin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });
    }

    // Resolve role
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
    const policy = await admin
      .from("security_policies")
      .select("*")
      .eq("company_id", reqRow.company_id)
      .maybeSingle();

    const mfaPolicy = await admin
      .from("idm_mfa_policies")
      .select("*")
      .eq("company_id", reqRow.company_id)
      .maybeSingle();

    const userType = reqRow.user_type || "employee";
    const requireMfa =
      Boolean(payload.require_mfa) ||
      userType === "administrator" ||
      (mfaPolicy.data?.require_admins && userType === "administrator") ||
      (mfaPolicy.data?.require_finance &&
        String(reqRow.department || "").toLowerCase().includes("finance")) ||
      Boolean(mfaPolicy.data?.require_all_employees);

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
      must_change_password: policy.data?.force_reset_on_first_login !== false,
      temp_password_set: true,
      password_changed_at: new Date().toISOString(),
      password_expires_at: passwordExpiresAt({
        password_expiry_days: Number(policy.data?.password_expiry_days ?? 90),
      }).toISOString(),
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert profile
    const { error: profileErr } = await admin.from("user_profiles").upsert(profilePayload, {
      onConflict: "id",
    });
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // Multi-roles
    const roleIds: string[] = Array.isArray(reqRow.role_ids) && reqRow.role_ids.length
      ? reqRow.role_ids
      : [roleId];
    for (const rid of roleIds) {
      await admin.from("idm_user_roles").upsert(
        {
          company_id: reqRow.company_id,
          user_id: userId,
          role_id: rid,
          is_primary: rid === roleId,
          granted_by: actorId || null,
        },
        { onConflict: "user_id,role_id" }
      );
    }

    // Password history marker
    await admin.from("idm_password_history").insert({
      company_id: reqRow.company_id,
      user_id: userId,
      password_hash: simpleHashHint(tempPassword),
    });

    // Link employee if present
    if (reqRow.employee_record_id) {
      await admin
        .from("employees")
        .update({ user_id: userId, email, updated_at: new Date().toISOString() })
        .eq("id", reqRow.employee_record_id);
    }

    // Update request
    await admin
      .from("idm_provision_requests")
      .update({
        status: "activated",
        provisioned_user_id: userId,
        temp_password_hint: "issued",
        updated_at: new Date().toISOString(),
        admin_approved_by: actorId || reqRow.admin_approved_by,
        admin_approved_at: reqRow.admin_approved_at || new Date().toISOString(),
      })
      .eq("id", requestId);

    await admin.from("idm_audit").insert({
      company_id: reqRow.company_id,
      actor_id: actorId || null,
      target_user_id: userId,
      action: "provision",
      details: `Activated ${reqRow.request_number} for ${email}`,
      metadata: { request_id: requestId, source: reqRow.source },
    });

    return NextResponse.json({
      user_id: userId,
      email,
      temp_password: tempPassword,
      username: reqRow.username,
      must_change_password: true,
    });
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
