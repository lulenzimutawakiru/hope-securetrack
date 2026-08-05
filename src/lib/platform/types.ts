export type PlatformPlan = {
  id: string;
  plan_code: string;
  name: string;
  description?: string | null;
  max_companies?: number;
  max_users?: number;
  price_monthly?: number;
  currency?: string;
  modules?: unknown;
  status?: string;
};

export type TenantSubscription = {
  id: string;
  tenant_id: string;
  plan_code: string;
  status: string;
  seats?: number;
  modules?: unknown;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
};

export type DomainEvent = {
  id: string;
  event_id?: string;
  event_type: string;
  aggregate_type?: string | null;
  aggregate_id?: string | null;
  tenant_id?: string | null;
  company_id?: string | null;
  actor_id?: string | null;
  payload?: Record<string, unknown>;
  source_module?: string | null;
  severity?: string;
  created_at?: string;
};

export type ProvisioningJob = {
  id: string;
  job_code: string;
  tenant_id?: string | null;
  company_id?: string | null;
  status: string;
  organization_name: string;
  admin_email: string;
  admin_name?: string | null;
  country_code?: string;
  currency?: string;
  plan_code?: string;
  steps_json?: ProvisionStep[];
  result_json?: Record<string, unknown>;
  error_message?: string | null;
  created_at?: string;
  completed_at?: string | null;
};

export type ProvisionStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  detail?: string;
  at?: string;
};

export type PlatformModule = {
  module_code: string;
  name: string;
  description?: string | null;
  category?: string;
  href?: string | null;
  is_core?: boolean;
  default_enabled?: boolean;
};

export type SetupStep = {
  id?: string;
  step_key: string;
  step_label?: string | null;
  status: string;
  sort_order?: number;
  completed_at?: string | null;
  metadata?: {
    description?: string;
    href?: string;
    [key: string]: unknown;
  } | null;
};

export type PlatformStats = {
  tenants: number;
  companies: number;
  users: number;
  activeSubscriptions: number;
  openProvisionJobs: number;
  events24h: number;
  healthyChecks: number;
  totalChecks: number;
};

export type ProvisionTenantInput = {
  organization_name: string;
  slug?: string;
  admin_email: string;
  admin_name?: string;
  admin_password: string;
  country_code?: string;
  currency?: string;
  timezone?: string;
  industry?: string;
  plan_code?: string;
  create_demo_branch?: boolean;
  /** ISO language code e.g. en, fr, sw */
  language?: string;
  /** Data residency region e.g. eu-west-1, af-south-1 */
  data_region?: string;
  /** Preferred subdomain label (generates {slug}.securetrack.com) */
  domain?: string;
  /** Compliance frameworks required for this tenant */
  compliance_requirements?: string[];
  /** Max seats for subscription */
  seats?: number;
  /** Module codes to enable (default: plan defaults) */
  modules?: string[];
};
