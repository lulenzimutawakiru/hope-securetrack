/**
 * Welcome Experience — shared types for the tenant onboarding wizard,
 * AI assistant, readiness/health scoring, and persistence.
 */

export type WelcomeStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "go_live"
  | "completed";

export type StepRunStatus = "pending" | "in_progress" | "completed" | "skipped";

export type StepRunState = {
  status: StepRunStatus;
  completed_at?: string | null;
  skipped_at?: string | null;
};

export type WelcomeStepKey =
  | "welcome"
  | "organization"
  | "subscription"
  | "structure"
  | "security"
  | "modules"
  | "business"
  | "import"
  | "integrations"
  | "ai"
  | "training"
  | "readiness"
  | "go_live"
  | "success";

export type WelcomeGroup = "foundation" | "configure" | "activate";

export type WelcomeStepDef = {
  key: WelcomeStepKey;
  label: string;
  shortLabel: string;
  description: string;
  /** lucide icon name resolved client-side */
  icon: string;
  group: WelcomeGroup;
  /** Dashboard deep-link where the admin can action this step manually */
  href?: string;
  /** Must be completed before go-live */
  required?: boolean;
  /** Completed automatically when provision finishes */
  autoComplete?: boolean;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  suggestions?: string[];
};

export type WelcomeState = {
  id?: string;
  tenant_id: string;
  company_id?: string | null;
  current_step: WelcomeStepKey;
  status: WelcomeStatus;
  steps_progress: Partial<Record<WelcomeStepKey, StepRunState>>;
  answers: Record<string, unknown>;
  selections: Record<string, unknown>;
  readiness?: ReadinessSnapshot;
  health?: HealthSnapshot;
  assistant: {
    messages?: AssistantMessage[];
    last_topic?: string;
  };
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type TenantSummary = {
  tenant_id: string;
  company_id: string | null;
  organization_name?: string | null;
  primary_contact_email?: string | null;
  slug?: string | null;
  industry?: string | null;
  country_code?: string | null;
  currency?: string | null;
  timezone?: string | null;
  language?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  plan_price_monthly?: number | null;
  subscription_status?: string | null;
  seats?: number | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  modules_enabled: string[];
  setup_percent: number;
  setup_complete: boolean;
  created_at?: string | null;
};

export type ReadinessSnapshot = {
  overall: number;
  status: WelcomeStatus;
  sections: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
    passed: boolean;
    notes: string[];
  }>;
  goLive: GoLiveCheck[];
};

export type GoLiveCheck = {
  key: string;
  label: string;
  done: boolean;
  detail?: string;
};

export type HealthSnapshot = {
  overall: number;
  configuration: number;
  security: number;
  compliance: number;
  dataQuality: number;
  training: number;
  backup: "ok" | "warn" | "unknown";
  aiAdoption: number;
  moduleUsage: number;
  risk: number;
  recommendations: string[];
};

export type WelcomeModuleDef = {
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  href?: string;
  /** Real platform_modules code toggled via tenant_modules when available */
  syncCode?: string;
  core?: boolean;
  recommended?: boolean;
  industries?: string[];
  planMin?: string[];
};

export type WelcomeIntegrationDef = {
  code: string;
  name: string;
  description: string;
  category: "communications" | "payments" | "identity" | "productivity" | "data" | "iot";
  icon: string;
};
