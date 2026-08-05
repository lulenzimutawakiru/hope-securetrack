/**
 * Platform cPanel — cross-tenant control plane for SecureTrack staff.
 * Uses service-role admin client; callers MUST verify isPlatformAdmin first.
 *
 * Full tenant CRUD:
 *  - Create  → cpanelCreateTenant (full provision)
 *  - Read    → cpanelListTenants / cpanelGetTenant
 *  - Update  → cpanelMutateTenant (update_meta, plan, lifecycle, modules, flags)
 *  - Delete  → cpanelDeleteTenant (soft by default; hard optional)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionTenant } from "@/lib/platform/provision";
import type { ProvisionTenantInput } from "@/lib/platform/types";
import {
  allocateUniqueSlug,
  validateAdminPassword,
} from "@/lib/platform/onboarding";

export type PlatformTenantRow = {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  status: string;
  plan_code?: string | null;
  primary_currency?: string | null;
  country_code?: string | null;
  timezone?: string | null;
  primary_contact_email?: string | null;
  trial_ends_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  settings?: Record<string, unknown> | null;
  company_count?: number;
  user_count?: number;
  subscription_status?: string | null;
};

export type PlatformTenantDetail = PlatformTenantRow & {
  companies: Array<Record<string, unknown>>;
  subscription: Record<string, unknown> | null;
  modules: Array<Record<string, unknown>>;
  flags: Array<Record<string, unknown>>;
  admins: Array<Record<string, unknown>>;
  setup: Array<Record<string, unknown>>;
  recent_events: Array<Record<string, unknown>>;
  provisioning_jobs: Array<Record<string, unknown>>;
};

function admin(): SupabaseClient {
  return createAdminClient();
}

export async function cpanelListTenants(opts?: {
  search?: string;
  status?: string;
  plan?: string;
  limit?: number;
}): Promise<PlatformTenantRow[]> {
  const sb = admin();
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 200));

  let q = sb
    .from("tenants")
    .select(
      "id,slug,name,legal_name,status,plan_code,primary_currency,country_code,timezone,primary_contact_email,trial_ends_at,created_at,updated_at,settings,deleted_at"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.plan) q = q.eq("plan_code", opts.plan);
  if (opts?.search?.trim()) {
    const s = opts.search.trim().replace(/[%_,.()"'\\]/g, " ").slice(0, 80);
    q = q.or(
      `name.ilike.%${s}%,slug.ilike.%${s}%,primary_contact_email.ilike.%${s}%`
    );
  }

  const { data: tenants, error } = await q;
  if (error) throw new Error(error.message);
  if (!tenants?.length) return [];

  const ids = tenants.map((t) => t.id as string);

  // Aggregate companies
  const { data: companies } = await sb
    .from("companies")
    .select("id,tenant_id")
    .in("tenant_id", ids);

  const companyCount = new Map<string, number>();
  const companyIds: string[] = [];
  for (const c of companies || []) {
    const tid = c.tenant_id as string;
    companyCount.set(tid, (companyCount.get(tid) || 0) + 1);
    if (c.id) companyIds.push(c.id as string);
  }

  // User counts by tenant_id on profiles
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("id,tenant_id")
    .in("tenant_id", ids)
    .is("deleted_at", null);

  const userCount = new Map<string, number>();
  for (const p of profiles || []) {
    const tid = p.tenant_id as string;
    if (!tid) continue;
    userCount.set(tid, (userCount.get(tid) || 0) + 1);
  }

  const { data: subs } = await sb
    .from("tenant_subscriptions")
    .select("tenant_id,status,plan_code")
    .in("tenant_id", ids);

  const subByTenant = new Map<string, string>();
  for (const s of subs || []) {
    subByTenant.set(s.tenant_id as string, String(s.status || ""));
  }

  return tenants.map((t) => ({
    ...(t as PlatformTenantRow),
    company_count: companyCount.get(t.id as string) || 0,
    user_count: userCount.get(t.id as string) || 0,
    subscription_status: subByTenant.get(t.id as string) || null,
  }));
}

export async function cpanelGetTenant(
  tenantId: string
): Promise<PlatformTenantDetail | null> {
  const sb = admin();
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) return null;

  const [
    companies,
    subscription,
    modules,
    flags,
    admins,
    setup,
    events,
    jobs,
  ] = await Promise.all([
    sb
      .from("companies")
      .select(
        "id,name,code,is_primary,is_active,base_currency,country,company_type,created_at"
      )
      .eq("tenant_id", tenantId)
      .order("is_primary", { ascending: false })
      .limit(100)
      .then((r) => r.data || []),
    sb
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then((r) => r.data),
    sb
      .from("tenant_modules")
      .select("id,module_code,enabled,enabled_at,config")
      .eq("tenant_id", tenantId)
      .order("module_code")
      .limit(200)
      .then((r) => r.data || []),
    sb
      .from("tenant_feature_flags")
      .select("id,flag_key,enabled")
      .eq("tenant_id", tenantId)
      .order("flag_key")
      .limit(200)
      .then((r) => r.data || []),
    sb
      .from("user_profiles")
      .select(
        "id,email,first_name,last_name,is_active,role_id,created_at,roles!user_profiles_role_id_fkey(slug,name)"
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50)
      .then((r) => r.data || []),
    sb
      .from("tenant_setup_progress")
      .select("step_key,step_label,status,sort_order,completed_at")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .limit(50)
      .then((r) => r.data || []),
    sb
      .from("domain_events")
      .select("id,event_type,severity,source_module,created_at,payload")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then((r) => r.data || []),
    sb
      .from("tenant_provisioning_jobs")
      .select("id,job_code,status,organization_name,admin_email,created_at,error_message")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r.data || []),
  ]);

  const companyCount = companies.length;
  const userCount = admins.length;

  return {
    ...(tenant as PlatformTenantRow),
    company_count: companyCount,
    user_count: userCount,
    subscription_status: (subscription?.status as string) || null,
    companies: companies as Array<Record<string, unknown>>,
    subscription: (subscription as Record<string, unknown>) || null,
    modules: modules as Array<Record<string, unknown>>,
    flags: flags as Array<Record<string, unknown>>,
    admins: admins as Array<Record<string, unknown>>,
    setup: setup as Array<Record<string, unknown>>,
    recent_events: events as Array<Record<string, unknown>>,
    provisioning_jobs: jobs as Array<Record<string, unknown>>,
  };
}

export type TenantLifecycleAction =
  | "activate"
  | "suspend"
  | "cancel"
  | "trial"
  | "update_plan"
  | "update_meta"
  | "set_module"
  | "set_flag";

export async function cpanelMutateTenant(
  tenantId: string,
  action: TenantLifecycleAction,
  payload: Record<string, unknown>,
  actorId: string
): Promise<Record<string, unknown>> {
  const sb = admin();

  const { data: tenant, error: tErr } = await sb
    .from("tenants")
    .select("id,slug,name,status,plan_code,settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (tErr || !tenant) throw new Error(tErr?.message || "Tenant not found");

  if (action === "activate") {
    const { data, error } = await sb
      .from("tenants")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("tenant_subscriptions").update({ status: "active" }).eq("tenant_id", tenantId);
    await emitPlatformEvent(sb, tenantId, "tenant.activated", actorId, {});
    return data as Record<string, unknown>;
  }

  if (action === "suspend") {
    const reason = String(payload.reason || "Suspended by platform admin");
    const settings = {
      ...((tenant.settings as Record<string, unknown>) || {}),
      suspended_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: actorId,
    };
    const { data, error } = await sb
      .from("tenants")
      .update({
        status: "suspended",
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb
      .from("tenant_subscriptions")
      .update({ status: "suspended" })
      .eq("tenant_id", tenantId);
    await emitPlatformEvent(sb, tenantId, "tenant.suspended", actorId, {
      reason,
    });
    return data as Record<string, unknown>;
  }

  if (action === "cancel") {
    const { data, error } = await sb
      .from("tenants")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb
      .from("tenant_subscriptions")
      .update({ status: "cancelled" })
      .eq("tenant_id", tenantId);
    await emitPlatformEvent(sb, tenantId, "tenant.cancelled", actorId, {});
    return data as Record<string, unknown>;
  }

  if (action === "trial") {
    const days = Number(payload.days) || 30;
    const trialEnds = new Date(Date.now() + days * 86400000).toISOString();
    const { data, error } = await sb
      .from("tenants")
      .update({
        status: "trial",
        trial_ends_at: trialEnds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb
      .from("tenant_subscriptions")
      .update({ status: "trial", trial_ends_at: trialEnds })
      .eq("tenant_id", tenantId);
    await emitPlatformEvent(sb, tenantId, "tenant.trial_extended", actorId, {
      days,
      trial_ends_at: trialEnds,
    });
    return data as Record<string, unknown>;
  }

  if (action === "update_plan") {
    const plan = String(payload.plan_code || "").trim();
    if (!plan) throw new Error("plan_code required");
    const { data, error } = await sb
      .from("tenants")
      .update({
        plan_code: plan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await sb
      .from("tenant_subscriptions")
      .upsert(
        {
          tenant_id: tenantId,
          plan_code: plan,
          status: data.status === "trial" ? "trial" : "active",
        },
        { onConflict: "tenant_id" }
      );
    await emitPlatformEvent(sb, tenantId, "tenant.plan_changed", actorId, {
      plan_code: plan,
    });
    return data as Record<string, unknown>;
  }

  if (action === "update_meta") {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of [
      "name",
      "legal_name",
      "primary_contact_email",
      "country_code",
      "primary_currency",
      "timezone",
    ] as const) {
      if (payload[key] !== undefined) patch[key] = payload[key];
    }

    // Enterprise config lives under settings (domain, language, region, compliance, industry)
    const settingsMerge: Record<string, unknown> = {
      ...((tenant.settings as Record<string, unknown>) || {}),
    };
    if (payload.settings && typeof payload.settings === "object") {
      Object.assign(settingsMerge, payload.settings as Record<string, unknown>);
    }
    for (const key of [
      "industry",
      "language",
      "data_region",
      "domain",
      "compliance_requirements",
    ] as const) {
      if (payload[key] !== undefined) {
        settingsMerge[key] = payload[key];
      }
    }
    // Never allow clients to overwrite crypto material
    const prev = (tenant.settings as Record<string, unknown>) || {};
    if (prev.encryption) settingsMerge.encryption = prev.encryption;
    if (prev.isolation && !payload.settings) {
      // keep isolation unless explicitly patched via settings.isolation
      if (!("isolation" in settingsMerge)) {
        settingsMerge.isolation = prev.isolation;
      }
    }
    patch.settings = settingsMerge;

    const { data, error } = await sb
      .from("tenants")
      .update(patch)
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await emitPlatformEvent(sb, tenantId, "tenant.updated", actorId, {
      fields: Object.keys(patch),
    });
    return data as Record<string, unknown>;
  }

  if (action === "set_module") {
    const code = String(payload.module_code || "").trim();
    if (!code) throw new Error("module_code required");
    const enabled = Boolean(payload.enabled);
    const { error } = await sb.from("tenant_modules").upsert(
      {
        tenant_id: tenantId,
        module_code: code,
        enabled,
        enabled_at: enabled ? new Date().toISOString() : null,
      },
      { onConflict: "tenant_id,module_code" }
    );
    if (error) throw new Error(error.message);
    await emitPlatformEvent(sb, tenantId, "tenant.module_toggled", actorId, {
      module_code: code,
      enabled,
    });
    return { module_code: code, enabled };
  }

  if (action === "set_flag") {
    const key = String(payload.flag_key || "").trim();
    if (!key) throw new Error("flag_key required");
    const enabled = Boolean(payload.enabled);
    const { error } = await sb.from("tenant_feature_flags").upsert(
      {
        tenant_id: tenantId,
        flag_key: key,
        enabled,
      },
      { onConflict: "tenant_id,flag_key" }
    );
    if (error) throw new Error(error.message);
    await emitPlatformEvent(sb, tenantId, "tenant.flag_toggled", actorId, {
      flag_key: key,
      enabled,
    });
    return { flag_key: key, enabled };
  }

  throw new Error(`Unknown action: ${action}`);
}

/**
 * Create a tenant with full stack: company, HQ, subscription, modules,
 * wizard, and administrator auth user (same path as public provision).
 */
export async function cpanelCreateTenant(
  input: ProvisionTenantInput,
  actorId: string
): Promise<{
  tenantId: string;
  companyId: string;
  jobCode: string;
  slug: string;
  domain?: string;
  encryption_secret_once?: string | null;
}> {
  const pwd = validateAdminPassword(input.admin_password || "");
  if (!pwd.ok) {
    throw new Error(pwd.errors[0] || "Invalid administrator password");
  }
  if (!input.organization_name?.trim() || input.organization_name.trim().length < 2) {
    throw new Error("organization_name is required (min 2 characters)");
  }
  if (!input.admin_email?.trim()) {
    throw new Error("admin_email is required");
  }

  const sb = admin();
  const result = await provisionTenant(sb, {
    ...input,
    organization_name: input.organization_name.trim(),
    admin_email: input.admin_email.trim().toLowerCase(),
  });

  await emitPlatformEvent(sb, result.tenantId, "tenant.created", actorId, {
    via: "platform_cpanel",
    job_code: result.job.job_code,
    admin_email: input.admin_email,
    plan_code: input.plan_code || "starter",
  });

  const { data: t } = await sb
    .from("tenants")
    .select("slug")
    .eq("id", result.tenantId)
    .maybeSingle();

  return {
    tenantId: result.tenantId,
    companyId: result.companyId,
    jobCode: result.job.job_code,
    slug: (t?.slug as string) || input.slug || "",
    domain: result.domain,
    // One-time only — caller must vault and never log
    encryption_secret_once: result.encryptionSecretOnce || null,
  };
}

/**
 * Soft-delete a tenant (default): marks deleted_at + cancelled.
 * Hard delete: only when `hard: true` and tenant is cancelled/soft-deleted
 * (or force: true). Deactivates memberships; does not drop auth users
 * (use offboarding purge for destructive wipe).
 */
export async function cpanelDeleteTenant(
  tenantId: string,
  actorId: string,
  opts?: { hard?: boolean; force?: boolean; reason?: string }
): Promise<{ mode: "soft" | "hard"; tenant_id: string }> {
  const sb = admin();
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("id,slug,name,status,deleted_at,settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !tenant) throw new Error(error?.message || "Tenant not found");

  const reason = opts?.reason || "Deleted by platform admin";

  if (!opts?.hard) {
    const settings = {
      ...((tenant.settings as Record<string, unknown>) || {}),
      deleted_reason: reason,
      deleted_at: new Date().toISOString(),
      deleted_by: actorId,
    };
    const { error: uErr } = await sb
      .from("tenants")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (uErr) throw new Error(uErr.message);

    await sb
      .from("tenant_subscriptions")
      .update({ status: "cancelled" })
      .eq("tenant_id", tenantId);

    // Deactivate company memberships under this tenant
    const { data: cos } = await sb
      .from("companies")
      .select("id")
      .eq("tenant_id", tenantId);
    const companyIds = (cos || []).map((c) => c.id as string);
    if (companyIds.length) {
      await sb
        .from("user_company_memberships")
        .update({ status: "inactive" })
        .in("company_id", companyIds);
      await sb
        .from("companies")
        .update({ is_active: false })
        .in("id", companyIds);
    }

    await emitPlatformEvent(sb, tenantId, "tenant.deleted", actorId, {
      mode: "soft",
      reason,
    });
    return { mode: "soft", tenant_id: tenantId };
  }

  // Hard delete
  const softAlready = Boolean(tenant.deleted_at) || tenant.status === "cancelled";
  if (!softAlready && !opts?.force) {
    throw new Error(
      "Hard delete requires a soft-deleted or cancelled tenant, or force: true"
    );
  }

  // Clear FKs that block delete where possible
  await sb.from("tenant_setup_progress").delete().eq("tenant_id", tenantId);
  await sb.from("tenant_feature_flags").delete().eq("tenant_id", tenantId);
  await sb.from("tenant_modules").delete().eq("tenant_id", tenantId);
  await sb.from("tenant_subscriptions").delete().eq("tenant_id", tenantId);
  await sb.from("tenant_provisioning_jobs").delete().eq("tenant_id", tenantId);

  const { data: cos } = await sb
    .from("companies")
    .select("id")
    .eq("tenant_id", tenantId);
  const companyIds = (cos || []).map((c) => c.id as string);
  if (companyIds.length) {
    await sb.from("user_company_memberships").delete().in("company_id", companyIds);
    // Null out tenant_id on companies rather than cascade-deleting all ERP data
    await sb
      .from("companies")
      .update({ tenant_id: null, is_active: false })
      .in("id", companyIds);
  }

  await sb
    .from("user_profiles")
    .update({ tenant_id: null, is_active: false })
    .eq("tenant_id", tenantId);

  const { error: dErr } = await sb.from("tenants").delete().eq("id", tenantId);
  if (dErr) throw new Error(dErr.message);

  // Event after delete (no tenant_id FK required if nullable)
  try {
    await sb.from("domain_events").insert({
      event_type: "tenant.purged",
      aggregate_type: "tenant",
      aggregate_id: tenantId,
      actor_id: actorId,
      payload: { mode: "hard", slug: tenant.slug, name: tenant.name, reason },
      source_module: "platform",
      severity: "warning",
    });
  } catch {
    /* non-fatal */
  }

  return { mode: "hard", tenant_id: tenantId };
}

/** Ensure unique slug helper for create UI */
export async function cpanelSuggestSlug(name: string): Promise<string> {
  return allocateUniqueSlug(admin(), name);
}

async function emitPlatformEvent(
  sb: SupabaseClient,
  tenantId: string,
  eventType: string,
  actorId: string,
  payload: Record<string, unknown>
) {
  try {
    await sb.from("domain_events").insert({
      event_type: eventType,
      aggregate_type: "tenant",
      aggregate_id: tenantId,
      tenant_id: tenantId,
      actor_id: actorId,
      payload,
      source_module: "platform",
      severity: "info",
    });
  } catch {
    /* non-fatal */
  }
}

export async function cpanelOverview() {
  const sb = admin();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();

  const [
    tenantsAll,
    tenantsActive,
    tenantsTrial,
    tenantsSuspended,
    companies,
    users,
    subsActive,
    openJobs,
    events24h,
  ] = await Promise.all([
    sb.from("tenants").select("id", { count: "exact", head: true }),
    sb
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    sb
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "trial"),
    sb
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    sb.from("companies").select("id", { count: "exact", head: true }),
    sb
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    sb
      .from("tenant_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    sb
      .from("tenant_provisioning_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "running"]),
    sb
      .from("domain_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
  ]);

  return {
    tenants: tenantsAll.count ?? 0,
    tenants_active: tenantsActive.count ?? 0,
    tenants_trial: tenantsTrial.count ?? 0,
    tenants_suspended: tenantsSuspended.count ?? 0,
    companies: companies.count ?? 0,
    users: users.count ?? 0,
    active_subscriptions: subsActive.count ?? 0,
    open_provision_jobs: openJobs.count ?? 0,
    events_24h: events24h.count ?? 0,
  };
}
