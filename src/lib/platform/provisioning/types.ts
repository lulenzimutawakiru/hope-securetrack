/**
 * Enterprise Tenant Provisioning Platform - shared types.
 * Control-plane metadata for templates, orchestration jobs, checkpoints,
 * key vault, API credentials, and lifecycle commands.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProvisionTenantInput } from "@/lib/platform/types";

/** Provisioning template (tenant template or industry pack). */
export type ProvisioningTemplate = {
  id?: string;
  template_code: string;
  name: string;
  kind: "tenant" | "industry";
  industry?: string | null;
  plan_code?: string | null;
  description?: string | null;
  is_system?: boolean;
  is_active?: boolean;
  /** Metadata-driven configuration: modules, workflows, security, ai, ... */
  config: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

/** Template runtime defaults merged over the DB row (system seed parity). */
export type TemplateRuntimeConfig = {
  modules?: string[];
  workflows?: string[];
  reports?: string[];
  dashboards?: string[];
  security?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
  backup?: Record<string, unknown>;
  monitoring?: Record<string, unknown>;
  compliance?: string[];
  feature_flags?: Record<string, boolean>;
  kpis?: string[];
};

export type ProvisioningStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/** Checkpointed step row persisted per job. */
export type ProvisioningStepRow = {
  id: string;
  job_id: string;
  step_key: string;
  step_label: string;
  group_key: string;
  sort_order: number;
  status: ProvisioningStepStatus;
  attempt: number;
  retry_count: number;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  detail?: string | null;
  output_json?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at?: string;
};

/** Job event timeline row. */
export type ProvisioningJobEvent = {
  id: string;
  job_id: string;
  event_type: string;
  phase?: string | null;
  message?: string | null;
  data?: Record<string, unknown> | null;
  severity?: "info" | "warning" | "error";
  created_at?: string;
};

/** Full job row with orchestration columns. */
export type ProvisioningJobRow = {
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
  steps_json?: unknown;
  result_json?: Record<string, unknown>;
  error_message?: string | null;
  template_code?: string | null;
  kind?: string | null;
  provisioning_mode?: string | null;
  attempt?: number;
  max_attempts?: number;
  phase?: string | null;
  checkpoint_json?: { completed_keys?: string[]; phase?: string } | null;
  inputs_json?: Record<string, unknown> | null;
  output_json?: Record<string, unknown> | null;
  error_class?: string | null;
  next_retry_at?: string | null;
  duration_ms?: number | null;
  tenant_number?: string | null;
  actor_id?: string | null;
  correlation_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

/** Runtime state threaded through every step of a provisioning run. */
export type ProvisioningContext = {
  sb: SupabaseClient;
  job: ProvisioningJobRow;
  input: ProvisionTenantInput;
  template: ProvisioningTemplate | null;
  templateConfig: TemplateRuntimeConfig;
  /** Accumulated outputs from completed steps. */
  state: Record<string, unknown>;
  actorId?: string | null;
  correlationId?: string | null;
  startedAt: number;
};

/** A single executable step in the provisioning graph. */
export type ProvisioningStepDef = {
  key: string;
  label: string;
  group: string;
  sort: number;
  run: (ctx: ProvisioningContext) => Promise<Record<string, unknown>>;
  /** Best-effort rollback invoked on job failure after this step completed. */
  compensate?: (
    ctx: ProvisioningContext,
    step: ProvisioningStepRow
  ) => Promise<void>;
  retryable?: boolean;
};

/** Lifecycle commands a platform admin can issue against a tenant. */
export type TenantLifecycleCommand =
  | "activate"
  | "suspend"
  | "upgrade"
  | "downgrade"
  | "archive"
  | "delete"
  | "restore"
  | "clone";

/** Executive dashboard snapshot. */
export type ExecutiveSnapshot = {
  generated_at: string;
  tenants_total: number;
  tenants_active: number;
  tenants_trial: number;
  tenants_suspended: number;
  provisioning_queue: number;
  provisioning_running: number;
  provisioning_success: number;
  provisioning_failed: number;
  avg_provisioning_ms: number | null;
  p95_provisioning_ms: number | null;
  infra_health: { healthy: number; degraded: number; down: number; total: number };
  storage: { objects: number; usage_mb: number };
  ai: { tokens_month: number; agents: number };
  api: { requests_24h: number; errors_24h: number };
  security_score: number;
  compliance_score: number;
  capacity: { tenants_limit: number; tenants_pct: number; users_limit: number; users_pct: number };
  regional: Array<{ country_code: string; count: number }>;
  plans: Array<{ plan_code: string; count: number }>;
  growth_30d: number;
  jobs_running: number;
  backup_status: { healthy: number; stale: number; total: number };
  recent_jobs: Array<ProvisioningJobRow>;
};

/** Result of running a provisioning job (console-facing). */
export type ProvisioningRunResult = {
  job: ProvisioningJobRow;
  steps: ProvisioningStepRow[];
  tenantId?: string | null;
  companyId?: string | null;
  tenantNumber?: string | null;
  slug?: string | null;
  domain?: string | null;
  adminUserId?: string | null;
  error_message?: string | null;
  /** One-time secrets returned only at create time (vault immediately). */
  secrets?: {
    encryption_secret_b64?: string;
    api_key_secret?: string;
    api_key_prefix?: string;
  };
};
