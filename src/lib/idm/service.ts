import { createClient } from "@/lib/supabase/client";
import { generateUsername, ensureUniqueUsername } from "./username";
import { generateTempPassword, passwordExpiresAt, simpleHashHint, validatePassword } from "./password";
import type { BulkUserRow, PasswordPolicy, ProvisionInput } from "./types";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextProvisionNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("idm_provision_requests")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-IDM-${year}-${pad((count ?? 0) + 1)}`;
}

export async function nextImportBatch(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("idm_import_batches")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-IMP-${year}-${pad((count ?? 0) + 1)}`;
}

export async function logIdmAudit(input: {
  company_id: string;
  actor_id?: string | null;
  target_user_id?: string | null;
  action: string;
  details?: string;
  metadata?: Record<string, unknown>;
}) {
  await sb().from("idm_audit").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: input.target_user_id,
    action: input.action,
    details: input.details,
    metadata: input.metadata || {},
  });
}

export async function getPasswordPolicy(companyId: string): Promise<PasswordPolicy> {
  const { data } = await sb()
    .from("security_policies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return {
    min_password_length: Number(data?.min_password_length ?? 10),
    require_uppercase: data?.require_uppercase !== false,
    require_number: data?.require_number !== false,
    require_special: data?.require_special !== false,
    password_history_count: Number(data?.password_history_count ?? 5),
    password_expiry_days: Number(data?.password_expiry_days ?? 90),
    max_failed_logins: Number(data?.max_failed_logins ?? 5),
    lockout_minutes: Number(data?.lockout_minutes ?? 30),
    force_reset_on_first_login: data?.force_reset_on_first_login !== false,
    temp_password_hours: Number(data?.temp_password_hours ?? 48),
  };
}

export async function resolveUsername(
  companyId: string,
  input: {
    first_name: string;
    last_name: string;
    email?: string | null;
    employee_id?: string | null;
    department?: string | null;
    pattern?: string;
  }
): Promise<string> {
  let pattern = input.pattern;
  if (!pattern) {
    const { data: rule } = await sb()
      .from("idm_username_rules")
      .select("pattern")
      .eq("company_id", companyId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    pattern = rule?.pattern || "firstname.lastname";
  }

  const base = generateUsername({
    pattern: pattern!,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    employee_id: input.employee_id,
    department: input.department,
  });

  const { data: existing } = await sb()
    .from("user_profiles")
    .select("username")
    .eq("company_id", companyId)
    .not("username", "is", null)
    .limit(2000);

  const set = new Set(
    (existing || []).map((r) => String(r.username || "").toLowerCase()).filter(Boolean)
  );
  return ensureUniqueUsername(base, set);
}

export async function createProvisionRequest(input: {
  company_id: string;
  data: ProvisionInput;
  requested_by?: string | null;
  require_approval?: boolean;
}) {
  const request_number = await nextProvisionNumber(input.company_id);
  const username =
    input.data.username ||
    (await resolveUsername(input.company_id, {
      first_name: input.data.first_name,
      last_name: input.data.last_name,
      email: input.data.email,
      employee_id: input.data.employee_id,
      department: input.data.department,
    }));

  const requireApproval = input.require_approval !== false;
  const status = requireApproval ? "pending" : "admin_approved";

  const { data, error } = await sb()
    .from("idm_provision_requests")
    .insert({
      company_id: input.company_id,
      request_number,
      source: input.data.source || "manual",
      status,
      first_name: input.data.first_name,
      last_name: input.data.last_name,
      email: input.data.email.toLowerCase().trim(),
      phone: input.data.phone,
      username,
      user_type: input.data.user_type || "employee",
      employee_id: input.data.employee_id,
      employee_record_id: input.data.employee_record_id,
      department: input.data.department,
      division: input.data.division,
      team_name: input.data.team_name,
      branch_name: input.data.branch_name,
      location_name: input.data.location_name,
      cost_center: input.data.cost_center,
      job_title: input.data.job_title,
      role_id: input.data.role_id,
      role_ids: input.data.role_ids || (input.data.role_id ? [input.data.role_id] : []),
      manager_user_id: input.data.manager_user_id,
      requested_by: input.requested_by,
      payload: {
        data_scope: input.data.data_scope || "company",
        require_mfa: input.data.require_mfa || false,
        send_invite: input.data.send_invite !== false,
      },
      admin_approved_at: requireApproval ? null : new Date().toISOString(),
      admin_approved_by: requireApproval ? null : input.requested_by,
    })
    .select("*")
    .single();

  if (error) throw error;

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.requested_by,
    action: "provision_request",
    details: `Request ${request_number} for ${input.data.email}`,
    metadata: { request_id: data.id, status },
  });

  return data;
}

export async function advanceProvisionApproval(input: {
  request_id: string;
  actor_id: string;
  step: "manager" | "security" | "admin" | "reject";
  reason?: string;
}) {
  const { data: req, error: fetchErr } = await sb()
    .from("idm_provision_requests")
    .select("*")
    .eq("id", input.request_id)
    .single();
  if (fetchErr || !req) throw fetchErr || new Error("Request not found");

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = { updated_at: now };

  if (input.step === "reject") {
    patch = {
      ...patch,
      status: "rejected",
      rejected_by: input.actor_id,
      rejected_at: now,
      rejection_reason: input.reason,
    };
  } else if (input.step === "manager") {
    patch = {
      ...patch,
      status: "security_review",
      manager_approved_by: input.actor_id,
      manager_approved_at: now,
    };
  } else if (input.step === "security") {
    patch = {
      ...patch,
      status: "admin_approved",
      security_reviewed_by: input.actor_id,
      security_reviewed_at: now,
    };
  } else if (input.step === "admin") {
    patch = {
      ...patch,
      status: "admin_approved",
      admin_approved_by: input.actor_id,
      admin_approved_at: now,
    };
  }

  const { data, error } = await sb()
    .from("idm_provision_requests")
    .update(patch)
    .eq("id", input.request_id)
    .select("*")
    .single();
  if (error) throw error;

  await logIdmAudit({
    company_id: req.company_id,
    actor_id: input.actor_id,
    action: input.step === "reject" ? "provision_reject" : `provision_${input.step}`,
    details: `${req.request_number} → ${data.status}`,
  });

  return data;
}

/**
 * Activate approved request via API route (service role creates auth user).
 */
export async function activateProvisionRequest(
  requestId: string,
  actorId: string
): Promise<{ user_id: string; temp_password?: string; email: string }> {
  const res = await fetch("/api/identity/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId, actor_id: actorId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Provisioning failed");
  return json;
}

export async function updateAccountStatus(input: {
  user_id: string;
  company_id: string;
  account_status: string;
  actor_id?: string | null;
  reason?: string;
}) {
  const is_active = input.account_status === "active";
  const patch: Record<string, unknown> = {
    account_status: input.account_status,
    is_active,
    lifecycle_status:
      input.account_status === "active"
        ? "active"
        : input.account_status === "suspended"
          ? "suspended"
          : input.account_status === "disabled"
            ? "archived"
            : "active",
    updated_at: new Date().toISOString(),
  };
  if (input.account_status === "locked") {
    patch.locked_until = new Date(Date.now() + 30 * 60_000).toISOString();
  }
  if (input.account_status === "active") {
    patch.locked_until = null;
    patch.failed_login_count = 0;
  }

  const { data, error } = await sb()
    .from("user_profiles")
    .update(patch)
    .eq("id", input.user_id)
    .select("*")
    .single();
  if (error) throw error;

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: input.user_id,
    action: input.account_status,
    details: input.reason || `Status → ${input.account_status}`,
  });

  return data;
}

export async function assignRoles(input: {
  company_id: string;
  user_id: string;
  role_ids: string[];
  primary_role_id?: string | null;
  actor_id?: string | null;
}) {
  // Remove existing multi-roles not in list
  const { data: current } = await sb()
    .from("idm_user_roles")
    .select("id,role_id")
    .eq("user_id", input.user_id);

  const keep = new Set(input.role_ids);
  for (const row of current || []) {
    if (!keep.has(row.role_id)) {
      await sb().from("idm_user_roles").delete().eq("id", row.id);
    }
  }

  const primary = input.primary_role_id || input.role_ids[0];
  for (const roleId of input.role_ids) {
    await sb().from("idm_user_roles").upsert(
      {
        company_id: input.company_id,
        user_id: input.user_id,
        role_id: roleId,
        is_primary: roleId === primary,
        granted_by: input.actor_id,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,role_id" }
    );
  }

  if (primary) {
    const { data: before } = await sb()
      .from("user_profiles")
      .select("role_id")
      .eq("id", input.user_id)
      .single();
    await sb()
      .from("user_profiles")
      .update({ role_id: primary, updated_at: new Date().toISOString() })
      .eq("id", input.user_id);
    if (before && before.role_id !== primary) {
      await sb().from("user_role_changes").insert({
        company_id: input.company_id,
        user_id: input.user_id,
        old_role_id: before.role_id,
        new_role_id: primary,
        changed_by: input.actor_id,
        reason: "Multi-role assignment",
      });
    }
  }

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    target_user_id: input.user_id,
    action: "assign_role",
    details: `Roles: ${input.role_ids.join(",")}`,
  });
}

export async function forcePasswordReset(input: {
  company_id: string;
  user_id: string;
  actor_id?: string | null;
}): Promise<{ temp_password: string }> {
  const res = await fetch("/api/identity/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: input.user_id,
      actor_id: input.actor_id,
      company_id: input.company_id,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Reset failed");
  return json;
}

export async function createCustomRole(input: {
  company_id: string;
  name: string;
  slug: string;
  description?: string;
  permission_ids: string[];
  data_scope_default?: string;
  created_by?: string | null;
}) {
  const { data: role, error } = await sb()
    .from("roles")
    .insert({
      company_id: input.company_id,
      name: input.name,
      slug: input.slug.toLowerCase().replace(/\s+/g, "_"),
      description: input.description,
      is_system: false,
      is_active: true,
      role_category: "custom",
      data_scope_default: input.data_scope_default || "company",
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.permission_ids.length) {
    await sb().from("role_permissions").insert(
      input.permission_ids.map((permission_id) => ({
        role_id: role.id,
        permission_id,
      }))
    );
  }

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "create_role",
    details: `Role ${role.slug}`,
  });

  return role;
}

export async function parseBulkCsv(csv: string): Promise<BulkUserRow[]> {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const rows: BulkUserRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || [];
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] || "";
    });
    if (!obj.email && !obj.first_name) continue;
    rows.push({
      first_name: obj.first_name || obj.firstname || "",
      last_name: obj.last_name || obj.lastname || "",
      email: obj.email || "",
      phone: obj.phone,
      department: obj.department,
      job_title: obj.job_title || obj.title,
      employee_id: obj.employee_id || obj.employeeid,
      role_slug: obj.role_slug || obj.role,
      user_type: obj.user_type || obj.type || "employee",
    });
  }
  return rows;
}

export async function runBulkImport(input: {
  company_id: string;
  rows: BulkUserRow[];
  actor_id?: string | null;
  file_name?: string;
  auto_activate?: boolean;
}) {
  const batch_number = await nextImportBatch(input.company_id);
  const { data: batch } = await sb()
    .from("idm_import_batches")
    .insert({
      company_id: input.company_id,
      batch_number,
      file_name: input.file_name || "import.csv",
      total_rows: input.rows.length,
      status: "processing",
      created_by: input.actor_id,
    })
    .select("*")
    .single();

  const { data: roles } = await sb().from("roles").select("id,slug");
  const roleMap = new Map((roles || []).map((r) => [r.slug, r.id]));

  let success = 0;
  let failed = 0;
  const errors: Array<{ row: number; email: string; error: string }> = [];

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    try {
      if (!row.email || !row.first_name || !row.last_name) {
        throw new Error("Missing required fields");
      }
      const roleId = row.role_slug ? roleMap.get(row.role_slug) : undefined;
      await createProvisionRequest({
        company_id: input.company_id,
        requested_by: input.actor_id,
        require_approval: !input.auto_activate,
        data: {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          job_title: row.job_title,
          employee_id: row.employee_id,
          user_type: row.user_type || "employee",
          role_id: roleId || null,
          source: "bulk",
        },
      });
      success += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        row: i + 2,
        email: row.email,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  if (batch) {
    await sb()
      .from("idm_import_batches")
      .update({
        success_rows: success,
        failed_rows: failed,
        status: failed === 0 ? "completed" : success === 0 ? "failed" : "partial",
        errors,
      })
      .eq("id", batch.id);
  }

  await logIdmAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "import",
    details: `Batch ${batch_number}: ${success} ok, ${failed} failed`,
  });

  return { batch_number, success, failed, errors };
}

/**
 * HR onboarding automation — create provision request from employee record.
 */
export async function onboardEmployeeToUser(input: {
  company_id: string;
  employee_id: string;
  role_id?: string | null;
  actor_id?: string | null;
  skip_approval?: boolean;
}) {
  const { data: emp } = await sb().from("employees").select("*").eq("id", input.employee_id).single();
  if (!emp) throw new Error("Employee not found");
  if (!emp.email) throw new Error("Employee has no email");

  const req = await createProvisionRequest({
    company_id: input.company_id,
    requested_by: input.actor_id,
    require_approval: !input.skip_approval,
    data: {
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      employee_id: emp.employee_number,
      employee_record_id: emp.id,
      department: emp.department,
      job_title: emp.job_title,
      user_type: "employee",
      role_id: input.role_id,
      source: "hr_onboarding",
    },
  });

  return req;
}

export function checkPassword(password: string, policy?: Partial<PasswordPolicy>) {
  return validatePassword(password, policy);
}

export function makeTempPassword() {
  return generateTempPassword();
}

export { passwordExpiresAt, simpleHashHint };
