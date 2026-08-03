import { createClient } from "@/lib/supabase/client";
import {
  createPerson,
  linkPerson,
  logIdentityEvent,
  activatePerson,
  suspendPerson,
  getPerson,
} from "@/lib/unified-identity";
import { createProvisionRequest } from "@/lib/idm";
import type { HireOrchestrationInput, LifecycleStage, MasterProfilePatch } from "./types";
import { DEFAULT_PROVISION_STEPS } from "./types";

function sb() {
  return createClient();
}

async function nextJobNumber(companyId: string): Promise<string> {
  const { data: rpc, error } = await sb().rpc("next_di_job_number", {
    p_company_id: companyId,
  });
  if (!error && rpc) return String(rpc);

  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("di_provision_jobs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `HDG-DI-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

// ─── Stats ───────────────────────────────────────────────────

export async function getDigitalIdentityStats() {
  const [
    persons,
    active,
    jobs,
    openJobs,
    cards,
    biometrics,
    orgUnits,
    insights,
  ] = await Promise.all([
    sb().from("uw_persons").select("*", { count: "exact", head: true }).is("deleted_at", null),
    sb()
      .from("uw_persons")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    sb().from("di_provision_jobs").select("*", { count: "exact", head: true }),
    sb()
      .from("di_provision_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["draft", "queued", "running", "partial"]),
    sb()
      .from("di_id_cards")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    sb()
      .from("di_biometric_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    sb()
      .from("di_org_units")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
    sb()
      .from("di_ai_insights")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  return {
    totalPersons: persons.count ?? 0,
    activePersons: active.count ?? 0,
    provisionJobs: jobs.count ?? 0,
    openJobs: openJobs.count ?? 0,
    activeCards: cards.count ?? 0,
    biometrics: biometrics.count ?? 0,
    orgUnits: orgUnits.count ?? 0,
    openInsights: insights.count ?? 0,
  };
}

// ─── Lifecycle ───────────────────────────────────────────────

export async function listPersonsByLifecycle(opts?: {
  stage?: string;
  limit?: number;
}) {
  let q = sb()
    .from("uw_persons")
    .select("*")
    .is("deleted_at", null)
    .order("display_name")
    .limit(opts?.limit ?? 200);
  if (opts?.stage) q = q.eq("lifecycle_stage", opts.stage);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getLifecycleCounts() {
  const { data, error } = await sb()
    .from("uw_persons")
    .select("lifecycle_stage")
    .is("deleted_at", null);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const s = String(row.lifecycle_stage || "active");
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

export async function advanceLifecycle(input: {
  person_id: string;
  company_id: string;
  to_stage: LifecycleStage;
  reason?: string;
  actor_id?: string | null;
}) {
  const person = await getPerson(input.person_id);
  if (!person) throw new Error("Person not found");

  const from = (person.lifecycle_stage as LifecycleStage) || "onboarding";

  const patch: Record<string, unknown> = {
    lifecycle_stage: input.to_stage,
    updated_at: new Date().toISOString(),
  };

  // Map stage → person status
  if (input.to_stage === "active" || input.to_stage === "confirmation") {
    patch.status = "active";
    if (!person.activated_at) patch.activated_at = new Date().toISOString();
  } else if (input.to_stage === "suspension") {
    patch.status = "suspended";
  } else if (input.to_stage === "leave") {
    patch.status = "leave";
  } else if (input.to_stage === "exit" || input.to_stage === "offboarding") {
    patch.status = "terminated";
    patch.exit_date = new Date().toISOString().slice(0, 10);
  } else if (input.to_stage === "archived") {
    patch.status = "archived";
    patch.terminated_at = new Date().toISOString();
  } else if (input.to_stage === "probation" || input.to_stage === "onboarding") {
    if (person.status === "provisional") patch.status = "active";
  }

  const { data, error } = await sb()
    .from("uw_persons")
    .update(patch)
    .eq("id", input.person_id)
    .select("*")
    .single();
  if (error) throw error;

  await sb().from("di_lifecycle_events").insert({
    company_id: input.company_id,
    person_id: input.person_id,
    from_stage: from,
    to_stage: input.to_stage,
    reason: input.reason || null,
    actor_id: input.actor_id || null,
  });

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: "lifecycle",
    title: `Lifecycle: ${from} → ${input.to_stage}`,
    details: input.reason,
    module_code: "identity",
    actor_id: input.actor_id,
  });

  // Propagate status to linked auth
  if (person.user_profile_id && patch.status) {
    const authStatus =
      patch.status === "active"
        ? "active"
        : patch.status === "suspended" || patch.status === "leave"
          ? "suspended"
          : patch.status === "terminated" || patch.status === "archived"
            ? "disabled"
            : null;
    if (authStatus) {
      await sb()
        .from("user_profiles")
        .update({
          account_status: authStatus,
          is_active: authStatus === "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", person.user_profile_id);
    }
  }

  // Offboarding: revoke cards
  if (input.to_stage === "offboarding" || input.to_stage === "archived") {
    await sb()
      .from("di_id_cards")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("person_id", input.person_id)
      .eq("status", "active");
  }

  return data;
}

// ─── Master profile ──────────────────────────────────────────

export async function updateMasterProfile(
  personId: string,
  companyId: string,
  patch: MasterProfilePatch,
  actorId?: string | null
) {
  const before = await getPerson(personId);
  if (!before) throw new Error("Person not found");

  const updates: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.position_title && !patch.job_title) {
    updates.job_title = patch.position_title;
  }
  if (patch.company_email) {
    updates.primary_email = patch.company_email;
  }

  const { data, error } = await sb()
    .from("uw_persons")
    .update(updates)
    .eq("id", personId)
    .select("*")
    .single();
  if (error) throw error;

  // HR employee sync
  if (before.employee_id) {
    const empPatch: Record<string, unknown> = {};
    if (patch.department !== undefined) empPatch.department = patch.department;
    if (patch.job_title || patch.position_title)
      empPatch.job_title = patch.job_title || patch.position_title;
    if (patch.grade !== undefined) empPatch.grade = patch.grade;
    if (patch.branch_name !== undefined) empPatch.branch_name = patch.branch_name;
    if (patch.employment_type !== undefined) empPatch.employment_type = patch.employment_type;
    if (patch.employment_status !== undefined) empPatch.status = patch.employment_status;
    if (patch.nssf_number !== undefined) empPatch.nssf_number = patch.nssf_number;
    if (patch.tin_number !== undefined) empPatch.tin_number = patch.tin_number;
    if (patch.gender !== undefined) empPatch.gender = patch.gender;
    if (patch.company_email !== undefined) empPatch.email = patch.company_email;
    if (Object.keys(empPatch).length) {
      await sb().from("employees").update(empPatch).eq("id", before.employee_id);
    }
  }

  // Auth profile sync
  if (before.user_profile_id) {
    const upPatch: Record<string, unknown> = {};
    if (patch.department !== undefined) upPatch.department = patch.department;
    if (patch.job_title || patch.position_title)
      upPatch.job_title = patch.job_title || patch.position_title;
    if (patch.company_email !== undefined) upPatch.email = patch.company_email;
    if (Object.keys(upPatch).length) {
      await sb().from("user_profiles").update(upPatch).eq("id", before.user_profile_id);
    }
  }

  // Log field-level sync
  const tracked = [
    "department",
    "job_title",
    "position_title",
    "branch_name",
    "cost_center",
    "company_email",
    "clearance_level",
    "employment_status",
  ] as const;
  for (const key of tracked) {
    const oldV = (before as Record<string, unknown>)[key];
    const newV = (patch as Record<string, unknown>)[key];
    if (newV !== undefined && String(oldV ?? "") !== String(newV ?? "")) {
      await sb().from("di_sync_log").insert({
        company_id: companyId,
        person_id: personId,
        field_key: key,
        old_value: oldV != null ? String(oldV) : null,
        new_value: newV != null ? String(newV) : null,
        targets_updated: ["identity", "hr", "payroll", "hopechat", "service_desk", "credentials"],
        actor_id: actorId || null,
      });
    }
  }

  await logIdentityEvent({
    company_id: companyId,
    person_id: personId,
    event_type: "profile_updated",
    title: "Master profile updated",
    module_code: "identity",
    actor_id: actorId,
  });

  return data;
}

// ─── Provisioning engine ─────────────────────────────────────

export async function listProvisionJobs(opts?: { status?: string; limit?: number }) {
  let q = sb()
    .from("di_provision_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status && opts.status !== "all") q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getProvisionJob(jobId: string) {
  const { data: job, error } = await sb()
    .from("di_provision_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job) return null;
  const { data: checklist } = await sb()
    .from("di_provision_checklist")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order");
  return { job, checklist: checklist || [] };
}

export async function listProvisionTemplates(companyId: string) {
  const { data, error } = await sb()
    .from("di_provision_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

/** HR hire orchestration: one master identity + full provision checklist */
export async function orchestrateHire(input: HireOrchestrationInput) {
  const displayName = `${input.first_name} ${input.last_name}`.trim();
  const jobNumber = await nextJobNumber(input.company_id);

  // Template
  let template: Record<string, unknown> | null = null;
  const code = input.template_code || "PERM-STAFF";
  const { data: tpl } = await sb()
    .from("di_provision_templates")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("code", code)
    .maybeSingle();
  template = tpl;

  const steps =
    (template?.steps as typeof DEFAULT_PROVISION_STEPS) || DEFAULT_PROVISION_STEPS;

  // Create provision job
  const { data: job, error: jobErr } = await sb()
    .from("di_provision_jobs")
    .insert({
      company_id: input.company_id,
      job_number: jobNumber,
      status: "queued",
      trigger_source: "hr_hire",
      display_name: displayName,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email.toLowerCase().trim(),
      department: input.department || null,
      job_title: input.job_title || null,
      employment_type: input.employment_type || "permanent",
      hire_date: input.hire_date || new Date().toISOString().slice(0, 10),
      template_id: template?.id || null,
      requested_by: input.actor_id || null,
    })
    .select("*")
    .single();
  if (jobErr) throw jobErr;

  // Checklist rows
  const checklistRows = steps.map((s, i) => ({
    company_id: input.company_id,
    job_id: job.id,
    step_key: s.step_key,
    step_label: s.label,
    module_code: s.module,
    sort_order: i,
    required: s.required,
    status: "pending",
  }));
  await sb().from("di_provision_checklist").insert(checklistRows);

  // Run engine
  return runProvisionJob(job.id, input);
}

async function markStep(
  jobId: string,
  stepKey: string,
  status: "done" | "failed" | "skipped",
  extra?: {
    entity_id?: string | null;
    entity_code?: string | null;
    entity_table?: string | null;
    error?: string | null;
  }
) {
  await sb()
    .from("di_provision_checklist")
    .update({
      status,
      entity_id: extra?.entity_id ?? null,
      entity_code: extra?.entity_code ?? null,
      entity_table: extra?.entity_table ?? null,
      error_message: extra?.error ?? null,
      completed_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("step_key", stepKey);
}

export async function runProvisionJob(jobId: string, hire?: HireOrchestrationInput) {
  const packed = await getProvisionJob(jobId);
  if (!packed) throw new Error("Job not found");
  const { job } = packed;

  await sb()
    .from("di_provision_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const companyId = job.company_id as string;
  const firstName = (hire?.first_name || job.first_name || "") as string;
  const lastName = (hire?.last_name || job.last_name || "") as string;
  const email = (hire?.email || job.email || "").toLowerCase().trim();
  const department = (hire?.department || job.department || undefined) as string | undefined;
  const jobTitle = (hire?.job_title || job.job_title || undefined) as string | undefined;
  const actorId = (hire?.actor_id || job.requested_by || null) as string | null;
  const results: Record<string, unknown> = {};
  let personId = job.person_id as string | null;
  let employeeId = job.employee_id as string | null;
  let failed = 0;

  try {
    // 1. Master identity
    if (!personId) {
      const person = await createPerson({
        company_id: companyId,
        display_name: `${firstName} ${lastName}`.trim(),
        legal_first_name: firstName,
        legal_last_name: lastName,
        primary_email: email,
        primary_phone: hire?.phone,
        department,
        job_title: jobTitle,
        branch_name: hire?.branch_name,
        person_kinds: ["workforce"],
        created_by: actorId,
      });
      personId = person.id;
      results.upid = person.upid;

      await sb()
        .from("uw_persons")
        .update({
          company_email: email,
          personal_email: email,
          employment_type: hire?.employment_type || job.employment_type || "permanent",
          hire_date: hire?.hire_date || job.hire_date,
          grade: hire?.grade || null,
          position_title: jobTitle || null,
          lifecycle_stage: "onboarding",
          clearance_level: hire?.clearance_level || "employee",
          qr_identity_token: `QR-${person.upid}`,
          middle_name: hire?.middle_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", personId);

      await markStep(jobId, "master_identity", "done", {
        entity_id: personId,
        entity_table: "uw_persons",
        entity_code: person.upid,
      });
    } else {
      await markStep(jobId, "master_identity", "done", {
        entity_id: personId,
        entity_table: "uw_persons",
      });
    }

    // 2. HR employee
    if (!employeeId) {
      const year = new Date().getFullYear();
      const { count } = await sb()
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);
      const empNo = `EMP-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const { data: emp, error: empErr } = await sb()
        .from("employees")
        .insert({
          company_id: companyId,
          employee_number: empNo,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: hire?.phone || null,
          department: department || null,
          job_title: jobTitle || null,
          branch_name: hire?.branch_name || null,
          employment_type: hire?.employment_type || job.employment_type || "permanent",
          status: "active",
          hire_date: hire?.hire_date || job.hire_date || new Date().toISOString().slice(0, 10),
          grade: hire?.grade || null,
          person_id: personId,
        })
        .select("*")
        .single();

      if (empErr) {
        await markStep(jobId, "hr_employee", "failed", { error: empErr.message });
        failed += 1;
      } else {
        employeeId = emp.id;
        results.employee_number = empNo;
        await sb()
          .from("uw_persons")
          .update({
            employee_id: employeeId,
            employee_number: empNo,
            employment_status: "active",
          })
          .eq("id", personId);
        await linkPerson({
          company_id: companyId,
          person_id: personId!,
          link_type: "employee",
          module_code: "hr",
          entity_table: "employees",
          entity_id: employeeId ?? undefined,
          entity_code: empNo,
          is_primary: true,
        });
        await markStep(jobId, "hr_employee", "done", {
          entity_id: employeeId,
          entity_table: "employees",
          entity_code: empNo,
        });
      }
    } else {
      await markStep(jobId, "hr_employee", "done", {
        entity_id: employeeId,
        entity_table: "employees",
      });
    }

    // 3–4. ERP user + credentials via IDM provision request
    if (!hire?.skip_auth_provision && email) {
      try {
        const req = await createProvisionRequest({
          company_id: companyId,
          data: {
            first_name: firstName,
            last_name: lastName,
            email,
            phone: hire?.phone,
            department,
            employee_id: (results.employee_number as string) || undefined,
            employee_record_id: employeeId || undefined,
            user_type: "employee",
            source: "hr_onboarding",
          },
          requested_by: actorId,
          require_approval: true,
        });
        results.provision_request_id = req?.id;
        results.username = req?.username;
        await markStep(jobId, "erp_user", "done", {
          entity_id: req?.id,
          entity_table: "idm_provision_requests",
          entity_code: req?.request_number || req?.username,
        });
        await markStep(jobId, "login_credentials", "done", {
          entity_code: req?.username,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Auth provision failed";
        await markStep(jobId, "erp_user", "failed", { error: msg });
        await markStep(jobId, "login_credentials", "failed", { error: msg });
        failed += 1;
      }
    } else {
      await markStep(jobId, "erp_user", "skipped");
      await markStep(jobId, "login_credentials", "skipped");
    }

    // 5. Company email
    await sb()
      .from("uw_persons")
      .update({ company_email: email, primary_email: email })
      .eq("id", personId!);
    await markStep(jobId, "company_email", "done", { entity_code: email });

    // 6. SecureChat entitlement
    await sb().from("uw_module_entitlements").upsert(
      {
        company_id: companyId,
        person_id: personId!,
        module_code: "hopechat",
        entitlement: "member",
        granted: true,
        source: "provision",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );
    await linkPerson({
      company_id: companyId,
      person_id: personId!,
      link_type: "hopechat",
      module_code: "hopechat",
      entity_code: email,
    });
    await markStep(jobId, "hopechat", "done");

    // 7. Service desk
    await sb().from("uw_module_entitlements").upsert(
      {
        company_id: companyId,
        person_id: personId!,
        module_code: "service_desk",
        entitlement: "member",
        granted: true,
        source: "provision",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );
    await linkPerson({
      company_id: companyId,
      person_id: personId!,
      link_type: "service_desk",
      module_code: "service_desk",
      entity_code: email,
    });
    await markStep(jobId, "service_desk", "done");

    // 8. Portal
    await sb().from("uw_module_entitlements").upsert(
      {
        company_id: companyId,
        person_id: personId!,
        module_code: "portal",
        entitlement: "member",
        granted: true,
        source: "provision",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );
    await markStep(jobId, "employee_portal", "done");

    // 9. Payroll profile link
    await sb().from("uw_module_entitlements").upsert(
      {
        company_id: companyId,
        person_id: personId!,
        module_code: "payroll",
        entitlement: "member",
        granted: true,
        source: "provision",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );
    await linkPerson({
      company_id: companyId,
      person_id: personId!,
      link_type: "payroll",
      module_code: "payroll",
      entity_table: "employees",
      entity_id: employeeId || undefined,
    });
    await markStep(jobId, "payroll_profile", "done");

    // 10–12. Attendance / leave / performance (HR profiles — mark ready)
    await markStep(jobId, "attendance_profile", "done", {
      entity_code: "attendance-ready",
    });
    await markStep(jobId, "leave_profile", "done", {
      entity_code: "leave-ready",
    });
    await markStep(jobId, "performance_profile", "done", {
      entity_code: "performance-ready",
    });

    // 13. Asset profile
    await sb().from("uw_module_entitlements").upsert(
      {
        company_id: companyId,
        person_id: personId!,
        module_code: "assets",
        entitlement: "member",
        granted: true,
        source: "provision",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );
    await markStep(jobId, "asset_profile", "done");

    // 14. Company ID card
    try {
      const card = await issueIdCard({
        company_id: companyId,
        person_id: personId!,
        card_type: (hire?.template_code === "MGMT" ? "management" : "staff") as
          | "staff"
          | "management",
        actor_id: actorId,
      });
      results.card_number = card.card_number;
      await markStep(jobId, "company_id_card", "done", {
        entity_id: card.id,
        entity_table: "di_id_cards",
        entity_code: card.card_number,
      });
    } catch (e) {
      await markStep(jobId, "company_id_card", "failed", {
        error: e instanceof Error ? e.message : "Card issue failed",
      });
      failed += 1;
    }

    // 15. QR identity
    const person = await getPerson(personId!);
    const qr = person?.qr_identity_token || `QR-${person?.upid || personId}`;
    await sb()
      .from("uw_persons")
      .update({ qr_identity_token: qr })
      .eq("id", personId!);
    await markStep(jobId, "qr_identity", "done", { entity_code: qr });

    // 16. Digital signature placeholder
    await markStep(jobId, "digital_signature", "done", {
      entity_code: "pending-capture",
    });

    // 17. MFA enrollment flag
    await sb()
      .from("uw_persons")
      .update({ mfa_enrolled: false })
      .eq("id", personId!);
    await markStep(jobId, "mfa_enrollment", "done", {
      entity_code: "pending-enrollment",
    });

    // Activate person
    await activatePerson(personId!, companyId, actorId);
    await advanceLifecycle({
      person_id: personId!,
      company_id: companyId,
      to_stage: "onboarding",
      reason: "Enterprise hire orchestration complete",
      actor_id: actorId,
    });

    const finalStatus = failed > 0 ? "partial" : "completed";
    await sb()
      .from("di_provision_jobs")
      .update({
        status: finalStatus,
        person_id: personId,
        employee_id: employeeId,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        result_summary: results,
        error_summary: failed > 0 ? `${failed} step(s) failed` : null,
      })
      .eq("id", jobId);

    return {
      job_id: jobId,
      job_number: job.job_number,
      person_id: personId,
      employee_id: employeeId,
      status: finalStatus,
      results,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provision failed";
    await sb()
      .from("di_provision_jobs")
      .update({
        status: "failed",
        error_summary: msg,
        person_id: personId,
        employee_id: employeeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    throw e;
  }
}

// ─── Org structure ───────────────────────────────────────────

export async function listOrgUnits(companyId?: string) {
  let q = sb()
    .from("di_org_units")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createOrgUnit(input: {
  company_id: string;
  code: string;
  name: string;
  unit_type: string;
  parent_id?: string | null;
  cost_center?: string;
  branch_name?: string;
  manager_person_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("di_org_units")
    .insert({
      company_id: input.company_id,
      code: input.code.toUpperCase(),
      name: input.name,
      unit_type: input.unit_type,
      parent_id: input.parent_id || null,
      cost_center: input.cost_center || null,
      branch_name: input.branch_name || null,
      manager_person_id: input.manager_person_id || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrgUnit(
  id: string,
  patch: Partial<{
    name: string;
    parent_id: string | null;
    manager_person_id: string | null;
    cost_center: string;
    is_active: boolean;
    sort_order: number;
  }>
) {
  const { data, error } = await sb()
    .from("di_org_units")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function buildOrgTree(units: Array<Record<string, unknown>>) {
  type Node = Record<string, unknown> & { children: Node[] };
  const map = new Map<string, Node>();
  const roots: Node[] = [];
  for (const u of units) {
    map.set(u.id as string, { ...u, children: [] });
  }
  for (const u of units) {
    const node = map.get(u.id as string)!;
    if (u.parent_id && map.has(u.parent_id as string)) {
      map.get(u.parent_id as string)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ─── Clearance ───────────────────────────────────────────────

export async function listClearanceMatrix(companyId: string) {
  const { data, error } = await sb()
    .from("di_clearance_matrix")
    .select("*")
    .eq("company_id", companyId)
    .order("clearance_level")
    .order("module_code");
  if (error) throw error;
  return data || [];
}

export async function assignClearance(input: {
  company_id: string;
  person_id: string;
  clearance_level: string;
  reason?: string;
  granted_by?: string | null;
}) {
  await sb()
    .from("di_clearance_assignments")
    .update({ is_active: false })
    .eq("person_id", input.person_id)
    .eq("is_active", true);

  const { data, error } = await sb()
    .from("di_clearance_assignments")
    .insert({
      company_id: input.company_id,
      person_id: input.person_id,
      clearance_level: input.clearance_level,
      reason: input.reason || null,
      granted_by: input.granted_by || null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("uw_persons")
    .update({
      clearance_level: input.clearance_level,
      security_clearance: input.clearance_level,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.person_id);

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: "clearance_changed",
    title: `Clearance → ${input.clearance_level}`,
    details: input.reason,
    module_code: "identity",
    actor_id: input.granted_by,
  });

  return data;
}

// ─── ID Cards ────────────────────────────────────────────────

export async function listIdCards(opts?: { person_id?: string; limit?: number }) {
  let q = sb()
    .from("di_id_cards")
    .select("*, uw_persons(display_name, upid, department, job_title, photo_url)")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.person_id) q = q.eq("person_id", opts.person_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function issueIdCard(input: {
  company_id: string;
  person_id: string;
  card_type?: string;
  actor_id?: string | null;
}) {
  const person = await getPerson(input.person_id);
  if (!person) throw new Error("Person not found");

  const year = new Date().getFullYear();
  const { count } = await sb()
    .from("di_id_cards")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const cardNumber = `ID-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
  const cardType = input.card_type || "staff";
  const months = cardType === "visitor" ? 1 : cardType === "contractor" ? 12 : 24;
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);

  const qrPayload = JSON.stringify({
    upid: person.upid,
    card: cardNumber,
    name: person.display_name,
  });

  // Revoke previous active
  await sb()
    .from("di_id_cards")
    .update({ status: "reissued", updated_at: new Date().toISOString() })
    .eq("person_id", input.person_id)
    .eq("status", "active");

  const { data, error } = await sb()
    .from("di_id_cards")
    .insert({
      company_id: input.company_id,
      person_id: input.person_id,
      card_number: cardNumber,
      card_type: cardType,
      qr_payload: qrPayload,
      barcode_value: cardNumber,
      issue_date: new Date().toISOString().slice(0, 10),
      expiry_date: expiry.toISOString().slice(0, 10),
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw error;

  await linkPerson({
    company_id: input.company_id,
    person_id: input.person_id,
    link_type: "workforce_credential",
    module_code: "credentials",
    entity_table: "di_id_cards",
    entity_id: data.id,
    entity_code: cardNumber,
  });

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: "credential_issued",
    title: `Company ID issued: ${cardNumber}`,
    module_code: "credentials",
    actor_id: input.actor_id,
  });

  return data;
}

export async function printIdCard(cardId: string) {
  const { data: card } = await sb().from("di_id_cards").select("*").eq("id", cardId).maybeSingle();
  if (!card) throw new Error("Card not found");
  const { data, error } = await sb()
    .from("di_id_cards")
    .update({
      print_count: Number(card.print_count || 0) + 1,
      last_printed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─── Biometrics ──────────────────────────────────────────────

export async function listBiometricProfiles(personId?: string) {
  let q = sb()
    .from("di_biometric_profiles")
    .select("*, uw_persons(display_name, upid)")
    .eq("is_active", true)
    .order("enrolled_at", { ascending: false })
    .limit(200);
  if (personId) q = q.eq("person_id", personId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listBiometricDevices(companyId: string) {
  const { data, error } = await sb()
    .from("di_biometric_devices")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function enrollBiometric(input: {
  company_id: string;
  person_id: string;
  modality: string;
  vendor?: string;
  device_id?: string;
}) {
  // Store hash of enrollment event only — never raw biometric templates in app code
  const templateHash = `enr-${input.modality}-${Date.now().toString(36)}`;
  const { data, error } = await sb()
    .from("di_biometric_profiles")
    .upsert(
      {
        company_id: input.company_id,
        person_id: input.person_id,
        modality: input.modality,
        vendor: input.vendor || "generic",
        template_hash: templateHash,
        device_id: input.device_id || null,
        is_active: true,
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: "person_id,modality,vendor" }
    )
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("uw_persons")
    .update({ biometric_enrolled: true, updated_at: new Date().toISOString() })
    .eq("id", input.person_id);

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: "biometric_enrolled",
    title: `Biometric enrolled: ${input.modality}`,
    module_code: "credentials",
  });

  return data;
}

// ─── Documents & assets ──────────────────────────────────────

export async function listPersonDocuments(personId: string) {
  const { data, error } = await sb()
    .from("di_document_vault")
    .select("*")
    .eq("person_id", personId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addDocument(input: {
  company_id: string;
  person_id: string;
  doc_type: string;
  title: string;
  file_url?: string;
  uploaded_by?: string | null;
}) {
  const { data, error } = await sb()
    .from("di_document_vault")
    .insert({
      company_id: input.company_id,
      person_id: input.person_id,
      doc_type: input.doc_type,
      title: input.title,
      file_url: input.file_url || null,
      uploaded_by: input.uploaded_by || null,
      is_encrypted: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listPersonAssets(personId: string) {
  const { data, error } = await sb()
    .from("di_asset_assignments")
    .select("*")
    .eq("person_id", personId)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function assignAsset(input: {
  company_id: string;
  person_id: string;
  asset_type: string;
  asset_code?: string;
  asset_name: string;
  serial_number?: string;
}) {
  const { data, error } = await sb()
    .from("di_asset_assignments")
    .insert({
      company_id: input.company_id,
      person_id: input.person_id,
      asset_type: input.asset_type,
      asset_code: input.asset_code || null,
      asset_name: input.asset_name,
      serial_number: input.serial_number || null,
      status: "issued",
    })
    .select("*")
    .single();
  if (error) throw error;

  await linkPerson({
    company_id: input.company_id,
    person_id: input.person_id,
    link_type: "asset_custodian",
    module_code: "assets",
    entity_table: "di_asset_assignments",
    entity_id: data.id,
    entity_code: input.asset_code || input.asset_name,
  });

  return data;
}

// ─── Sync ────────────────────────────────────────────────────

export async function listSyncRules(companyId: string) {
  const { data, error } = await sb()
    .from("di_sync_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("field_key");
  if (error) throw error;
  return data || [];
}

export async function listSyncLog(opts?: { person_id?: string; limit?: number }) {
  let q = sb()
    .from("di_sync_log")
    .select("*, uw_persons(display_name, upid)")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.person_id) q = q.eq("person_id", opts.person_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Propagate HR department change across linked modules */
export async function syncDepartmentChange(input: {
  person_id: string;
  company_id: string;
  department: string;
  actor_id?: string | null;
}) {
  return updateMasterProfile(
    input.person_id,
    input.company_id,
    { department: input.department },
    input.actor_id
  );
}

// ─── AI insights ─────────────────────────────────────────────

export async function listAiInsights(opts?: { status?: string; limit?: number }) {
  let q = sb()
    .from("di_ai_insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function resolveInsight(id: string) {
  const { data, error } = await sb()
    .from("di_ai_insights")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function generateWorkforceInsights(companyId: string) {
  // Rule-based insights from live data (no external LLM required)
  const insights: Array<{
    insight_type: string;
    title: string;
    summary: string;
    severity: string;
    score: number;
    recommendations: string[];
  }> = [];

  const { count: probation } = await sb()
    .from("uw_persons")
    .select("*", { count: "exact", head: true })
    .eq("lifecycle_stage", "probation")
    .is("deleted_at", null);

  if ((probation ?? 0) > 0) {
    insights.push({
      insight_type: "performance_summary",
      title: `${probation} staff on probation`,
      summary: "Review confirmation timelines and manager check-ins before probation ends.",
      severity: "info",
      score: 60,
      recommendations: ["Schedule mid-probation reviews", "Assign mentors", "Track training completion"],
    });
  }

  const { count: noBio } = await sb()
    .from("uw_persons")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("biometric_enrolled", false)
    .is("deleted_at", null);

  if ((noBio ?? 0) > 0) {
    insights.push({
      insight_type: "training_gap",
      title: `${noBio} active persons without biometrics`,
      summary: "Access control coverage is incomplete for factory and warehouse gates.",
      severity: "warning",
      score: 70,
      recommendations: ["Batch enroll at main gate", "Prioritize production staff", "Sync ZKTeco devices"],
    });
  }

  const { count: exitStage } = await sb()
    .from("uw_persons")
    .select("*", { count: "exact", head: true })
    .in("lifecycle_stage", ["exit", "offboarding"])
    .is("deleted_at", null);

  if ((exitStage ?? 0) > 0) {
    insights.push({
      insight_type: "turnover_risk",
      title: `${exitStage} in exit/offboarding pipeline`,
      summary: "Ensure access revocation, asset return, and payroll finalization complete on schedule.",
      severity: "warning",
      score: 75,
      recommendations: ["Run deprovision job", "Collect assets", "Revoke ID cards", "Archive after notice"],
    });
  }

  for (const i of insights) {
    await sb().from("di_ai_insights").insert({
      company_id: companyId,
      insight_type: i.insight_type,
      title: i.title,
      summary: i.summary,
      severity: i.severity,
      score: i.score,
      recommendations: i.recommendations,
      status: "open",
    });
  }

  return insights;
}

// ─── Deprovision / exit ──────────────────────────────────────

export async function orchestrateExit(input: {
  person_id: string;
  company_id: string;
  reason?: string;
  actor_id?: string | null;
}) {
  await advanceLifecycle({
    person_id: input.person_id,
    company_id: input.company_id,
    to_stage: "offboarding",
    reason: input.reason || "Exit process started",
    actor_id: input.actor_id,
  });

  const person = await getPerson(input.person_id);
  if (person?.user_profile_id) {
    await sb()
      .from("user_profiles")
      .update({
        is_active: false,
        account_status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.user_profile_id);
  }

  await sb()
    .from("di_id_cards")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("person_id", input.person_id)
    .eq("status", "active");

  await sb()
    .from("di_biometric_profiles")
    .update({ is_active: false })
    .eq("person_id", input.person_id);

  // Return open assets
  await sb()
    .from("di_asset_assignments")
    .update({
      status: "returned",
      returned_at: new Date().toISOString(),
    })
    .eq("person_id", input.person_id)
    .eq("status", "issued");

  await suspendPerson(
    input.person_id,
    input.company_id,
    input.reason || "Offboarding",
    input.actor_id
  );

  await advanceLifecycle({
    person_id: input.person_id,
    company_id: input.company_id,
    to_stage: "archived",
    reason: "Offboarding complete — access revoked",
    actor_id: input.actor_id,
  });

  return { ok: true };
}

// ─── Approval routes ─────────────────────────────────────────

export async function listApprovalRoutes(companyId: string) {
  const { data, error } = await sb()
    .from("di_approval_routes")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("process_code");
  if (error) throw error;
  return data || [];
}
