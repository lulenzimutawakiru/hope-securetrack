/**
 * Tenant onboarding — wizard definitions, locale defaults, password rules,
 * and post-provision seed helpers shared by provision + setup APIs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetupStep } from "./types";

export type WizardStepDef = {
  key: string;
  label: string;
  description: string;
  /** Dashboard path the admin should visit to complete this step */
  href: string;
  sort_order: number;
  /** Auto-completed during provision when true */
  autoComplete: boolean;
};

/** Canonical go-live checklist for every new tenant */
export const TENANT_WIZARD_STEPS: WizardStepDef[] = [
  {
    key: "tenant",
    label: "Tenant created",
    description: "Organization and subscription are live on the platform.",
    href: "/dashboard/settings/company",
    sort_order: 1,
    autoComplete: true,
  },
  {
    key: "company",
    label: "Company configured",
    description: "Primary legal entity, currency, and country are set.",
    href: "/dashboard/settings/company",
    sort_order: 2,
    autoComplete: true,
  },
  {
    key: "branch",
    label: "Branch / HQ",
    description: "Head office branch is ready; add more sites as needed.",
    href: "/dashboard/settings/branches",
    sort_order: 3,
    autoComplete: true,
  },
  {
    key: "admin",
    label: "Administrator account",
    description: "Your admin user can sign in and manage the tenant.",
    href: "/dashboard/settings/profile",
    sort_order: 4,
    autoComplete: true,
  },
  {
    key: "roles",
    label: "Roles & permissions",
    description: "Review default roles and invite your leadership team.",
    href: "/dashboard/identity",
    sort_order: 5,
    autoComplete: true,
  },
  {
    key: "modules",
    label: "Modules enabled",
    description: "Core ERP modules and feature flags are activated for your plan.",
    href: "/dashboard/settings/modules",
    sort_order: 6,
    autoComplete: true,
  },
  {
    key: "sequences",
    label: "Number sequences",
    description: "Document numbering (PO, INV, GRN, …) is seeded — customize prefixes.",
    href: "/dashboard/settings/numbering",
    sort_order: 7,
    autoComplete: true,
  },
  {
    key: "security",
    label: "Security policies",
    description: "Password, session, and MFA defaults are in place — review and tighten.",
    href: "/dashboard/settings/security",
    sort_order: 8,
    autoComplete: true,
  },
  {
    key: "branding",
    label: "Branding & templates",
    description: "Add logos, colours, and email branding for customer-facing docs.",
    href: "/dashboard/settings/branding",
    sort_order: 9,
    autoComplete: false,
  },
  {
    key: "team",
    label: "Invite your team",
    description: "Create users for finance, HR, operations, and auditors.",
    href: "/dashboard/identity",
    sort_order: 10,
    autoComplete: false,
  },
  {
    key: "go_live",
    label: "Go-live checklist",
    description: "Confirm fiscal year, tax IDs, and first operational transaction.",
    href: "/dashboard/settings/company",
    sort_order: 11,
    autoComplete: false,
  },
];

export const COUNTRY_DEFAULTS: Record<
  string,
  { currency: string; timezone: string; countryName: string }
> = {
  UG: { currency: "UGX", timezone: "Africa/Kampala", countryName: "Uganda" },
  KE: { currency: "KES", timezone: "Africa/Nairobi", countryName: "Kenya" },
  TZ: { currency: "TZS", timezone: "Africa/Dar_es_Salaam", countryName: "Tanzania" },
  RW: { currency: "RWF", timezone: "Africa/Kigali", countryName: "Rwanda" },
  BI: { currency: "BIF", timezone: "Africa/Bujumbura", countryName: "Burundi" },
  NG: { currency: "NGN", timezone: "Africa/Lagos", countryName: "Nigeria" },
  GH: { currency: "GHS", timezone: "Africa/Accra", countryName: "Ghana" },
  ZA: { currency: "ZAR", timezone: "Africa/Johannesburg", countryName: "South Africa" },
  US: { currency: "USD", timezone: "America/New_York", countryName: "United States" },
  GB: { currency: "GBP", timezone: "Europe/London", countryName: "United Kingdom" },
  AE: { currency: "AED", timezone: "Asia/Dubai", countryName: "United Arab Emirates" },
  IN: { currency: "INR", timezone: "Asia/Kolkata", countryName: "India" },
};

export function resolveLocaleDefaults(input: {
  country_code?: string;
  currency?: string;
  timezone?: string;
}) {
  const code = (input.country_code || "UG").toUpperCase().slice(0, 5);
  const base = COUNTRY_DEFAULTS[code] || {
    currency: "USD",
    timezone: "UTC",
    countryName: code,
  };
  return {
    country_code: code,
    currency: (input.currency || base.currency).toUpperCase().slice(0, 10),
    timezone: input.timezone || base.timezone,
    countryName: base.countryName,
  };
}

export type PasswordValidation = {
  ok: boolean;
  errors: string[];
  score: number;
};

/** Align with default security_policies (min 10, upper, number, special preferred). */
export function validateAdminPassword(password: string): PasswordValidation {
  const errors: string[] = [];
  if (!password || password.length < 10) {
    errors.push("Password must be at least 10 characters");
  }
  if (password.length > 100) {
    errors.push("Password must be at most 100 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Include at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Include at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Include at least one number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Include at least one special character");
  }
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return { ok: errors.length === 0, errors, score };
}

export function slugifyOrgName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `tenant-${Date.now()}`
  );
}

/** Ensure slug is unique; append short suffix on collision. */
export async function allocateUniqueSlug(
  sb: SupabaseClient,
  preferred: string
): Promise<string> {
  let base = slugifyOrgName(preferred);
  if (base.length < 2) base = `tenant-${Date.now().toString(36)}`;
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 50)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data } = await sb
      .from("tenants")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

export async function assertAdminEmailAvailable(
  sb: SupabaseClient,
  email: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await sb
    .from("user_profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  if (profile?.id) {
    throw new Error(
      "An account with this administrator email already exists. Sign in or use a different email."
    );
  }
}

const DEFAULT_SEQUENCES: Array<{
  document_type: string;
  prefix: string;
  include_year: boolean;
  pad_length: number;
  sample_format: string;
}> = [
  { document_type: "po", prefix: "PO-", include_year: true, pad_length: 6, sample_format: "PO-{YYYY}-{000001}" },
  { document_type: "invoice", prefix: "INV-", include_year: true, pad_length: 6, sample_format: "INV-{YYYY}-{000001}" },
  { document_type: "grn", prefix: "GRN-", include_year: true, pad_length: 6, sample_format: "GRN-{YYYY}-{000001}" },
  { document_type: "quote", prefix: "QT-", include_year: true, pad_length: 6, sample_format: "QT-{YYYY}-{000001}" },
  { document_type: "so", prefix: "SO-", include_year: true, pad_length: 6, sample_format: "SO-{YYYY}-{000001}" },
  { document_type: "pr", prefix: "PR-", include_year: true, pad_length: 6, sample_format: "PR-{YYYY}-{000001}" },
  { document_type: "journal", prefix: "JV-", include_year: true, pad_length: 6, sample_format: "JV-{YYYY}-{000001}" },
  { document_type: "employee", prefix: "EMP-", include_year: false, pad_length: 4, sample_format: "EMP-{0000}" },
  { document_type: "batch", prefix: "BAT-", include_year: true, pad_length: 5, sample_format: "BAT-{YYYY}-{00001}" },
];

/**
 * Best-effort seed of operational defaults for a new company.
 * Failures are non-fatal (logged via returned notes) so provision still succeeds.
 */
export async function seedTenantDefaults(
  sb: SupabaseClient,
  opts: {
    companyId: string;
    tenantId: string;
    organizationName: string;
    adminEmail: string;
    industry?: string | null;
    countryName?: string;
  }
): Promise<{ notes: string[] }> {
  const notes: string[] = [];
  const prefixBase = opts.organizationName
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "ST";

  // Document sequences
  try {
    const rows = DEFAULT_SEQUENCES.map((s) => ({
      company_id: opts.companyId,
      document_type: s.document_type,
      prefix: s.document_type === "employee" || s.document_type === "batch"
        ? s.prefix
        : `${prefixBase}-${s.prefix}`,
      include_year: s.include_year,
      pad_length: s.pad_length,
      next_number: 1,
      sample_format: s.sample_format.replace(
        /^[A-Z]+-/,
        s.document_type === "employee" || s.document_type === "batch"
          ? s.prefix
          : `${prefixBase}-${s.prefix}`
      ),
      is_active: true,
    }));
    const { error } = await sb.from("document_sequences").upsert(rows, {
      onConflict: "company_id,document_type",
      ignoreDuplicates: true,
    });
    if (error) notes.push(`sequences: ${error.message}`);
    else notes.push(`sequences: ${rows.length}`);
  } catch (e) {
    notes.push(`sequences: ${e instanceof Error ? e.message : "failed"}`);
  }

  // Security policies (defaults match IAM migration)
  try {
    const { error } = await sb.from("security_policies").upsert(
      {
        company_id: opts.companyId,
        min_password_length: 10,
        require_uppercase: true,
        require_number: true,
        require_special: true,
        password_history_count: 5,
        password_expiry_days: 90,
        max_failed_logins: 5,
        lockout_minutes: 30,
        session_timeout_minutes: 480,
        max_concurrent_sessions: 5,
        mfa_required_for_admins: true,
      },
      { onConflict: "company_id", ignoreDuplicates: true }
    );
    if (error) notes.push(`security: ${error.message}`);
    else notes.push("security: ok");
  } catch (e) {
    notes.push(`security: ${e instanceof Error ? e.message : "failed"}`);
  }

  // Primary brand profile skeleton
  try {
    const { error } = await sb.from("brand_profiles").upsert(
      {
        company_id: opts.companyId,
        brand_code: "PRIMARY",
        brand_name: opts.organizationName,
        trading_name: opts.organizationName,
        industry: opts.industry || null,
        email: opts.adminEmail,
        is_primary: true,
        is_active: true,
      },
      { onConflict: "company_id,brand_code", ignoreDuplicates: true }
    );
    if (error) notes.push(`branding: ${error.message}`);
    else notes.push("branding: ok");
  } catch (e) {
    notes.push(`branding: ${e instanceof Error ? e.message : "failed"}`);
  }

  return { notes };
}

export function buildWizardRows(
  tenantId: string,
  companyId: string,
  extraCompleted: string[] = []
) {
  const completed = new Set([
    ...TENANT_WIZARD_STEPS.filter((s) => s.autoComplete).map((s) => s.key),
    ...extraCompleted,
  ]);
  const now = new Date().toISOString();
  return TENANT_WIZARD_STEPS.map((s) => ({
    tenant_id: tenantId,
    company_id: companyId,
    step_key: s.key,
    step_label: s.label,
    sort_order: s.sort_order,
    status: completed.has(s.key) ? "completed" : "pending",
    completed_at: completed.has(s.key) ? now : null,
    metadata: {
      description: s.description,
      href: s.href,
    },
  }));
}

export function setupProgressSummary(steps: SetupStep[]) {
  const total = steps.length;
  const completed = steps.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length;
  const pending = steps.filter((s) => s.status === "pending" || s.status === "in_progress");
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
  return {
    total,
    completed,
    remaining: total - completed,
    percent,
    isComplete: total > 0 && completed >= total,
    nextStep: pending[0] || null,
  };
}

export function wizardHrefForKey(key: string): string {
  return TENANT_WIZARD_STEPS.find((s) => s.key === key)?.href || "/dashboard/settings";
}
