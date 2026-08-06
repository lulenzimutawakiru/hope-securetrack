/**
 * Enterprise Tenant Provisioning Platform — orchestration engine.
 *
 * A checkpointed, idempotent, retryable step graph that provisions a complete
 * tenant environment: namespace → crypto vault → isolation → company → branch →
 * subscription → modules → flags → API credentials → security baseline →
 * defaults → wizard → domain event → admin identity → welcome → ready.
 *
 * Every step persists its own row (provisioning_steps) and the job persists a
 * checkpoint (checkpoint_json.completed_keys) so a failed run can be retried
 * from the first incomplete step. On failure, compensators roll back completed
 * steps in reverse order (best-effort). One-time secrets (encryption key,
 * API key) are held in memory only and returned once — never persisted.
 */

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProvisionTenantInput } from "@/lib/platform/types";
import {
  allocateUniqueSlug,
  assertAdminEmailAvailable,
  buildWizardRows,
  resolveLocaleDefaults,
  seedTenantDefaults,
  validateAdminPassword,
} from "@/lib/platform/onboarding";
import { sendTenantWelcomeEmail } from "@/lib/platform/welcome-email";
import {
  generateTenantEncryptionKey,
  tenantDomainFromSlug,
} from "@/lib/platform/tenant-crypto";
import {
  generateApiKeyPrefix,
  generateJobCode,
  hashApiKey,
  nextTenantNumber,
} from "./ids";
import { mergeTemplateConfig, DEFAULT_TEMPLATE_CODE } from "./templates";
import type {
  ProvisioningContext,
  ProvisioningJobRow,
  ProvisioningRunResult,
  ProvisioningStepDef,
  ProvisioningStepRow,
  ProvisioningTemplate,
  TemplateRuntimeConfig,
} from "./types";

/** Richer provisioning request accepted by the control plane. */
export type ProvisioningRequest = ProvisionTenantInput & {
  template_code?: string;
  industry_pack?: string;
  demo_data?: boolean;
  registration_channel?: string;
};

/** Strip one-time secrets from any object that will be persisted. */
function stripSecrets(state: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith("__")) continue;
    out[k] = v;
  }
  return out;
}

export function sanitizeProvisionInput(
  input: ProvisioningRequest
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...input };
  delete clean.admin_password;
  clean.admin_password_provided = Boolean(input.admin_password);
  return clean;
}

export function resolveTemplateCode(input: {
  template_code?: string;
  plan_code?: string;
}): string {
  if (input.template_code?.trim()) return input.template_code.trim();
  const byPlan: Record<string, string> = {
    starter: "sme-starter",
    professional: "mid-market-professional",
    enterprise: "enterprise",
    government: "government",
  };
  return byPlan[input.plan_code || ""] || DEFAULT_TEMPLATE_CODE;
}

export function normalizeIndustryPackCode(code: string): string {
  const c = code.trim().toLowerCase();
  return c.startsWith("industry-") ? c : "industry-" + c;
}

function uniqueStrings(a?: string[]): string[] {
  return [...new Set((a || []).map((s) => String(s)).filter(Boolean))];
}

/** Load a DB template row (metadata source of truth) merged over runtime. */
async function loadTemplate(
  sb: SupabaseClient,
  code: string
): Promise<{ template: ProvisioningTemplate | null; config: TemplateRuntimeConfig }> {
  const { data } = await sb
    .from("provisioning_templates")
    .select("*")
    .eq("template_code", code)
    .maybeSingle();
  return mergeTemplateConfig(data as never, code) as {
    template: ProvisioningTemplate | null;
    config: TemplateRuntimeConfig;
  };
}

/**
 * Effective configuration = tenant template config ⊕ industry pack config.
 * Modules/workflows/compliance are unioned; scalar keys prefer the industry pack.
 */
async function loadEffectiveConfig(
  sb: SupabaseClient,
  templateCode: string,
  industryPack?: string
): Promise<{
  template: ProvisioningTemplate | null;
  config: TemplateRuntimeConfig;
  industryPack: ProvisioningTemplate | null;
}> {
  const { template, config } = await loadTemplate(sb, templateCode);
  if (!industryPack?.trim()) {
    return { template, config, industryPack: null };
  }
  const packCode = normalizeIndustryPackCode(industryPack);
  const { template: pack, config: packConfig } = await loadTemplate(sb, packCode);
  const merged: TemplateRuntimeConfig = {
    ...config,
    ...packConfig,
    modules: uniqueStrings([...(config.modules || []), ...(packConfig.modules || [])]),
    workflows: uniqueStrings([
      ...(config.workflows || []),
      ...(packConfig.workflows || []),
    ]),
    compliance: uniqueStrings([
      ...(config.compliance || []),
      ...(packConfig.compliance || []),
    ]),
  };
  return { template, config: merged, industryPack: pack };
}

// ---------------------------------------------------------------------------
// Job event timeline helper (never fatal)
// ---------------------------------------------------------------------------
async function logJobEvent(
  sb: SupabaseClient,
  jobId: string,
  eventType: string,
  message?: string,
  data?: Record<string, unknown>,
  severity: "info" | "warning" | "error" = "info"
): Promise<void> {
  try {
    await sb.from("provisioning_job_events").insert({
      job_id: jobId,
      event_type: eventType,
      message: (message || "").slice(0, 2000),
      data: data || {},
      severity,
    });
  } catch {
    /* non-fatal */
  }
}
// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
async function preflightStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  await assertAdminEmailAvailable(ctx.sb, ctx.input.admin_email);
  const slug = await allocateUniqueSlug(
    ctx.sb,
    ctx.input.slug || ctx.input.organization_name
  );
  const locale = resolveLocaleDefaults({
    country_code: ctx.input.country_code,
    currency: ctx.input.currency,
    timezone: ctx.input.timezone,
  });
  const plan = ctx.input.plan_code || "starter";
  const isTrial = plan === "starter";
  const domain = ctx.input.domain?.trim() || tenantDomainFromSlug(slug);
  const language = (ctx.input.language || "en").slice(0, 10);
  const dataRegion = (ctx.input.data_region || "eu-west-1").slice(0, 40);
  const compliance = (ctx.input.compliance_requirements || []).map(String);

  ctx.state.slug = slug;
  ctx.state.locale = locale;
  ctx.state.plan = plan;
  ctx.state.isTrial = plan === "starter";
  ctx.state.domain = domain;
  ctx.state.language = language;
  ctx.state.dataRegion = dataRegion;
  ctx.state.compliance = compliance;

  return {
    slug,
    plan,
    domain,
    detail: "slug=" + slug + " \u00b7 " + domain,
    locale,
    isTrial,
    language,
    dataRegion,
    compliance,
  };
}

async function tenantStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const slug = state.slug as string;
  const locale = state.locale as ReturnType<typeof resolveLocaleDefaults>;
  const plan = (state.plan as string) || "starter";
  const isTrial = Boolean(state.isTrial);
  const domain = state.domain as string;
  const language = state.language as string;
  const dataRegion = state.dataRegion as string;
  const compliance = (state.compliance as string[]) || [];

  const { data: tenant, error } = await sb
    .from("tenants")
    .insert({
      slug,
      name: input.organization_name,
      legal_name: input.organization_name,
      status: isTrial ? "trial" : "active",
      plan_code: plan,
      primary_currency: locale.currency,
      country_code: locale.country_code,
      timezone: locale.timezone,
      primary_contact_email: input.admin_email,
      trial_ends_at: isTrial
        ? new Date(Date.now() + 30 * 86400000).toISOString()
        : null,
      settings: {
        product: "SecureTrack ERP",
        provisioned: true,
        onboarding_version: 3,
        industry: input.industry || null,
        language,
        data_region: dataRegion,
        domain,
        compliance_requirements: compliance,
        isolation: {
          enforce_tenant_id: true,
          enforce_company_id: true,
          enforce_branch_id: true,
          rls: true,
          storage: true,
          search: true,
          ai: true,
          reporting: true,
        },
      },
    })
    .select("*")
    .single();
  if (error || !tenant) throw error || new Error("Tenant create failed");

  ctx.state.tenantId = tenant.id;
  ctx.state.tenant = tenant;
  return { tenantId: tenant.id, detail: tenant.id + " · " + domain };
}

const tenantCompensate = async (ctx: ProvisioningContext) => {
  const tenantId = ctx.state.tenantId as string | undefined;
  if (!tenantId) return;
  try {
    const { data: tenant } = await ctx.sb
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();
    const settings = {
      ...((tenant?.settings as Record<string, unknown>) || {}),
      provisioned: false,
      provision_error: "Provisioning failed — tenant rolled back",
    };
    await ctx.sb
      .from("tenants")
      .update({
        status: "suspended",
        settings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
  } catch {
    /* best effort */
  }
};

async function cryptoStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const crypto = generateTenantEncryptionKey();
  ctx.state.__secrets = {
    ...((ctx.state.__secrets as Record<string, unknown>) || {}),
    encryption_secret_b64: crypto.secret_b64,
    encryption_key_id: crypto.key_id,
    encryption_fingerprint: crypto.fingerprint,
    encryption_algorithm: crypto.algorithm,
  };

  // Key vault metadata only — raw secret never touches the database.
  const { error } = await ctx.sb.from("tenant_encryption_keys").insert({
    tenant_id: tenantId,
    key_id: crypto.key_id,
    algorithm: crypto.algorithm,
    fingerprint: crypto.fingerprint,
    status: "active",
  });
  if (error) {
    throw new Error("Encryption key vault write failed: " + error.message);
  }

  const { data: tenant } = await ctx.sb
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const settings = {
    ...((tenant?.settings as Record<string, unknown>) || {}),
    encryption: {
      key_id: crypto.key_id,
      fingerprint: crypto.fingerprint,
      algorithm: crypto.algorithm,
    },
  };
  await ctx.sb.from("tenants").update({ settings }).eq("id", tenantId);

  return { keyId: crypto.key_id, fingerprint: crypto.fingerprint, detail: crypto.key_id };
}

const cryptoCompensate = async (ctx: ProvisioningContext, step: ProvisioningStepRow) => {
  const keyId = (step.output_json?.keyId as string) || undefined;
  const tenantId = ctx.state.tenantId as string | undefined;
  if (!keyId || !tenantId) return;
  try {
    await ctx.sb
      .from("tenant_encryption_keys")
      .update({ status: "revoked" })
      .eq("tenant_id", tenantId)
      .eq("key_id", keyId);
  } catch {
    /* best effort */
  }
};

async function isolationStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const { data: tenant } = await ctx.sb
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const settings = {
    ...((tenant?.settings as Record<string, unknown>) || {}),
    isolation: {
      enforce_tenant_id: true,
      enforce_company_id: true,
      enforce_branch_id: true,
      rls: true,
      storage: true,
      search: true,
      ai: true,
      reporting: true,
    },
  };
  await ctx.sb.from("tenants").update({ settings }).eq("id", tenantId);
  await logJobEvent(ctx.sb, ctx.job.id, "isolation.applied", "RLS + storage + AI + reporting isolation enforced", {
    tenant_id: tenantId,
  });
  return { isolation: "applied", detail: "RLS+storage+AI+reporting" };
}

async function companyStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const slug = state.slug as string;
  const locale = state.locale as ReturnType<typeof resolveLocaleDefaults>;
  const tenantId = state.tenantId as string;

  const companyCode =
    slug.toUpperCase().replace(/-/g, "").slice(0, 12) || "CO";
  const { data: company, error } = await sb
    .from("companies")
    .insert({
      name: input.organization_name,
      code: companyCode + "-" + String(Date.now()).slice(-4),
      legal_name: input.organization_name,
      country: locale.countryName,
      tenant_id: tenantId,
      is_primary: true,
      is_active: true,
      base_currency: locale.currency,
      company_type: "operating",
    })
    .select("*")
    .single();
  if (error || !company) throw error || new Error("Company create failed");

  ctx.state.companyId = company.id;
  ctx.state.company = company;
  return { companyId: company.id, detail: company.id };
}

const companyCompensate = async (ctx: ProvisioningContext) => {
  const companyId = ctx.state.companyId as string | undefined;
  if (!companyId) return;
  try {
    await ctx.sb
      .from("companies")
      .update({ is_active: false })
      .eq("id", companyId);
  } catch {
    /* best effort */
  }
};
async function branchStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const companyId = ctx.state.companyId as string;
  const tenantId = ctx.state.tenantId as string;
  const locale = ctx.state.locale as ReturnType<typeof resolveLocaleDefaults>;
  try {
    const { data: branch, error } = await ctx.sb
      .from("branches")
      .insert({
        company_id: companyId,
        tenant_id: tenantId,
        name: "Head Office",
        code: "HQ",
        city: locale.country_code === "UG" ? "Kampala" : null,
        country: locale.countryName,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !branch) {
      return { branchId: null, detail: "skipped: " + (error?.message || "no row") };
    }
    ctx.state.branchId = branch.id;
    return { branchId: branch.id, detail: "HQ" };
  } catch {
    return { branchId: null, detail: "skipped: branch fields unavailable" };
  }
}

async function subscriptionStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const tenantId = state.tenantId as string;
  const plan = (state.plan as string) || "starter";
  const isTrial = Boolean(state.isTrial);
  const seats =
    input.seats ||
    (plan === "starter"
      ? 25
      : plan === "professional"
        ? 200
        : plan === "government"
          ? 5000
          : 1000);
  const modules =
    plan === "enterprise" || plan === "government"
      ? ["all"]
      : (input.modules || []);
  const { data, error } = await sb
    .from("tenant_subscriptions")
    .upsert(
      {
        tenant_id: tenantId,
        plan_code: plan,
        status: isTrial ? "trial" : "active",
        seats,
        modules,
        billing_email: input.admin_email,
        trial_ends_at: isTrial
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null,
      },
      { onConflict: "tenant_id" }
    )
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Subscription upsert failed");

  ctx.state.subscriptionId = data.id;
  return { subscriptionId: data.id, detail: plan + " · " + seats + " seats" };
}

const subscriptionCompensate = async (ctx: ProvisioningContext) => {
  const tenantId = ctx.state.tenantId as string | undefined;
  if (!tenantId) return;
  try {
    await ctx.sb
      .from("tenant_subscriptions")
      .update({ status: "cancelled" })
      .eq("tenant_id", tenantId);
  } catch {
    /* best effort */
  }
};

async function modulesStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, state } = ctx;
  const tenantId = state.tenantId as string;
  const plan = (state.plan as string) || "starter";
  const fullAccess = plan === "enterprise" || plan === "government";

  const { data: mods, error } = await sb
    .from("platform_modules")
    .select("module_code, default_enabled, is_core");
  if (error) throw new Error("Module catalog read failed: " + error.message);
  if (!mods?.length) return { count: 0, detail: "no module catalog" };

  const requested = new Set(
    (ctx.input.modules || []).map((m) => String(m).toLowerCase())
  );
  const fromConfig = new Set(
    (ctx.templateConfig.modules || []).map((m) => String(m).toLowerCase())
  );

  const rows = mods.map((m) => {
    const code = String(m.module_code).toLowerCase();
    const isCore = m.is_core === true;
    const defaultEnabled = m.default_enabled !== false;
    let enabled: boolean;
    if (fullAccess) {
      enabled = true;
    } else if (requested.size > 0 || fromConfig.size > 0) {
      enabled = requested.has(code) || fromConfig.has(code) || isCore;
    } else {
      enabled = isCore || defaultEnabled;
    }
    return {
      tenant_id: tenantId,
      module_code: String(m.module_code),
      enabled,
    };
  });

  const { error: uErr } = await sb.from("tenant_modules").upsert(rows, {
    onConflict: "tenant_id,module_code",
  });
  if (uErr) throw new Error("Module enable failed: " + uErr.message);

  const count = rows.filter((r) => r.enabled).length;
  return { count, detail: count + " modules enabled" };
}

async function flagsStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const { data: flags, error } = await ctx.sb
    .from("platform_feature_flags")
    .select("flag_key, default_enabled");
  if (error) throw new Error("Feature flag catalog read failed: " + error.message);

  const overrides = (ctx.templateConfig.feature_flags ||
    {}) as Record<string, boolean>;
  const rows = (flags || []).map((f) => {
    const key = String(f.flag_key);
    const enabled =
      typeof overrides[key] === "boolean"
        ? overrides[key]
        : f.default_enabled !== false;
    return { tenant_id: tenantId, flag_key: key, enabled };
  });

  if (rows.length) {
    const { error: uErr } = await ctx.sb
      .from("tenant_feature_flags")
      .upsert(rows, { onConflict: "tenant_id,flag_key" });
    if (uErr) throw new Error("Feature flag apply failed: " + uErr.message);
  }
  return { count: rows.length, detail: rows.length + " flags" };
}

async function apiKeysStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const secret = randomBytes(32).toString("base64url");
  const keyPrefix = generateApiKeyPrefix();
  const { data, error } = await ctx.sb
    .from("tenant_api_credentials")
    .insert({
      tenant_id: tenantId,
      name: "Default tenant API key",
      key_prefix: keyPrefix,
      key_hash: hashApiKey(secret),
      scopes: ["tenant:read", "tenant:write"],
      status: "active",
      created_by: ctx.actorId || null,
    })
    .select("id")
    .single();
  if (error || !data) throw error || new Error("API credential create failed");

  ctx.state.__secrets = {
    ...((ctx.state.__secrets as Record<string, unknown>) || {}),
    api_key_secret: secret,
    api_key_prefix: keyPrefix,
  };
  ctx.state.apiKeyId = data.id;
  return { apiKeyId: data.id, apiKeyPrefix: keyPrefix, detail: keyPrefix };
}

const apiKeysCompensate = async (ctx: ProvisioningContext, step: ProvisioningStepRow) => {
  const apiKeyId = (step.output_json?.apiKeyId as string) || undefined;
  if (!apiKeyId) return;
  try {
    await ctx.sb
      .from("tenant_api_credentials")
      .update({ status: "revoked" })
      .eq("id", apiKeyId);
  } catch {
    /* best effort */
  }
};

async function securityStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const baseline = (ctx.templateConfig.security || {}) as Record<string, unknown>;
  const compliance = (ctx.state.compliance as string[]) || [];

  const { data: tenant } = await ctx.sb
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const settings = {
    ...((tenant?.settings as Record<string, unknown>) || {}),
    security_baseline: baseline,
    compliance_requirements: compliance,
  };
  const { error } = await ctx.sb
    .from("tenants")
    .update({ settings })
    .eq("id", tenantId);
  if (error) throw new Error("Security baseline apply failed: " + error.message);

  await logJobEvent(ctx.sb, ctx.job.id, "security.baseline_applied", "Security baseline applied", {
    tenant_id: tenantId,
    keys: Object.keys(baseline),
  });
  return {
    security: "applied",
    detail: Object.keys(baseline).join(",") || "defaults",
  };
}
async function defaultsStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const companyId = state.companyId as string;
  const tenantId = state.tenantId as string;
  const locale = state.locale as ReturnType<typeof resolveLocaleDefaults>;

  const seed = await seedTenantDefaults(sb, {
    companyId,
    tenantId,
    organizationName: input.organization_name,
    adminEmail: input.admin_email,
    industry: input.industry || null,
    countryName: locale.countryName,
  });
  return {
    notes: seed.notes,
    detail: seed.notes.join("; ").slice(0, 500) || "seeded",
  };
}

async function wizardStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const companyId = ctx.state.companyId as string;
  const rows = buildWizardRows(tenantId, companyId);
  const { error } = await ctx.sb
    .from("tenant_setup_progress")
    .upsert(rows, { onConflict: "tenant_id,step_key" });
  if (error) throw new Error("Wizard seed failed: " + error.message);
  return { count: rows.length, detail: rows.length + " steps" };
}

async function eventStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const tenantId = state.tenantId as string;
  const companyId = state.companyId as string;
  const plan = (state.plan as string) || "starter";
  const slug = state.slug as string;
  const { error } = await sb.from("domain_events").insert({
    event_type: "tenant.provisioned",
    aggregate_type: "tenant",
    aggregate_id: tenantId,
    tenant_id: tenantId,
    company_id: companyId,
    actor_id: ctx.actorId || null,
    payload: {
      organization_name: input.organization_name,
      admin_email: input.admin_email,
      plan_code: plan,
      slug,
      industry: input.industry || null,
      template_code: ctx.template?.template_code || (ctx.input as ProvisioningRequest).template_code || null,
      onboarding_version: 3,
    },
    source_module: "platform-provisioning",
    severity: "info",
  });
  if (error) throw new Error("Domain event emit failed: " + error.message);
  return { eventType: "tenant.provisioned", detail: "published" };
}

async function adminStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { sb, input, state } = ctx;
  const tenantId = state.tenantId as string;
  const companyId = state.companyId as string;
  const password = input.admin_password;
  if (!password) {
    throw new Error(
      "Administrator password is required to create the admin user — supply it on retry"
    );
  }

  if (typeof sb.auth.admin?.createUser !== "function") {
    throw new Error("Service role required for auth.admin user creation");
  }

  const { data: created, error: uErr } = await sb.auth.admin.createUser({
    email: input.admin_email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.admin_name || "Administrator",
      tenant_id: tenantId,
    },
  });
  if (uErr) throw uErr;
  const adminUserId = created.user?.id || null;

  const { data: role } = await sb
    .from("roles")
    .select("id")
    .eq("slug", "super_administrator")
    .maybeSingle();

  if (adminUserId && role?.id) {
    const names = (input.admin_name || "Tenant Admin").split(" ");
    const { error: profileErr } = await sb.from("user_profiles").upsert({
      id: adminUserId,
      company_id: companyId,
      active_company_id: companyId,
      tenant_id: tenantId,
      role_id: role.id,
      first_name: names[0] || "Admin",
      last_name: names.slice(1).join(" ") || "User",
      email: input.admin_email,
      is_active: true,
      is_platform_admin: false,
      // Self-chosen password at signup — no forced reset
      must_change_password: false,
    });
    if (profileErr) {
      throw new Error(
        "Admin profile could not be created: " + profileErr.message
      );
    }

    const { error: membershipErr } = await sb
      .from("user_company_memberships")
      .upsert(
        {
          user_id: adminUserId,
          company_id: companyId,
          tenant_id: tenantId,
          role_id: role.id,
          is_default: true,
          status: "active",
        },
        { onConflict: "user_id,company_id" }
      );
    if (membershipErr) {
      throw new Error(
        "Admin membership could not be created: " + membershipErr.message
      );
    }

    const { error: progressErr } = await sb
      .from("tenant_setup_progress")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("step_key", "admin");
    if (progressErr) {
      throw new Error(
        "Setup progress could not be marked complete: " + progressErr.message
      );
    }
  } else if (adminUserId && !role?.id) {
    throw new Error(
      "super_administrator role is missing — seed roles before provisioning"
    );
  }

  ctx.state.adminUserId = adminUserId;
  return { adminUserId, detail: adminUserId || "created" };
}

const adminCompensate = async (ctx: ProvisioningContext, step: ProvisioningStepRow) => {
  const userId = (step.output_json?.adminUserId as string) || undefined;
  if (!userId) return;
  try {
    await ctx.sb.auth.admin?.deleteUser(userId);
  } catch {
    /* best effort */
  }
};

async function welcomeStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const { input, state } = ctx;
  const plan = (state.plan as string) || "starter";
  const slug = state.slug as string;
  try {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    const base = appUrl.startsWith("http") ? appUrl : "https://" + appUrl;
    const welcome = await sendTenantWelcomeEmail({
      to: input.admin_email,
      adminName: input.admin_name,
      organizationName: input.organization_name,
      planCode: plan,
      slug,
      loginUrl: base + "/login",
      setupUrl: base + "/dashboard/settings/setup",
    });
    return {
      sent: welcome.sent,
      error: welcome.error || null,
      detail: welcome.sent ? "sent" : welcome.error || "skipped",
    };
  } catch (e) {
    return {
      sent: false,
      error: e instanceof Error ? e.message : "email failed",
      detail: "skipped",
    };
  }
}

async function readyStep(ctx: ProvisioningContext): Promise<Record<string, unknown>> {
  const tenantId = ctx.state.tenantId as string;
  const isTrial = Boolean(ctx.state.isTrial);
  const status = isTrial ? "trial" : "active";

  const { data: tenant } = await ctx.sb
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const settings = {
    ...((tenant?.settings as Record<string, unknown>) || {}),
    provisioned: true,
    provisioned_at: new Date().toISOString(),
  };
  const { error } = await ctx.sb
    .from("tenants")
    .update({ status, settings, updated_at: new Date().toISOString() })
    .eq("id", tenantId);
  if (error) throw new Error("Tenant activate failed: " + error.message);

  return { ready: true, status, detail: status };
}
// ---------------------------------------------------------------------------
// Execution graph (ordered provisioning pipeline)
// ---------------------------------------------------------------------------
export const STEP_GRAPH: ProvisioningStepDef[] = [
  { key: "preflight", label: "Preflight checks", group: "bootstrap", sort: 1, retryable: false, run: preflightStep },
  { key: "tenant", label: "Create tenant namespace", group: "bootstrap", sort: 2, run: tenantStep, compensate: tenantCompensate },
  { key: "crypto", label: "Generate encryption keys", group: "bootstrap", sort: 3, run: cryptoStep, compensate: cryptoCompensate },
  { key: "isolation", label: "Enforce tenant isolation", group: "bootstrap", sort: 4, run: isolationStep },
  { key: "company", label: "Create primary company", group: "bootstrap", sort: 5, run: companyStep, compensate: companyCompensate },
  { key: "branch", label: "Create HQ branch", group: "bootstrap", sort: 6, run: branchStep },
  { key: "subscription", label: "Activate subscription", group: "bootstrap", sort: 7, run: subscriptionStep, compensate: subscriptionCompensate },
  { key: "modules", label: "Install modules", group: "bootstrap", sort: 8, run: modulesStep },
  { key: "flags", label: "Apply feature flags", group: "bootstrap", sort: 9, run: flagsStep },
  { key: "api_keys", label: "Generate API credentials", group: "bootstrap", sort: 10, run: apiKeysStep, compensate: apiKeysCompensate },
  { key: "security", label: "Apply security baseline", group: "bootstrap", sort: 11, run: securityStep },
  { key: "defaults", label: "Seed operational defaults", group: "bootstrap", sort: 12, run: defaultsStep },
  { key: "wizard", label: "Generate setup wizard", group: "admin", sort: 13, run: wizardStep },
  { key: "event", label: "Emit provisioned event", group: "admin", sort: 14, run: eventStep },
  { key: "admin", label: "Create administrator", group: "admin", sort: 15, run: adminStep, compensate: adminCompensate },
  { key: "welcome", label: "Send welcome email", group: "finish", sort: 16, retryable: false, run: welcomeStep },
  { key: "ready", label: "Tenant ready", group: "finish", sort: 17, retryable: false, run: readyStep },
];

// ---------------------------------------------------------------------------
// Job creation
// ---------------------------------------------------------------------------
export async function createProvisioningJob(
  sb: SupabaseClient,
  input: ProvisioningRequest,
  opts?: { actorId?: string; correlationId?: string }
): Promise<{ job: ProvisioningJobRow; jobId: string }> {
  const pwdCheck = validateAdminPassword(input.admin_password || "");
  if (!pwdCheck.ok) {
    throw new Error(pwdCheck.errors[0] || "Invalid administrator password");
  }
  if (!input.admin_email?.trim()) {
    throw new Error("Administrator email is required");
  }

  await allocateUniqueSlug(sb, input.slug || input.organization_name);
  const locale = resolveLocaleDefaults({
    country_code: input.country_code,
    currency: input.currency,
    timezone: input.timezone,
  });
  const plan = input.plan_code || "starter";
  const templateCode = resolveTemplateCode(input);
  const tenantNumber = await nextTenantNumber(sb, locale.country_code);
  const jobCode = generateJobCode();
  const correlationId = opts?.correlationId || null;

  const { data: job, error } = await sb
    .from("tenant_provisioning_jobs")
    .insert({
      job_code: jobCode,
      status: "pending",
      organization_name: input.organization_name,
      admin_email: input.admin_email,
      admin_name: input.admin_name || "Administrator",
      country_code: locale.country_code,
      currency: locale.currency,
      plan_code: plan,
      template_code: templateCode,
      kind: "provision",
      provisioning_mode: "full",
      attempt: 1,
      max_attempts: 3,
      phase: "queued",
      checkpoint_json: { completed_keys: [], phase: "queued" },
      inputs_json: sanitizeProvisionInput(input),
      tenant_number: tenantNumber,
      actor_id: opts?.actorId || null,
      correlation_id: correlationId,
      started_at: new Date().toISOString(),
      steps_json: [],
    })
    .select("*")
    .single();
  if (error || !job) throw error || new Error("Provisioning job create failed");

  await sb.from("provisioning_steps").insert(
    STEP_GRAPH.map((s) => ({
      job_id: job.id,
      step_key: s.key,
      step_label: s.label,
      group_key: s.group,
      sort_order: s.sort,
      status: "pending",
      attempt: 0,
      retry_count: 0,
    }))
  );

  await logJobEvent(sb, job.id, "job.created", "Provisioning job queued for " + input.organization_name, {
    template_code: templateCode,
    plan_code: plan,
    tenant_number: tenantNumber,
    industry_pack: input.industry_pack || null,
  });

  return { job: job as ProvisioningJobRow, jobId: job.id };
}

// ---------------------------------------------------------------------------
// Checkpointed execution
// ---------------------------------------------------------------------------
async function reloadJob(sb: SupabaseClient, jobId: string): Promise<ProvisioningJobRow> {
  const { data } = await sb.from("tenant_provisioning_jobs").select("*").eq("id", jobId).single();
  return data as ProvisioningJobRow;
}

async function reloadSteps(sb: SupabaseClient, jobId: string): Promise<ProvisioningStepRow[]> {
  const { data } = await sb
    .from("provisioning_steps")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true });
  return (data || []) as ProvisioningStepRow[];
}

async function markStepRunning(
  sb: SupabaseClient,
  stepRow: ProvisioningStepRow | undefined
) {
  if (!stepRow) return;
  await sb
    .from("provisioning_steps")
    .update({
      status: "running",
      attempt: (stepRow.attempt || 0) + 1,
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", stepRow.id);
}

function collectSecrets(ctx: ProvisioningContext): ProvisioningRunResult["secrets"] {
  const secrets = (ctx.state.__secrets as Record<string, unknown>) || {};
  return {
    encryption_secret_b64:
      typeof secrets.encryption_secret_b64 === "string"
        ? secrets.encryption_secret_b64
        : undefined,
    api_key_secret:
      typeof secrets.api_key_secret === "string" ? secrets.api_key_secret : undefined,
    api_key_prefix:
      typeof secrets.api_key_prefix === "string" ? secrets.api_key_prefix : undefined,
  };
}

function buildResult(ctx: ProvisioningContext): Record<string, unknown> {
  const locale = ctx.state.locale as
    | ReturnType<typeof resolveLocaleDefaults>
    | undefined;
  return {
    tenant_id: ctx.state.tenantId || null,
    company_id: ctx.state.companyId || null,
    branch_id: ctx.state.branchId || null,
    slug: ctx.state.slug || null,
    domain: ctx.state.domain || null,
    language: ctx.state.language || ctx.input.language || "en",
    data_region: ctx.state.dataRegion || ctx.input.data_region || "eu-west-1",
    plan_code: ctx.state.plan || ctx.input.plan_code || "starter",
    tenant_number: ctx.job.tenant_number,
    admin_user_id: ctx.state.adminUserId || null,
    admin_email: ctx.input.admin_email,
    timezone: locale?.timezone || ctx.input.timezone || null,
    currency: locale?.currency || ctx.input.currency || null,
    setup_path: "/dashboard/settings/setup",
  };
}

/** Best-effort reverse-order rollback of completed steps (permanent failures). */
async function compensate(
  ctx: ProvisioningContext,
  steps: ProvisioningStepRow[],
  completedKeys: Set<string>
) {
  const completed = STEP_GRAPH.filter(
    (d) => completedKeys.has(d.key) && typeof d.compensate === "function"
  ).sort((a, b) => b.sort - a.sort);
  for (const def of completed) {
    const stepRow = steps.find((s) => s.step_key === def.key);
    if (!stepRow) continue;
    try {
      await def.compensate!(ctx, stepRow);
    } catch {
      /* best effort */
    }
  }
}

async function failJob(
  sb: SupabaseClient,
  job: ProvisioningJobRow,
  ctx: ProvisioningContext,
  message: string,
  completedKeys: Set<string>,
  retryable: boolean
) {
  const attempt = job.attempt || 1;
  const nextRetryAt = retryable
    ? new Date(
        Date.now() + Math.min(3_600_000, 30_000 * Math.pow(2, attempt - 1))
      ).toISOString()
    : null;

  if (!retryable) {
    // Permanent failure: suspend the tenant so a half-provisioned namespace
    // can never be mistaken for a live one. Completed steps were rolled back
    // by compensate() before this call.
    const tenantId = ctx.state.tenantId as string | undefined;
    if (tenantId) {
      try {
        const { data: tenant } = await sb
          .from("tenants")
          .select("settings")
          .eq("id", tenantId)
          .single();
        const settings = {
          ...((tenant?.settings as Record<string, unknown>) || {}),
          provisioned: false,
          provision_error: message.slice(0, 500),
        };
        await sb
          .from("tenants")
          .update({
            status: "suspended",
            settings,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);
      } catch {
        /* best effort */
      }
    }
  }

  await sb
    .from("tenant_provisioning_jobs")
    .update({
      status: "failed",
      phase: "failed",
      error_message: message.slice(0, 2000),
      error_class: retryable ? "retryable" : "permanent",
      next_retry_at: nextRetryAt,
      duration_ms: Date.now() - ctx.startedAt,
      completed_at: new Date().toISOString(),
      checkpoint_json: { completed_keys: [...completedKeys], phase: "failed" },
    })
    .eq("id", job.id);

  await logJobEvent(sb, job.id, "job.failed", "Provisioning failed: " + message, {
    retryable,
    attempt,
  }, "error");
}

export async function runProvisioningJob(
  sb: SupabaseClient,
  jobId: string,
  opts?: { adminPassword?: string }
): Promise<ProvisioningRunResult> {
  const { data: jobRow, error: jobErr } = await sb
    .from("tenant_provisioning_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr || !jobRow) throw jobErr || new Error("Provisioning job not found");

  const job = jobRow as ProvisioningJobRow;
  const steps = await reloadSteps(sb, jobId);
  const checkpoint = (job.checkpoint_json as {
    completed_keys?: string[];
    phase?: string;
  }) || { completed_keys: [], phase: "queued" };
  const completedKeys = new Set(checkpoint.completed_keys || []);

  // Rebuild in-memory state from completed step outputs. One-time secrets are
  // deliberately NOT rebuilt — they were vaulted at create time and are only
  // returned again if a step regenerates them.
  const state: Record<string, unknown> = {};
  for (const step of steps) {
    if (completedKeys.has(step.step_key) && step.output_json) {
      Object.assign(state, step.output_json);
    }
  }

  const rawInput = {
    ...((job.inputs_json as Record<string, unknown>) || {}),
    ...(opts?.adminPassword ? { admin_password: opts.adminPassword } : {}),
  } as ProvisioningRequest;

  const templateCode = job.template_code || resolveTemplateCode(rawInput);
  const effective = await loadEffectiveConfig(
    sb,
    templateCode,
    rawInput.industry_pack
  );
  const startedAt = Date.now();

  const ctx: ProvisioningContext = {
    sb,
    job,
    input: rawInput as ProvisionTenantInput,
    template: effective.template,
    templateConfig: effective.config,
    state,
    actorId: job.actor_id,
    correlationId: job.correlation_id,
    startedAt,
  };

  await sb
    .from("tenant_provisioning_jobs")
    .update({
      status: "running",
      phase: "running",
      started_at: new Date().toISOString(),
      next_retry_at: null,
    })
    .eq("id", jobId);
  await logJobEvent(sb, jobId, "job.started", "Provisioning run started");

  for (const def of STEP_GRAPH) {
    if (completedKeys.has(def.key)) continue;
    const stepRow = steps.find((s) => s.step_key === def.key);

    try {
      await markStepRunning(sb, stepRow);
      const started = Date.now();
      const output = await def.run(ctx);
      const durationMs = Date.now() - started;

      Object.assign(ctx.state, output);
      const persisted = stripSecrets(output);
      if (stepRow) {
        await sb
          .from("provisioning_steps")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            detail:
              typeof output.detail === "string"
                ? output.detail.slice(0, 500)
                : null,
            output_json: persisted,
          })
          .eq("id", stepRow.id);
      }
      completedKeys.add(def.key);
      await sb
        .from("tenant_provisioning_jobs")
        .update({
          checkpoint_json: {
            completed_keys: [...completedKeys],
            phase: def.group,
          },
          phase: def.group,
        })
        .eq("id", jobId);
      await logJobEvent(sb, jobId, "step.completed", def.label + " completed", {
        step_key: def.key,
        duration_ms: durationMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (stepRow) {
        await sb
          .from("provisioning_steps")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: msg.slice(0, 1000),
          })
          .eq("id", stepRow.id);
      }
      await logJobEvent(sb, jobId, "step.failed", def.label + " failed: " + msg, {
        step_key: def.key,
      }, "error");

      const attempt = job.attempt || 1;
      const maxAttempts = job.max_attempts || 3;
      const retryable =
        def.retryable !== false && attempt < maxAttempts;

      if (!retryable) {
        await compensate(ctx, steps, completedKeys);
      }
      await failJob(sb, job, ctx, msg, completedKeys, retryable);

      return {
        job: await reloadJob(sb, jobId),
        steps: await reloadSteps(sb, jobId),
        tenantId: (ctx.state.tenantId as string) || null,
        error_message: msg,
      };
    }
  }

  // Success
  const tenantId = (ctx.state.tenantId as string) || null;
  const companyId = (ctx.state.companyId as string) || null;
  const durationMs = Date.now() - startedAt;
  await sb
    .from("tenant_provisioning_jobs")
    .update({
      status: "completed",
      phase: "completed",
      tenant_id: tenantId,
      company_id: companyId,
      checkpoint_json: { completed_keys: [...completedKeys], phase: "completed" },
      result_json: buildResult(ctx),
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  await logJobEvent(sb, jobId, "job.completed", "Provisioning completed in " + durationMs + "ms", {
    duration_ms: durationMs,
  });

  return {
    job: await reloadJob(sb, jobId),
    steps: await reloadSteps(sb, jobId),
    tenantId,
    companyId,
    tenantNumber: job.tenant_number,
    slug: (ctx.state.slug as string) || null,
    domain: (ctx.state.domain as string) || null,
    adminUserId: (ctx.state.adminUserId as string) || null,
    secrets: collectSecrets(ctx),
  };
}

// ---------------------------------------------------------------------------
// Retry — resumes from the first incomplete step (checkpoint preserved).
// A failed run leaves completed steps in place so a retry never re-creates
// namespaces it already owns; compensation only runs on permanent failure.
// ---------------------------------------------------------------------------
export async function retryProvisioningJob(
  sb: SupabaseClient,
  jobId: string,
  opts?: { actorId?: string; adminPassword?: string }
): Promise<ProvisioningRunResult> {
  const { data: jobRow, error } = await sb
    .from("tenant_provisioning_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !jobRow) throw error || new Error("Provisioning job not found");
  const job = jobRow as ProvisioningJobRow;

  const nextAttempt = (job.attempt || 1) + 1;
  const maxAttempts = job.max_attempts || 3;
  if (nextAttempt > maxAttempts) {
    throw new Error(
      "Maximum retry attempts (" + maxAttempts + ") reached — create a new job"
    );
  }
  if (opts?.adminPassword) {
    const pwdCheck = validateAdminPassword(opts.adminPassword);
    if (!pwdCheck.ok) {
      throw new Error(pwdCheck.errors[0] || "Invalid administrator password");
    }
  }

  const inputs = { ...((job.inputs_json as Record<string, unknown>) || {}) };
  if (opts?.adminPassword) inputs.admin_password = opts.adminPassword;

  await sb
    .from("tenant_provisioning_jobs")
    .update({
      status: "pending",
      attempt: nextAttempt,
      phase: "queued",
      inputs_json: sanitizeProvisionInput(inputs as ProvisioningRequest),
      error_message: null,
      error_class: null,
      next_retry_at: null,
      completed_at: null,
      duration_ms: null,
      actor_id: opts?.actorId || job.actor_id,
    })
    .eq("id", jobId);

  // Reset failed/running steps back to pending; completed steps keep their
  // checkpoint so the run resumes where it left off.
  await sb
    .from("provisioning_steps")
    .update({ status: "pending", error_message: null })
    .eq("job_id", jobId)
    .in("status", ["failed", "running"]);

  await logJobEvent(sb, jobId, "job.retried", "Provisioning job retried (attempt " + nextAttempt + ")", {
    attempt: nextAttempt,
  });

  return runProvisioningJob(sb, jobId, {
    adminPassword: opts?.adminPassword,
  });
}