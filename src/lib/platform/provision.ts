/**
 * Auto tenant provisioning for SecureTrack ERP.
 * Creates tenant → company → branch → admin membership → modules → flags →
 * sequences → security → setup wizard → welcome email.
 * Admin auth user creation is REQUIRED — provisioning fails if it cannot be created.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProvisionStep, ProvisionTenantInput, ProvisioningJob } from "./types";
import {
  allocateUniqueSlug,
  assertAdminEmailAvailable,
  buildWizardRows,
  resolveLocaleDefaults,
  seedTenantDefaults,
  validateAdminPassword,
} from "./onboarding";
import { sendTenantWelcomeEmail } from "./welcome-email";
import {
  generateTenantEncryptionKey,
  tenantDomainFromSlug,
  type TenantEnterpriseConfig,
} from "./tenant-crypto";

function jobCode() {
  const y = new Date().getFullYear();
  const r = Math.floor(Math.random() * 90000) + 10000;
  return `PROV-${y}-${r}`;
}

function step(
  key: string,
  label: string,
  status: ProvisionStep["status"],
  detail?: string
): ProvisionStep {
  return { key, label, status, detail, at: new Date().toISOString() };
}

async function markTenantFailed(
  sb: SupabaseClient,
  tenantId: string | null,
  message: string
) {
  if (!tenantId) return;
  try {
    await sb
      .from("tenants")
      .update({
        status: "suspended",
        settings: {
          product: "SecureTrack ERP",
          provisioned: false,
          provision_error: message.slice(0, 500),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
  } catch {
    /* best effort */
  }
}

export async function provisionTenant(
  sb: SupabaseClient,
  input: ProvisionTenantInput
): Promise<{
  job: ProvisioningJob;
  tenantId: string;
  companyId: string;
  steps: ProvisionStep[];
  loginHint?: string;
  /** One-time tenant encryption secret (vault immediately; never stored raw) */
  encryptionSecretOnce?: string | null;
  domain?: string;
}> {
  const pwdCheck = validateAdminPassword(input.admin_password || "");
  if (!pwdCheck.ok) {
    throw new Error(pwdCheck.errors[0] || "Invalid administrator password");
  }

  const steps: ProvisionStep[] = [];
  const code = jobCode();
  const locale = resolveLocaleDefaults({
    country_code: input.country_code,
    currency: input.currency,
    timezone: input.timezone,
  });
  const plan = input.plan_code || "starter";
  const country = locale.country_code;
  const currency = locale.currency;
  const timezone = locale.timezone;
  let tenantId: string | null = null;

  // Fail early before creating any tenant rows
  steps.push(step("preflight", "Preflight checks", "running"));
  await assertAdminEmailAvailable(sb, input.admin_email);
  const slug = await allocateUniqueSlug(
    sb,
    input.slug || input.organization_name
  );
  steps[steps.length - 1] = step(
    "preflight",
    "Preflight checks",
    "completed",
    `slug=${slug}`
  );

  const { data: jobRow, error: jobErr } = await sb
    .from("tenant_provisioning_jobs")
    .insert({
      job_code: code,
      status: "running",
      organization_name: input.organization_name,
      admin_email: input.admin_email,
      admin_name: input.admin_name || "Administrator",
      country_code: country,
      currency,
      plan_code: plan,
      started_at: new Date().toISOString(),
      steps_json: [],
    })
    .select("*")
    .single();

  if (jobErr || !jobRow) throw jobErr || new Error("Failed to create provisioning job");

  // One-time crypto material (secret returned only in provision result for vaulting)
  let oneTimeSecret: string | null = null;

  try {
    // 1. Tenant namespace + isolation config
    steps.push(step("tenant", "Create tenant namespace", "running"));
    const isTrial = plan === "starter";
    const crypto = generateTenantEncryptionKey();
    oneTimeSecret = crypto.secret_b64;
    const domain =
      input.domain?.trim() ||
      tenantDomainFromSlug(slug);
    const language = (input.language || "en").slice(0, 10);
    const dataRegion = (input.data_region || "eu-west-1").slice(0, 40);
    const compliance = (input.compliance_requirements || []).map(String);

    const enterpriseConfig: TenantEnterpriseConfig = {
      industry: input.industry || null,
      language,
      data_region: dataRegion,
      domain,
      compliance_requirements: compliance as TenantEnterpriseConfig["compliance_requirements"],
      encryption: {
        key_id: crypto.key_id,
        fingerprint: crypto.fingerprint,
        algorithm: crypto.algorithm,
      },
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

    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .insert({
        slug,
        name: input.organization_name,
        legal_name: input.organization_name,
        status: isTrial ? "trial" : "active",
        plan_code: plan,
        primary_currency: currency,
        country_code: country,
        timezone,
        primary_contact_email: input.admin_email,
        trial_ends_at: isTrial
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null,
        settings: {
          product: "SecureTrack ERP",
          provisioned: true,
          onboarding_version: 3,
          ...enterpriseConfig,
        },
      })
      .select("*")
      .single();
    if (tErr || !tenant) throw tErr || new Error("Tenant create failed");
    tenantId = tenant.id;
    steps[steps.length - 1] = step(
      "tenant",
      "Create tenant namespace",
      "completed",
      `${tenant.id} · ${domain}`
    );

    steps.push(step("crypto", "Generate tenant encryption key", "completed", crypto.key_id));
    steps.push(step("isolation", "Apply isolation controls", "completed", "RLS+storage+AI+reporting"));

    // 2. Company
    steps.push(step("company", "Create primary company", "running"));
    const companyCode = slug.toUpperCase().replace(/-/g, "").slice(0, 12) || "CO";
    const { data: company, error: cErr } = await sb
      .from("companies")
      .insert({
        name: input.organization_name,
        code: `${companyCode}-${String(Date.now()).slice(-4)}`,
        legal_name: input.organization_name,
        country: locale.countryName,
        tenant_id: tenant.id,
        is_primary: true,
        is_active: true,
        base_currency: currency,
        company_type: "operating",
      })
      .select("*")
      .single();
    if (cErr || !company) throw cErr || new Error("Company create failed");
    steps[steps.length - 1] = step(
      "company",
      "Create primary company",
      "completed",
      company.id
    );

    // 3. Branch
    steps.push(step("branch", "Create HQ branch", "running"));
    let branchId: string | null = null;
    try {
      const { data: branch } = await sb
        .from("branches")
        .insert({
          company_id: company.id,
          name: "Head Office",
          code: "HQ",
          city: country === "UG" ? "Kampala" : null,
          country: locale.countryName,
          is_active: true,
        })
        .select("id")
        .single();
      branchId = branch?.id || null;
      steps[steps.length - 1] = step(
        "branch",
        "Create HQ branch",
        "completed",
        branchId || undefined
      );
    } catch {
      steps[steps.length - 1] = step(
        "branch",
        "Create HQ branch",
        "skipped",
        "Branch table optional fields"
      );
    }

    // 4. Subscription + plan limits
    steps.push(step("subscription", "Activate subscription", "running"));
    const seats =
      input.seats ||
      (plan === "starter"
        ? 25
        : plan === "professional"
          ? 200
          : plan === "government"
            ? 5000
            : 1000);
    await sb.from("tenant_subscriptions").upsert(
      {
        tenant_id: tenant.id,
        plan_code: plan,
        status: isTrial ? "trial" : "active",
        seats,
        modules:
          plan === "enterprise" || plan === "government"
            ? ["all"]
            : input.modules || [],
        billing_email: input.admin_email,
        trial_ends_at: isTrial
          ? new Date(Date.now() + 30 * 86400000).toISOString()
          : null,
      },
      { onConflict: "tenant_id" }
    );
    steps[steps.length - 1] = step(
      "subscription",
      "Activate subscription",
      "completed",
      `${plan} · ${seats} seats`
    );

    // 5. Modules (plan-aware or explicit list)
    steps.push(step("modules", "Enable modules", "running"));
    const { data: mods } = await sb
      .from("platform_modules")
      .select("module_code, default_enabled, is_core");
    if (mods?.length) {
      const fullAccess = plan === "enterprise" || plan === "government";
      const allow = new Set(
        (input.modules || []).map((m) => m.toLowerCase())
      );
      await sb.from("tenant_modules").upsert(
        mods.map((m) => {
          const code = String(m.module_code);
          const enabled = fullAccess
            ? true
            : allow.size > 0
              ? allow.has(code.toLowerCase()) || m.is_core === true
              : m.is_core === true || m.default_enabled !== false;
          return {
            tenant_id: tenant.id,
            module_code: code,
            enabled,
          };
        }),
        { onConflict: "tenant_id,module_code" }
      );
    }
    steps[steps.length - 1] = step(
      "modules",
      "Enable modules",
      "completed",
      String(mods?.length || 0)
    );

    // 6. Feature flags
    steps.push(step("flags", "Apply feature flags", "running"));
    const { data: flags } = await sb
      .from("platform_feature_flags")
      .select("flag_key,default_enabled");
    if (flags?.length) {
      await sb.from("tenant_feature_flags").upsert(
        flags.map((f) => ({
          tenant_id: tenant.id,
          flag_key: f.flag_key,
          enabled: f.default_enabled !== false,
        })),
        { onConflict: "tenant_id,flag_key" }
      );
    }
    steps[steps.length - 1] = step("flags", "Apply feature flags", "completed");

    // 7. Default roles note (system roles are global; tenant admin assigned later)
    steps.push(
      step(
        "roles",
        "Default roles ready",
        "completed",
        "super_administrator + catalog roles available"
      )
    );

    // 8. Operational defaults (sequences, security, brand)
    steps.push(step("defaults", "Apply branding & defaults", "running"));
    const seed = await seedTenantDefaults(sb, {
      companyId: company.id,
      tenantId: tenant.id,
      organizationName: input.organization_name,
      adminEmail: input.admin_email,
      industry: input.industry,
      countryName: locale.countryName,
    });
    steps[steps.length - 1] = step(
      "defaults",
      "Seed operational defaults",
      "completed",
      seed.notes.join("; ")
    );

    // 8. Setup wizard steps
    steps.push(step("wizard", "Generate setup wizard", "running"));
    const wizardRows = buildWizardRows(tenant.id, company.id);
    await sb.from("tenant_setup_progress").upsert(wizardRows, {
      onConflict: "tenant_id,step_key",
    });
    steps[steps.length - 1] = step(
      "wizard",
      "Generate setup wizard",
      "completed",
      `${wizardRows.length} steps`
    );

    // 9. Domain event
    steps.push(step("event", "Emit provisioned event", "running"));
    await sb.from("domain_events").insert({
      event_type: "tenant.provisioned",
      aggregate_type: "tenant",
      aggregate_id: tenant.id,
      tenant_id: tenant.id,
      company_id: company.id,
      payload: {
        organization_name: input.organization_name,
        admin_email: input.admin_email,
        plan_code: plan,
        slug,
        industry: input.industry || null,
        onboarding_version: 2,
      },
      source_module: "platform",
      severity: "info",
    });
    steps[steps.length - 1] = step("event", "Emit provisioned event", "completed");

    // 10. Admin user (required)
    steps.push(step("admin", "Create administrator", "running"));
    let adminUserId: string | null = null;
    try {
      if (typeof sb.auth.admin?.createUser !== "function") {
        throw new Error("Service role required for auth.admin user creation");
      }
      const password = input.admin_password as string;
      const { data: created, error: uErr } = await sb.auth.admin.createUser({
        email: input.admin_email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: input.admin_name || "Administrator",
          tenant_id: tenant.id,
        },
      });
      if (uErr) throw uErr;
      adminUserId = created.user?.id || null;

      const { data: role } = await sb
        .from("roles")
        .select("id")
        .eq("slug", "super_administrator")
        .maybeSingle();

      if (adminUserId && role?.id) {
        const names = (input.admin_name || "Tenant Admin").split(" ");
        await sb.from("user_profiles").upsert({
          id: adminUserId,
          company_id: company.id,
          active_company_id: company.id,
          tenant_id: tenant.id,
          role_id: role.id,
          first_name: names[0] || "Admin",
          last_name: names.slice(1).join(" ") || "User",
          email: input.admin_email,
          is_active: true,
          is_platform_admin: false,
          // Self-chosen password at signup — no forced reset
          must_change_password: false,
        });

        await sb.from("user_company_memberships").upsert(
          {
            user_id: adminUserId,
            company_id: company.id,
            tenant_id: tenant.id,
            role_id: role.id,
            is_default: true,
            status: "active",
          },
          { onConflict: "user_id,company_id" }
        );

        await sb
          .from("tenant_setup_progress")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant.id)
          .eq("step_key", "admin");
      } else if (adminUserId && !role?.id) {
        throw new Error(
          "super_administrator role is missing — seed roles before provisioning"
        );
      }

      steps[steps.length - 1] = step(
        "admin",
        "Create administrator",
        "completed",
        adminUserId || "created"
      );
    } catch (e) {
      steps[steps.length - 1] = step(
        "admin",
        "Create administrator",
        "failed",
        e instanceof Error ? e.message : "Admin create failed"
      );
      throw e;
    }

    // 11. Welcome email (non-blocking)
    steps.push(step("welcome", "Send welcome email", "running"));
    try {
      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_URL ||
        "http://localhost:3000"
      ).replace(/\/$/, "");
      const base =
        appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
      const welcome = await sendTenantWelcomeEmail({
        to: input.admin_email,
        adminName: input.admin_name,
        organizationName: input.organization_name,
        planCode: plan,
        slug,
        loginUrl: `${base}/login`,
        setupUrl: `${base}/dashboard/settings/setup`,
      });
      steps[steps.length - 1] = step(
        "welcome",
        "Send welcome email",
        welcome.sent ? "completed" : "skipped",
        welcome.sent ? "sent" : welcome.error || "skipped"
      );
    } catch (e) {
      steps[steps.length - 1] = step(
        "welcome",
        "Send welcome email",
        "skipped",
        e instanceof Error ? e.message : "email failed"
      );
    }

    steps.push(step("ready", "Tenant ready", "completed", "workflow complete"));

    const result = {
      tenant_id: tenant.id,
      company_id: company.id,
      branch_id: branchId,
      slug,
      domain,
      language,
      data_region: dataRegion,
      encryption_key_id: crypto.key_id,
      encryption_fingerprint: crypto.fingerprint,
      // Secret only in memory for this response path via encryptionSecretOnce
      admin_user_id: adminUserId,
      admin_email: input.admin_email,
      plan_code: plan,
      timezone,
      currency,
      setup_path: "/dashboard/settings/setup",
    };

    const { data: done } = await sb
      .from("tenant_provisioning_jobs")
      .update({
        status: "completed",
        tenant_id: tenant.id,
        company_id: company.id,
        steps_json: steps,
        result_json: result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobRow.id)
      .select("*")
      .single();

    return {
      job: (done || jobRow) as ProvisioningJob,
      tenantId: tenant.id,
      companyId: company.id,
      steps,
      loginHint: input.admin_email,
      encryptionSecretOnce: oneTimeSecret,
      domain,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provisioning failed";
    await markTenantFailed(sb, tenantId, msg);
    await sb
      .from("tenant_provisioning_jobs")
      .update({
        status: "failed",
        steps_json: steps,
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobRow.id);
    throw e;
  }
}
