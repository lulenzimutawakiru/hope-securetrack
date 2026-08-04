import { createClient } from "@/lib/supabase/crud-compat";
import { calculateProfileCompletion, type CompletionContext } from "./completion";
import type { EmployeeProfile } from "./types";

function sb() {
  return createClient();
}

function pad(n: number, w = 5) {
  return String(n).padStart(w, "0");
}

export async function nextRequestNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("profile_requests")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-PRF-${year}-${pad((count ?? 0) + 1)}`;
}

export async function logProfileAudit(input: {
  company_id: string;
  employee_id?: string | null;
  actor_id?: string | null;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
}) {
  await sb().from("profile_audit").insert({
    company_id: input.company_id,
    employee_id: input.employee_id,
    actor_id: input.actor_id,
    action: input.action,
    field_name: input.field_name,
    old_value: input.old_value,
    new_value: input.new_value,
  });
}

export async function refreshCompletion(
  employeeId: string,
  companyId: string
): Promise<{ pct: number; missing: string[]; completed: string[] }> {
  const { data: emp } = await sb().from("employees").select("*").eq("id", employeeId).single();
  if (!emp) throw new Error("Employee not found");

  const [{ count: skillCount }, { count: certCount }, { count: docCount }] = await Promise.all([
    sb().from("profile_skills").select("*", { count: "exact", head: true }).eq("employee_id", employeeId),
    sb().from("profile_certifications").select("*", { count: "exact", head: true }).eq("employee_id", employeeId),
    sb()
      .from("profile_documents")
      .select("*", { count: "exact", head: true })
      .eq("employee_id", employeeId)
      .is("deleted_at", null),
  ]);

  const ctx: CompletionContext = {
    skillCount: skillCount ?? 0,
    certCount: certCount ?? 0,
    docCount: docCount ?? 0,
  };
  const result = calculateProfileCompletion(emp as EmployeeProfile, ctx);

  await sb()
    .from("employees")
    .update({ profile_completion_pct: result.pct, updated_at: new Date().toISOString() })
    .eq("id", employeeId);

  await sb().from("profile_completion").upsert(
    {
      company_id: companyId,
      employee_id: employeeId,
      completion_pct: result.pct,
      missing_fields: result.missing,
      completed_fields: result.completed,
      last_calculated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id" }
  );

  return { pct: result.pct, missing: result.missing, completed: result.completed };
}

export async function createEmployeeProfile(input: {
  company_id: string;
  first_name: string;
  last_name: string;
  employee_number?: string;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  job_title?: string | null;
  employment_type?: string;
  hire_date?: string | null;
  user_id?: string | null;
  manager_employee_id?: string | null;
  created_by?: string | null;
}) {
  const num =
    input.employee_number ||
    (await (async () => {
      const { count } = await sb()
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("company_id", input.company_id);
      return `HDG-EMP-${pad((count ?? 0) + 1, 4)}`;
    })());

  const { data, error } = await sb()
    .from("employees")
    .insert({
      company_id: input.company_id,
      employee_number: num,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      department: input.department,
      job_title: input.job_title,
      employment_type: input.employment_type || "permanent",
      hire_date: input.hire_date || new Date().toISOString().slice(0, 10),
      user_id: input.user_id,
      manager_employee_id: input.manager_employee_id,
      status: "active",
      profile_completion_pct: 0,
    })
    .select("*")
    .single();

  if (error) throw error;

  await sb().from("profile_timeline").insert({
    company_id: input.company_id,
    employee_id: data.id,
    event_type: "joined",
    title: "Joined Company",
    description: `${input.job_title || "Employee"} · ${input.department || "General"}`,
    event_date: input.hire_date || new Date().toISOString().slice(0, 10),
    created_by: input.created_by,
  });

  const groups = [
    "personal",
    "contact",
    "employment",
    "skills",
    "documents",
    "performance",
    "public_bio",
  ];
  await sb().from("profile_visibility").insert(
    groups.map((field_group) => ({
      company_id: input.company_id,
      employee_id: data.id,
      field_group,
      visibility: field_group === "personal" || field_group === "documents" ? "hr" : "department",
    }))
  );

  await sb().from("profile_consents").insert([
    {
      company_id: input.company_id,
      employee_id: data.id,
      consent_type: "data_processing",
      granted: true,
      granted_at: new Date().toISOString(),
    },
    {
      company_id: input.company_id,
      employee_id: data.id,
      consent_type: "photo_use",
      granted: false,
    },
  ]);

  await refreshCompletion(data.id, input.company_id);
  await logProfileAudit({
    company_id: input.company_id,
    employee_id: data.id,
    actor_id: input.created_by,
    action: "create",
  });

  return data;
}

export async function updateEmployeeProfile(
  employeeId: string,
  companyId: string,
  patch: Record<string, unknown>,
  actorId?: string | null
) {
  const { data: before } = await sb().from("employees").select("*").eq("id", employeeId).single();
  const { data, error } = await sb()
    .from("employees")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", employeeId)
    .select("*")
    .single();
  if (error) throw error;

  // Timeline for key changes
  if (before && patch.department && patch.department !== before.department) {
    await sb().from("profile_timeline").insert({
      company_id: companyId,
      employee_id: employeeId,
      event_type: "department_change",
      title: "Department Change",
      from_value: before.department,
      to_value: String(patch.department),
      event_date: new Date().toISOString().slice(0, 10),
      created_by: actorId,
    });
  }
  if (before && patch.job_title && patch.job_title !== before.job_title) {
    await sb().from("profile_timeline").insert({
      company_id: companyId,
      employee_id: employeeId,
      event_type: "role_change",
      title: "Role Change",
      from_value: before.job_title,
      to_value: String(patch.job_title),
      event_date: new Date().toISOString().slice(0, 10),
      created_by: actorId,
    });
  }

  await refreshCompletion(employeeId, companyId);
  await logProfileAudit({
    company_id: companyId,
    employee_id: employeeId,
    actor_id: actorId,
    action: "update",
    new_value: JSON.stringify(Object.keys(patch)),
  });

  return data;
}

export async function softDeleteProfile(employeeId: string, companyId: string, actorId?: string | null) {
  const { error } = await sb()
    .from("employees")
    .update({
      deleted_at: new Date().toISOString(),
      status: "terminated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);
  if (error) throw error;
  await logProfileAudit({
    company_id: companyId,
    employee_id: employeeId,
    actor_id: actorId,
    action: "delete",
  });
}

export async function restoreProfile(employeeId: string, companyId: string, actorId?: string | null) {
  const { error } = await sb()
    .from("employees")
    .update({
      deleted_at: null,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);
  if (error) throw error;
  await logProfileAudit({
    company_id: companyId,
    employee_id: employeeId,
    actor_id: actorId,
    action: "restore",
  });
}

export async function addTimelineEvent(input: {
  company_id: string;
  employee_id: string;
  event_type: string;
  title: string;
  description?: string | null;
  event_date?: string;
  from_value?: string | null;
  to_value?: string | null;
  created_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("profile_timeline")
    .insert({
      company_id: input.company_id,
      employee_id: input.employee_id,
      event_type: input.event_type,
      title: input.title,
      description: input.description,
      event_date: input.event_date || new Date().toISOString().slice(0, 10),
      from_value: input.from_value,
      to_value: input.to_value,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addDocument(input: {
  company_id: string;
  employee_id: string;
  doc_type: string;
  title: string;
  file_name?: string | null;
  file_url?: string | null;
  expires_on?: string | null;
  issued_on?: string | null;
  uploaded_by?: string | null;
  status?: string;
}) {
  const { data, error } = await sb()
    .from("profile_documents")
    .insert({
      company_id: input.company_id,
      employee_id: input.employee_id,
      doc_type: input.doc_type,
      title: input.title,
      file_name: input.file_name,
      file_url: input.file_url,
      expires_on: input.expires_on,
      issued_on: input.issued_on,
      uploaded_by: input.uploaded_by,
      status: input.status || "pending_approval",
      version: 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  await refreshCompletion(input.employee_id, input.company_id);
  return data;
}

export async function addSkill(input: {
  company_id: string;
  employee_id: string;
  skill_name: string;
  skill_category?: string;
  level_label?: string;
  level_score?: number;
  years_experience?: number;
  certified?: boolean;
}) {
  const { data, error } = await sb()
    .from("profile_skills")
    .upsert(
      {
        company_id: input.company_id,
        employee_id: input.employee_id,
        skill_name: input.skill_name,
        skill_category: input.skill_category || "technical",
        level_label: input.level_label || "intermediate",
        level_score: input.level_score ?? 3,
        years_experience: input.years_experience ?? 0,
        certified: input.certified ?? false,
      },
      { onConflict: "employee_id,skill_name,skill_category" }
    )
    .select("*")
    .single();
  if (error) throw error;
  await refreshCompletion(input.employee_id, input.company_id);
  return data;
}

export async function addCertification(input: {
  company_id: string;
  employee_id: string;
  certificate_name: string;
  issuing_org?: string | null;
  certificate_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  verification_url?: string | null;
}) {
  const { data, error } = await sb()
    .from("profile_certifications")
    .insert({
      company_id: input.company_id,
      employee_id: input.employee_id,
      certificate_name: input.certificate_name,
      issuing_org: input.issuing_org,
      certificate_number: input.certificate_number,
      issue_date: input.issue_date,
      expiry_date: input.expiry_date,
      verification_url: input.verification_url,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  await refreshCompletion(input.employee_id, input.company_id);
  return data;
}

export async function createProfileRequest(input: {
  company_id: string;
  employee_id: string;
  request_type: string;
  title: string;
  description?: string | null;
  payload?: Record<string, unknown>;
}) {
  const request_number = await nextRequestNumber(input.company_id);
  const { data, error } = await sb()
    .from("profile_requests")
    .insert({
      company_id: input.company_id,
      employee_id: input.employee_id,
      request_number,
      request_type: input.request_type,
      title: input.title,
      description: input.description,
      payload: input.payload || {},
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function approveProfileRequest(
  requestId: string,
  actorId: string,
  approved: boolean,
  notes?: string
) {
  const { data: req, error: fetchErr } = await sb()
    .from("profile_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchErr) throw fetchErr;

  const { data, error } = await sb()
    .from("profile_requests")
    .update({
      status: approved ? "approved" : "rejected",
      approved_by: actorId,
      approved_at: new Date().toISOString(),
      resolution_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw error;

  // Apply profile_update payload
  if (approved && req.request_type === "profile_update" && req.payload) {
    const payload = req.payload as Record<string, unknown>;
    if (Object.keys(payload).length) {
      await updateEmployeeProfile(req.employee_id, req.company_id, payload, actorId);
    }
  }

  return data;
}

export async function loadProfile360(employeeId: string) {
  const supabase = sb();
  const [
    { data: employee },
    { data: timeline },
    { data: documents },
    { data: skills },
    { data: certs },
    { data: projects },
    { data: assets },
    { data: attendance },
    { data: leave },
    { data: reviews },
    { data: training },
    { data: identity },
    { data: credentials },
    { data: visibility },
    { data: consents },
    { data: requests },
    { data: completion },
    { data: securityEvents },
    { data: payrollLines },
    { data: tickets },
  ] = await Promise.all([
    supabase.from("employees").select("*").eq("id", employeeId).single(),
    supabase
      .from("profile_timeline")
      .select("*")
      .eq("employee_id", employeeId)
      .order("event_date", { ascending: false }),
    supabase
      .from("profile_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("profile_skills").select("*").eq("employee_id", employeeId),
    supabase.from("profile_certifications").select("*").eq("employee_id", employeeId),
    supabase.from("profile_projects").select("*").eq("employee_id", employeeId),
    supabase.from("employee_assets").select("*").eq("employee_id", employeeId),
    supabase
      .from("attendance_records")
      .select("*")
      .eq("employee_id", employeeId)
      .order("work_date", { ascending: false })
      .limit(30),
    supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("performance_reviews")
      .select("*")
      .eq("employee_id", employeeId)
      .order("review_date", { ascending: false })
      .limit(10),
    supabase
      .from("training_enrollments")
      .select("*, training_courses(title,course_code,provider)")
      .eq("employee_id", employeeId)
      .limit(20),
    supabase
      .from("wid_identities")
      .select("*")
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("wid_credentials")
      .select("*")
      .limit(5),
    supabase.from("profile_visibility").select("*").eq("employee_id", employeeId),
    supabase.from("profile_consents").select("*").eq("employee_id", employeeId),
    supabase
      .from("profile_requests")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("profile_completion").select("*").eq("employee_id", employeeId).maybeSingle(),
    supabase
      .from("profile_security_events")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payroll_lines")
      .select("gross_pay,net_pay,paye,basic_pay,created_at")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("support_tickets")
      .select("id,ticket_number,subject,status,priority,created_at")
      .limit(10),
  ]);

  // Credentials for this identity
  let cards: unknown[] = [];
  if (identity?.id) {
    const { data: creds } = await supabase
      .from("wid_credentials")
      .select("*")
      .eq("identity_id", identity.id)
      .limit(10);
    cards = creds || [];
  }

  // User account if linked
  let account = null;
  if (employee?.user_id) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id,email,phone,mfa_enabled,last_login_at,is_active,roles!user_profiles_role_id_fkey(name,slug)")
      .eq("id", employee.user_id)
      .maybeSingle();
    account = profile;
  }

  // Manager name
  let manager = null;
  if (employee?.manager_employee_id) {
    const { data: mgr } = await supabase
      .from("employees")
      .select("id,first_name,last_name,employee_number,job_title")
      .eq("id", employee.manager_employee_id)
      .maybeSingle();
    manager = mgr;
  }

  return {
    employee: employee as EmployeeProfile | null,
    timeline: timeline || [],
    documents: documents || [],
    skills: skills || [],
    certifications: certs || [],
    projects: projects || [],
    assets: assets || [],
    attendance: attendance || [],
    leave: leave || [],
    reviews: reviews || [],
    training: training || [],
    identity,
    credentials: cards.length ? cards : credentials || [],
    visibility: visibility || [],
    consents: consents || [],
    requests: requests || [],
    completion,
    securityEvents: securityEvents || [],
    payrollLines: payrollLines || [],
    tickets: tickets || [],
    account,
    manager,
  };
}

export function exportProfilesCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[]
): string {
  const header = columns.join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = r[c];
          const s = v == null ? "" : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export async function bulkUpdateDepartment(
  employeeIds: string[],
  department: string,
  companyId: string,
  actorId?: string | null
) {
  for (const id of employeeIds) {
    await updateEmployeeProfile(id, companyId, { department }, actorId);
  }
}
