/**
 * Auto tenant provisioning for SecureTrack ERP.
 * Creates tenant → company → branch → admin membership → modules → flags → setup wizard.
 * Admin auth user is created when service role is available (API route).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProvisionStep, ProvisionTenantInput, ProvisioningJob } from "./types";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || `tenant-${Date.now()}`;
}

function jobCode() {
  const y = new Date().getFullYear();
  const r = Math.floor(Math.random() * 90000) + 10000;
  return `PROV-${y}-${r}`;
}

function step(key: string, label: string, status: ProvisionStep["status"], detail?: string): ProvisionStep {
  return { key, label, status, detail, at: new Date().toISOString() };
}

export async function provisionTenant(
  sb: SupabaseClient,
  input: ProvisionTenantInput
): Promise<{ job: ProvisioningJob; tenantId: string; companyId: string; steps: ProvisionStep[] }> {
  const steps: ProvisionStep[] = [];
  const code = jobCode();
  const slug = input.slug || slugify(input.organization_name);
  const plan = input.plan_code || "enterprise";
  const country = input.country_code || "UG";
  const currency = input.currency || "UGX";

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

  try {
    // 1. Tenant
    steps.push(step("tenant", "Create tenant", "running"));
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .insert({
        slug,
        name: input.organization_name,
        legal_name: input.organization_name,
        status: "active",
        plan_code: plan,
        primary_currency: currency,
        country_code: country,
        primary_contact_email: input.admin_email,
        settings: { product: "SecureTrack ERP", provisioned: true },
      })
      .select("*")
      .single();
    if (tErr || !tenant) throw tErr || new Error("Tenant create failed");
    steps[steps.length - 1] = step("tenant", "Create tenant", "completed", tenant.id);

    // 2. Company
    steps.push(step("company", "Create primary company", "running"));
    const companyCode = slug.toUpperCase().replace(/-/g, "").slice(0, 12) || "CO";
    const { data: company, error: cErr } = await sb
      .from("companies")
      .insert({
        name: input.organization_name,
        code: `${companyCode}-${String(Date.now()).slice(-4)}`,
        legal_name: input.organization_name,
        country: country === "UG" ? "Uganda" : country,
        tenant_id: tenant.id,
        is_primary: true,
        is_active: true,
        base_currency: currency,
        company_type: "operating",
      })
      .select("*")
      .single();
    if (cErr || !company) throw cErr || new Error("Company create failed");
    steps[steps.length - 1] = step("company", "Create primary company", "completed", company.id);

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
          country: country === "UG" ? "Uganda" : country,
          is_active: true,
        })
        .select("id")
        .single();
      branchId = branch?.id || null;
      steps[steps.length - 1] = step("branch", "Create HQ branch", "completed", branchId || undefined);
    } catch {
      steps[steps.length - 1] = step("branch", "Create HQ branch", "skipped", "Branch table optional fields");
    }

    // 4. Subscription
    steps.push(step("subscription", "Activate subscription", "running"));
    await sb.from("tenant_subscriptions").upsert(
      {
        tenant_id: tenant.id,
        plan_code: plan,
        status: plan === "starter" ? "trial" : "active",
        seats: plan === "starter" ? 25 : plan === "professional" ? 200 : 1000,
        modules: plan === "enterprise" || plan === "government" ? ["all"] : [],
        billing_email: input.admin_email,
        trial_ends_at:
          plan === "starter"
            ? new Date(Date.now() + 30 * 86400000).toISOString()
            : null,
      },
      { onConflict: "tenant_id" }
    );
    steps[steps.length - 1] = step("subscription", "Activate subscription", "completed", plan);

    // 5. Modules
    steps.push(step("modules", "Enable modules", "running"));
    const { data: mods } = await sb.from("platform_modules").select("module_code");
    if (mods?.length) {
      await sb.from("tenant_modules").upsert(
        mods.map((m) => ({
          tenant_id: tenant.id,
          module_code: m.module_code,
          enabled: true,
        })),
        { onConflict: "tenant_id,module_code" }
      );
    }
    steps[steps.length - 1] = step("modules", "Enable modules", "completed", String(mods?.length || 0));

    // 6. Feature flags
    steps.push(step("flags", "Apply feature flags", "running"));
    const { data: flags } = await sb.from("platform_feature_flags").select("flag_key,default_enabled");
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

    // 7. Setup wizard steps
    steps.push(step("wizard", "Generate setup wizard", "running"));
    const wizardSteps = [
      { key: "tenant", label: "Tenant created", order: 1 },
      { key: "company", label: "Company configured", order: 2 },
      { key: "branch", label: "Branch / HQ", order: 3 },
      { key: "admin", label: "Administrator account", order: 4 },
      { key: "roles", label: "Roles & permissions", order: 5 },
      { key: "modules", label: "Modules enabled", order: 6 },
      { key: "branding", label: "Branding & templates", order: 7 },
      { key: "sequences", label: "Number sequences", order: 8 },
      { key: "security", label: "Security policies", order: 9 },
      { key: "go_live", label: "Go-live checklist", order: 10 },
    ];
    await sb.from("tenant_setup_progress").upsert(
      wizardSteps.map((s) => ({
        tenant_id: tenant.id,
        company_id: company.id,
        step_key: s.key,
        step_label: s.label,
        sort_order: s.order,
        status: ["tenant", "company", "branch", "modules"].includes(s.key)
          ? "completed"
          : "pending",
        completed_at: ["tenant", "company", "branch", "modules"].includes(s.key)
          ? new Date().toISOString()
          : null,
      })),
      { onConflict: "tenant_id,step_key" }
    );
    steps[steps.length - 1] = step("wizard", "Generate setup wizard", "completed");

    // 8. Domain event
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
      },
      source_module: "platform",
      severity: "info",
    });
    steps[steps.length - 1] = step("event", "Emit provisioned event", "completed");

    // 9. Admin user (if service role supports auth.admin)
    steps.push(step("admin", "Create administrator", "running"));
    let adminUserId: string | null = null;
    try {
      if (typeof sb.auth.admin?.createUser === "function") {
        const password =
          input.admin_password ||
          `St${Math.random().toString(36).slice(2, 8)}!${Date.now().toString().slice(-4)}`;
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

        // Resolve super_administrator or any system role
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
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("tenant_id", tenant.id)
            .eq("step_key", "admin");
        }

        steps[steps.length - 1] = step(
          "admin",
          "Create administrator",
          "completed",
          adminUserId || "created"
        );

        // Store temp password only in job result (not returned to browser unless API allows)
        (jobRow as { _tempPassword?: string })._tempPassword = password;
      } else {
        steps[steps.length - 1] = step(
          "admin",
          "Create administrator",
          "skipped",
          "Service role required for auth.admin"
        );
      }
    } catch (e) {
      steps[steps.length - 1] = step(
        "admin",
        "Create administrator",
        "failed",
        e instanceof Error ? e.message : "Admin create failed"
      );
    }

    const result = {
      tenant_id: tenant.id,
      company_id: company.id,
      branch_id: branchId,
      slug,
      admin_user_id: adminUserId,
      admin_email: input.admin_email,
      plan_code: plan,
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
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provisioning failed";
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
