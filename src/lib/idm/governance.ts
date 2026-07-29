import { createClient } from "@/lib/supabase/client";
import { logIdmAudit } from "./service";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

async function nextNum(companyId: string, table: string, prefix: string) {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-${prefix}-${year}-${pad((count ?? 0) + 1)}`;
}

export async function registerDevice(input: {
  company_id: string;
  user_id: string;
  device_name: string;
  device_type?: string;
  os_name?: string;
  browser_name?: string;
  last_ip?: string;
  last_location?: string;
}) {
  const { data, error } = await sb()
    .from("idm_devices")
    .insert({
      company_id: input.company_id,
      user_id: input.user_id,
      device_name: input.device_name,
      device_type: input.device_type || "laptop",
      os_name: input.os_name,
      browser_name: input.browser_name,
      last_ip: input.last_ip,
      last_location: input.last_location,
      security_status: "trusted",
      last_activity_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function blockDevice(input: {
  device_id: string;
  actor_id?: string | null;
  reason?: string;
  company_id: string;
  user_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("idm_devices")
    .update({
      is_blocked: true,
      security_status: "blocked",
      blocked_at: new Date().toISOString(),
      blocked_by: input.actor_id,
      blocked_reason: input.reason || "Blocked by administrator",
    })
    .eq("id", input.device_id)
    .select("*")
    .single();
  if (error) throw error;

  // Terminate related sessions if linked
  await sb()
    .from("user_sessions")
    .update({
      is_active: false,
      is_blocked: true,
      revoked_at: new Date().toISOString(),
      revoked_by: input.actor_id,
    })
    .eq("device_id", input.device_id);

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: input.user_id,
    action: "block_device",
    details: input.reason || "Device blocked",
    metadata: { device_id: input.device_id },
  });
  return data;
}

export async function unblockDevice(deviceId: string) {
  const { data, error } = await sb()
    .from("idm_devices")
    .update({
      is_blocked: false,
      security_status: "trusted",
      blocked_at: null,
      blocked_reason: null,
    })
    .eq("id", deviceId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function terminateAllUserSessions(input: {
  user_id: string;
  actor_id?: string | null;
  company_id: string;
}) {
  const { error } = await sb()
    .from("user_sessions")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: input.actor_id,
    })
    .eq("user_id", input.user_id)
    .eq("is_active", true);
  if (error) throw error;

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: input.user_id,
    action: "terminate_sessions",
    details: "All active sessions terminated",
  });
}

export async function createApiAccount(input: {
  company_id: string;
  name: string;
  account_purpose?: string;
  description?: string;
  scopes?: string[];
  role_id?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
}): Promise<{ account: Record<string, unknown>; plain_key: string }> {
  const account_code = await nextNum(input.company_id, "idm_api_accounts", "API");
  const { data: account, error } = await sb()
    .from("idm_api_accounts")
    .insert({
      company_id: input.company_id,
      account_code,
      name: input.name,
      description: input.description,
      account_purpose: input.account_purpose || "integration",
      role_id: input.role_id,
      scopes: input.scopes || [],
      status: "active",
      expires_at: input.expires_at,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  const plain = `hdg_${cryptoRandom(32)}`;
  const prefix = plain.slice(0, 12);
  const hash = await sha256Hex(plain);

  await sb().from("idm_api_keys").insert({
    company_id: input.company_id,
    api_account_id: account.id,
    key_prefix: prefix,
    key_hash: hash,
    name: "primary",
    expires_at: input.expires_at,
    created_by: input.created_by,
    is_active: true,
  });

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "create_api_account",
    details: account_code,
  });

  return { account, plain_key: plain };
}

export async function revokeApiAccount(accountId: string, companyId: string, actorId?: string | null) {
  await sb()
    .from("idm_api_accounts")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", accountId);
  await sb()
    .from("idm_api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("api_account_id", accountId);
  await logIdmAudit({
    company_id: companyId,
    actor_id: actorId,
    action: "revoke_api_account",
    details: accountId,
  });
}

export async function createTempAccess(input: {
  company_id: string;
  user_id?: string | null;
  visitor_name?: string;
  visitor_email?: string;
  access_type?: string;
  role_id?: string | null;
  start_at: string;
  end_at: string;
  reason?: string;
  sponsor_user_id?: string | null;
  created_by?: string | null;
}) {
  const grant_number = await nextNum(input.company_id, "idm_temp_access", "TMP");
  const start = new Date(input.start_at).getTime();
  const end = new Date(input.end_at).getTime();
  const now = Date.now();
  const status = now >= start && now <= end ? "active" : now < start ? "scheduled" : "expired";

  const { data, error } = await sb()
    .from("idm_temp_access")
    .insert({
      company_id: input.company_id,
      grant_number,
      user_id: input.user_id,
      visitor_name: input.visitor_name,
      visitor_email: input.visitor_email,
      access_type: input.access_type || "contractor",
      role_id: input.role_id,
      start_at: input.start_at,
      end_at: input.end_at,
      status,
      reason: input.reason,
      sponsor_user_id: input.sponsor_user_id,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.user_id && status === "active" && input.role_id) {
    await sb().from("idm_user_roles").upsert(
      {
        company_id: input.company_id,
        user_id: input.user_id,
        role_id: input.role_id,
        is_primary: false,
        granted_by: input.created_by,
        expires_at: input.end_at,
      },
      { onConflict: "user_id,role_id" }
    );
    await sb()
      .from("user_profiles")
      .update({
        account_expires_at: input.end_at,
        account_status: "active",
        user_type: input.access_type === "auditor" ? "auditor" : "contractor",
      })
      .eq("id", input.user_id);
  }

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    target_user_id: input.user_id,
    action: "temp_access",
    details: grant_number,
  });
  return data;
}

export async function revokeTempAccess(grantId: string, companyId: string, actorId?: string | null) {
  const { data } = await sb()
    .from("idm_temp_access")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", grantId)
    .select("*")
    .single();

  if (data?.user_id) {
    await sb()
      .from("user_profiles")
      .update({ account_status: "disabled", is_active: false })
      .eq("id", data.user_id);
  }

  await logIdmAudit({
    company_id: companyId,
    actor_id: actorId,
    target_user_id: data?.user_id,
    action: "revoke_temp_access",
    details: String(data?.grant_number || grantId),
  });
  return data;
}

export async function logUserActivity(input: {
  company_id: string;
  user_id?: string | null;
  activity_type: string;
  module?: string;
  title: string;
  details?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}) {
  await sb().from("idm_user_activity").insert({
    company_id: input.company_id,
    user_id: input.user_id,
    activity_type: input.activity_type,
    module: input.module,
    title: input.title,
    details: input.details,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    metadata: input.metadata || {},
  });
}

export async function createAccessRequest(input: {
  company_id: string;
  user_id: string;
  request_type?: string;
  title: string;
  description?: string;
  requested_role_id?: string | null;
}) {
  const request_number = await nextNum(input.company_id, "idm_access_requests", "ACS");
  const { data, error } = await sb()
    .from("idm_access_requests")
    .insert({
      company_id: input.company_id,
      request_number,
      user_id: input.user_id,
      request_type: input.request_type || "role",
      title: input.title,
      description: input.description,
      requested_role_id: input.requested_role_id,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function reviewAccessRequest(input: {
  request_id: string;
  approved: boolean;
  reviewer_id: string;
  company_id: string;
}) {
  const { data: req } = await sb()
    .from("idm_access_requests")
    .select("*")
    .eq("id", input.request_id)
    .single();
  if (!req) throw new Error("Not found");

  const { data, error } = await sb()
    .from("idm_access_requests")
    .update({
      status: input.approved ? "approved" : "rejected",
      reviewed_by: input.reviewer_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.request_id)
    .select("*")
    .single();
  if (error) throw error;

  if (input.approved && req.requested_role_id) {
    await sb().from("idm_user_roles").upsert(
      {
        company_id: input.company_id,
        user_id: req.user_id,
        role_id: req.requested_role_id,
        is_primary: false,
        granted_by: input.reviewer_id,
      },
      { onConflict: "user_id,role_id" }
    );
  }
  return data;
}

export async function startOffboarding(input: {
  company_id: string;
  user_id: string;
  created_by?: string | null;
  notes?: string;
}) {
  const offboard_number = await nextNum(input.company_id, "idm_offboarding", "OFF");
  const { data, error } = await sb()
    .from("idm_offboarding")
    .insert({
      company_id: input.company_id,
      user_id: input.user_id,
      offboard_number,
      status: "initiated",
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeOffboarding(input: {
  offboard_id: string;
  company_id: string;
  actor_id?: string | null;
}) {
  const { data: job } = await sb()
    .from("idm_offboarding")
    .select("*")
    .eq("id", input.offboard_id)
    .single();
  if (!job) throw new Error("Offboarding not found");

  const userId = job.user_id as string;

  if (job.disable_account) {
    await sb()
      .from("user_profiles")
      .update({
        is_active: false,
        account_status: "disabled",
        lifecycle_status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }
  if (job.revoke_sessions) {
    await terminateAllUserSessions({
      user_id: userId,
      actor_id: input.actor_id,
      company_id: input.company_id,
    });
  }
  if (job.revoke_devices) {
    await sb()
      .from("idm_devices")
      .update({
        is_blocked: true,
        security_status: "blocked",
        blocked_at: new Date().toISOString(),
        blocked_reason: "Offboarding",
      })
      .eq("user_id", userId);
  }
  if (job.revoke_api_keys) {
    // Revoke API accounts owned by user
    const { data: apis } = await sb()
      .from("idm_api_accounts")
      .select("id")
      .eq("owner_user_id", userId);
    for (const a of apis || []) {
      await revokeApiAccount(a.id, input.company_id, input.actor_id);
    }
  }

  await sb()
    .from("idm_offboarding")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", input.offboard_id);

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: userId,
    action: "offboard",
    details: String(job.offboard_number),
  });

  await logUserActivity({
    company_id: input.company_id,
    user_id: userId,
    activity_type: "action",
    module: "identity",
    title: "Account offboarded",
    details: String(job.offboard_number),
  });
}

function cryptoRandom(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const arr = new Uint8Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  } else {
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // fallback non-crypto
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `fallback_${Math.abs(h).toString(16)}_${text.length}`;
}
