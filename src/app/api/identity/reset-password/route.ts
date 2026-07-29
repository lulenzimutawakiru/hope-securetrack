import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword, simpleHashHint } from "@/lib/idm/password";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.user_id as string;
    const actorId = body.actor_id as string | undefined;
    const companyId = body.company_id as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }

    const admin = createAdminClient();
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
      company_id: companyId || null,
      user_id: userId,
      password_hash: simpleHashHint(tempPassword),
    });

    await admin.from("idm_password_resets").insert({
      company_id: companyId || null,
      user_id: userId,
      token_hash: simpleHashHint(`${userId}-${Date.now()}`),
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
      forced: true,
      created_by: actorId || null,
    });

    await admin.from("idm_audit").insert({
      company_id: companyId || null,
      actor_id: actorId || null,
      target_user_id: userId,
      action: "reset_password",
      details: "Forced password reset with temporary password",
    });

    return NextResponse.json({ temp_password: tempPassword, user_id: userId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
