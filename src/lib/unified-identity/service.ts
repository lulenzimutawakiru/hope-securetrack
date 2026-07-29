import { createClient } from "@/lib/supabase/client";
import type { LinkInput, PersonInput } from "./types";
import { MODULE_CODES } from "./types";

function sb() {
  return createClient();
}

async function nextUpid(companyId: string): Promise<string> {
  // Prefer RPC if available
  const { data: rpc, error: rpcErr } = await sb().rpc("next_upid", {
    p_company_id: companyId,
    p_prefix: "HDG",
  });
  if (!rpcErr && rpc) return String(rpc);

  // Fallback client-side sequence
  const { data: seq } = await sb()
    .from("uw_upid_sequences")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  let next = 1;
  let pad = 6;
  if (seq) {
    next = Number(seq.last_number) + 1;
    pad = Number(seq.pad_width) || 6;
    await sb()
      .from("uw_upid_sequences")
      .update({ last_number: next, updated_at: new Date().toISOString() })
      .eq("company_id", companyId);
  } else {
    await sb().from("uw_upid_sequences").insert({
      company_id: companyId,
      prefix: "HDG",
      last_number: 1,
      pad_width: 6,
    });
  }
  const year = new Date().getFullYear();
  return `HDG-PID-${year}-${String(next).padStart(pad, "0")}`;
}

export async function logIdentityEvent(input: {
  company_id: string;
  person_id: string;
  event_type: string;
  title: string;
  details?: string;
  module_code?: string;
  actor_id?: string | null;
}) {
  await sb().from("uw_identity_events").insert({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: input.event_type,
    title: input.title,
    details: input.details || null,
    module_code: input.module_code || null,
    actor_id: input.actor_id || null,
  });
}

export async function listPersons(opts?: {
  search?: string;
  status?: string;
  limit?: number;
}) {
  let q = sb()
    .from("uw_persons")
    .select("*")
    .is("deleted_at", null)
    .order("display_name")
    .limit(opts?.limit ?? 200);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.search) {
    const s = opts.search.trim();
    q = q.or(
      `display_name.ilike.%${s}%,upid.ilike.%${s}%,primary_email.ilike.%${s}%,job_title.ilike.%${s}%`
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listPerson360(limit = 100) {
  const { data, error } = await sb()
    .from("uw_person_360")
    .select("*")
    .order("display_name")
    .limit(limit);
  if (error) {
    // View may not exist yet — fall back
    return listPersons({ limit });
  }
  return data || [];
}

export async function getPerson(id: string) {
  const { data, error } = await sb().from("uw_persons").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPersonByUpid(upid: string) {
  const { data, error } = await sb()
    .from("uw_persons")
    .select("*")
    .eq("upid", upid)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveByUserProfile(userProfileId: string) {
  const { data, error } = await sb()
    .from("uw_persons")
    .select("*")
    .eq("user_profile_id", userProfileId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveByEmployee(employeeId: string) {
  const { data, error } = await sb()
    .from("uw_persons")
    .select("*")
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPersonLinks(personId: string) {
  const { data, error } = await sb()
    .from("uw_person_links")
    .select("*")
    .eq("person_id", personId)
    .order("module_code");
  if (error) throw error;
  return data || [];
}

export async function getPersonEntitlements(personId: string) {
  const { data, error } = await sb()
    .from("uw_module_entitlements")
    .select("*")
    .eq("person_id", personId)
    .eq("granted", true)
    .order("module_code");
  if (error) throw error;
  return data || [];
}

export async function getPersonEvents(personId: string, limit = 50) {
  const { data, error } = await sb()
    .from("uw_identity_events")
    .select("*")
    .eq("person_id", personId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Full 360 aggregation for one digital person */
export async function getPersonGraph(personId: string) {
  const [person, links, entitlements, events] = await Promise.all([
    getPerson(personId),
    getPersonLinks(personId),
    getPersonEntitlements(personId),
    getPersonEvents(personId),
  ]);
  if (!person) throw new Error("Person not found");

  // Enrich with live module records where possible
  let employee: Record<string, unknown> | null = null;
  let profile: Record<string, unknown> | null = null;
  let credential: Record<string, unknown> | null = null;

  if (person.employee_id) {
    const { data } = await sb().from("employees").select("*").eq("id", person.employee_id).maybeSingle();
    employee = data;
  }
  if (person.user_profile_id) {
    const { data } = await sb()
      .from("user_profiles")
      .select("id, email, first_name, last_name, is_active, account_status, username, role_id, last_login_at")
      .eq("id", person.user_profile_id)
      .maybeSingle();
    profile = data;
  }
  if (person.wid_identity_id) {
    const { data } = await sb()
      .from("wid_identities")
      .select("id, identity_number, status, identity_type, full_name")
      .eq("id", person.wid_identity_id)
      .maybeSingle();
    credential = data;
  }

  return {
    person,
    links,
    entitlements,
    events,
    employee,
    auth: profile,
    credential,
    modules: MODULE_CODES.filter((m) =>
      entitlements.some((e) => e.module_code === m && e.granted)
    ),
  };
}

export async function createPerson(input: PersonInput) {
  const upid = await nextUpid(input.company_id);
  const { data, error } = await sb()
    .from("uw_persons")
    .insert({
      company_id: input.company_id,
      upid,
      display_name: input.display_name,
      legal_first_name: input.legal_first_name || null,
      legal_last_name: input.legal_last_name || null,
      preferred_name: input.preferred_name || input.legal_first_name || null,
      primary_email: input.primary_email || null,
      primary_phone: input.primary_phone || null,
      person_kinds: input.person_kinds || ["workforce"],
      status: "provisional",
      department: input.department || null,
      job_title: input.job_title || null,
      branch_name: input.branch_name || null,
      user_profile_id: input.user_profile_id || null,
      employee_id: input.employee_id || null,
      created_by: input.created_by || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: data.id,
    event_type: "created",
    title: "Unified digital person created",
    details: upid,
    module_code: "identity",
    actor_id: input.created_by,
  });

  // Baseline entitlements
  for (const mod of ["identity", "hopechat", "notifications"] as const) {
    await sb()
      .from("uw_module_entitlements")
      .upsert(
        {
          company_id: input.company_id,
          person_id: data.id,
          module_code: mod,
          entitlement: "member",
          granted: true,
          source: "manual",
        },
        { onConflict: "person_id,module_code,entitlement" }
      );
  }

  if (input.user_profile_id) {
    await linkPerson({
      company_id: input.company_id,
      person_id: data.id,
      link_type: "auth_account",
      module_code: "identity",
      entity_table: "user_profiles",
      entity_id: input.user_profile_id,
      is_primary: true,
    });
    await sb().from("user_profiles").update({ person_id: data.id }).eq("id", input.user_profile_id);
  }
  if (input.employee_id) {
    await linkPerson({
      company_id: input.company_id,
      person_id: data.id,
      link_type: "employee",
      module_code: "hr",
      entity_table: "employees",
      entity_id: input.employee_id,
      is_primary: true,
    });
    await sb().from("employees").update({ person_id: data.id }).eq("id", input.employee_id);
  }

  return data;
}

export async function linkPerson(input: LinkInput) {
  const { data, error } = await sb()
    .from("uw_person_links")
    .upsert(
      {
        company_id: input.company_id,
        person_id: input.person_id,
        link_type: input.link_type,
        module_code: input.module_code,
        entity_table: input.entity_table || null,
        entity_id: input.entity_id || null,
        entity_code: input.entity_code || null,
        is_primary: input.is_primary ?? false,
        status: "active",
      },
      { onConflict: "person_id,link_type,entity_id" }
    )
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("uw_module_entitlements")
    .upsert(
      {
        company_id: input.company_id,
        person_id: input.person_id,
        module_code: input.module_code,
        entitlement: "member",
        granted: true,
        source: "manual",
      },
      { onConflict: "person_id,module_code,entitlement" }
    );

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.person_id,
    event_type: "linked",
    title: `Linked ${input.link_type} → ${input.module_code}`,
    details: input.entity_code || input.entity_id || undefined,
    module_code: input.module_code,
  });

  // Sync denormalized FKs
  if (input.link_type === "auth_account" && input.entity_id) {
    await sb()
      .from("uw_persons")
      .update({ user_profile_id: input.entity_id })
      .eq("id", input.person_id);
  }
  if (input.link_type === "employee" && input.entity_id) {
    await sb()
      .from("uw_persons")
      .update({ employee_id: input.entity_id })
      .eq("id", input.person_id);
  }
  if (input.link_type === "workforce_credential" && input.entity_id) {
    await sb()
      .from("uw_persons")
      .update({ wid_identity_id: input.entity_id })
      .eq("id", input.person_id);
  }

  return data;
}

export async function activatePerson(personId: string, companyId: string, actorId?: string | null) {
  const { data, error } = await sb()
    .from("uw_persons")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", personId)
    .select("*")
    .single();
  if (error) throw error;
  await logIdentityEvent({
    company_id: companyId,
    person_id: personId,
    event_type: "activated",
    title: "Digital identity activated",
    module_code: "identity",
    actor_id: actorId,
  });
  return data;
}

export async function suspendPerson(
  personId: string,
  companyId: string,
  reason?: string,
  actorId?: string | null
) {
  const { data, error } = await sb()
    .from("uw_persons")
    .update({ status: "suspended", updated_at: new Date().toISOString() })
    .eq("id", personId)
    .select("*")
    .single();
  if (error) throw error;
  await logIdentityEvent({
    company_id: companyId,
    person_id: personId,
    event_type: "suspended",
    title: "Digital identity suspended",
    details: reason,
    module_code: "identity",
    actor_id: actorId,
  });
  return data;
}

export async function mergePersons(input: {
  company_id: string;
  source_id: string;
  target_id: string;
  actor_id?: string | null;
}) {
  // Move links
  await sb()
    .from("uw_person_links")
    .update({ person_id: input.target_id })
    .eq("person_id", input.source_id);
  await sb()
    .from("uw_module_entitlements")
    .update({ person_id: input.target_id })
    .eq("person_id", input.source_id);
  await sb()
    .from("uw_identity_events")
    .update({ person_id: input.target_id })
    .eq("person_id", input.source_id);

  const { data: source } = await sb().from("uw_persons").select("*").eq("id", input.source_id).maybeSingle();

  // Prefer non-null FKs on target
  if (source) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const { data: target } = await sb().from("uw_persons").select("*").eq("id", input.target_id).maybeSingle();
    if (target) {
      if (!target.user_profile_id && source.user_profile_id) patch.user_profile_id = source.user_profile_id;
      if (!target.employee_id && source.employee_id) patch.employee_id = source.employee_id;
      if (!target.wid_identity_id && source.wid_identity_id) patch.wid_identity_id = source.wid_identity_id;
      await sb().from("uw_persons").update(patch).eq("id", input.target_id);
    }
  }

  await sb()
    .from("uw_persons")
    .update({
      deleted_at: new Date().toISOString(),
      status: "archived",
      metadata: { merged_into: input.target_id },
    })
    .eq("id", input.source_id);

  await sb().from("uw_merge_log").insert({
    company_id: input.company_id,
    source_person_id: input.source_id,
    target_person_id: input.target_id,
    actor_id: input.actor_id,
    merged_links: { links: true, entitlements: true, events: true },
  });

  await logIdentityEvent({
    company_id: input.company_id,
    person_id: input.target_id,
    event_type: "merged",
    title: "Duplicate person merged",
    details: `source=${input.source_id}`,
    module_code: "identity",
    actor_id: input.actor_id,
  });
}

export async function getEcosystemStats() {
  const [persons, active, links, events, orphanUsers, orphanEmployees] = await Promise.all([
    sb().from("uw_persons").select("*", { count: "exact", head: true }).is("deleted_at", null),
    sb()
      .from("uw_persons")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    sb().from("uw_person_links").select("*", { count: "exact", head: true }),
    sb().from("uw_identity_events").select("*", { count: "exact", head: true }),
    sb()
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .is("person_id", null),
    sb()
      .from("employees")
      .select("*", { count: "exact", head: true })
      .is("person_id", null),
  ]);

  return {
    totalPersons: persons.count ?? 0,
    activePersons: active.count ?? 0,
    totalLinks: links.count ?? 0,
    totalEvents: events.count ?? 0,
    orphanAuthAccounts: orphanUsers.count ?? 0,
    orphanEmployees: orphanEmployees.count ?? 0,
  };
}

/** Sync missing employees into unified persons (client-side catch-up) */
export async function syncFromEmployees(companyId: string, actorId?: string | null) {
  const { data: employees } = await sb()
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .is("person_id", null)
    .limit(50);

  let created = 0;
  for (const e of employees || []) {
    try {
      await createPerson({
        company_id: companyId,
        display_name: `${e.first_name || ""} ${e.last_name || ""}`.trim() || "Employee",
        legal_first_name: e.first_name as string,
        legal_last_name: e.last_name as string,
        primary_email: (e.email as string) || undefined,
        primary_phone: (e.phone as string) || undefined,
        department: (e.department as string) || undefined,
        job_title: (e.job_title as string) || undefined,
        employee_id: e.id as string,
        user_profile_id: (e.user_id as string) || null,
        person_kinds: ["workforce"],
        created_by: actorId,
      });
      created += 1;
    } catch {
      /* skip conflicts */
    }
  }
  return { created };
}
