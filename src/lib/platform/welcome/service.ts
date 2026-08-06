/**
 * Welcome Experience — server-side persistence and tenant summary.
 * All reads/writes go through Supabase RLS with the authenticated session;
 * no client-supplied tenant values are ever trusted.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TenantSummary,
  WelcomeState,
  WelcomeStepKey,
} from "./types";
import { WELCOME_STEPS, WELCOME_STEP_MAP } from "./steps";
import { planDisplayName } from "./recommendations";
import { computeReadiness, computeHealth } from "./readiness";

export function defaultWelcomeState(input: {
  tenantId: string;
  companyId?: string | null;
  actorId?: string | null;
}): WelcomeState {
  const steps_progress = Object.fromEntries(
    WELCOME_STEPS.map((s) => [
      s.key,
      { status: s.autoComplete ? "completed" : "pending" },
    ])
  ) as WelcomeState["steps_progress"];

  const state: WelcomeState = {
    tenant_id: input.tenantId,
    company_id: input.companyId ?? null,
    current_step: "welcome",
    status: "not_started",
    steps_progress,
    answers: {},
    selections: {},
    assistant: {
      messages: [],
      last_topic: undefined,
    },
    created_by: input.actorId ?? undefined,
    updated_by: input.actorId ?? undefined,
  };
  state.readiness = computeReadiness(state);
  state.health = computeHealth(state);
  return state;
}

export async function getOrCreateWelcomeState(
  sb: SupabaseClient,
  input: {
    tenantId: string;
    companyId?: string | null;
    actorId?: string | null;
  }
): Promise<WelcomeState> {
  const { data: existing, error } = await sb
    .from("tenant_onboarding")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (existing) {
    return normalizeState(existing);
  }

  const fresh = defaultWelcomeState(input);
  const { data: created, error: insertError } = await sb
    .from("tenant_onboarding")
    .insert({
      tenant_id: fresh.tenant_id,
      company_id: fresh.company_id,
      current_step: fresh.current_step,
      status: fresh.status,
      steps_progress: fresh.steps_progress,
      answers: fresh.answers,
      selections: fresh.selections,
      readiness: fresh.readiness,
      health: fresh.health,
      assistant: fresh.assistant,
      created_by: fresh.created_by,
      updated_by: fresh.created_by,
    })
    .select("*")
    .maybeSingle();

  if (insertError) throw new Error(insertError.message);
  return normalizeState(created ?? fresh);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeState(row: any): WelcomeState {
  const steps_progress =
    (row.steps_progress as WelcomeState["steps_progress"]) ??
    Object.fromEntries(WELCOME_STEPS.map((s) => [s.key, { status: s.autoComplete ? "completed" : "pending" }]));

  const state: WelcomeState = {
    id: row.id,
    tenant_id: row.tenant_id,
    company_id: row.company_id ?? null,
    current_step: (row.current_step as WelcomeStepKey) ?? "welcome",
    status: row.status ?? "not_started",
    steps_progress,
    answers: row.answers ?? {},
    selections: row.selections ?? {},
    readiness: row.readiness ?? {},
    health: row.health ?? {},
    assistant: row.assistant ?? { messages: [] },
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  // Always refresh computed snapshots so the UI never serves stale scores.
  const readiness = computeReadiness(state);
  const health = computeHealth(state);
  state.readiness = readiness;
  state.health = health;
  return state;
}

export async function persistWelcomeState(
  sb: SupabaseClient,
  state: WelcomeState,
  actorId?: string | null
): Promise<WelcomeState> {
  const readiness = computeReadiness(state);
  const health = computeHealth(state);

  const payload = {
    company_id: state.company_id ?? null,
    current_step: state.current_step,
    status: state.status,
    steps_progress: state.steps_progress,
    answers: state.answers,
    selections: state.selections,
    readiness,
    health,
    assistant: state.assistant,
    started_at: state.started_at ?? (state.status !== "not_started" ? new Date().toISOString() : null),
    completed_at:
      state.completed_at ?? (state.status === "completed" ? new Date().toISOString() : null),
    updated_by: actorId ?? null,
  };

  if (state.id) {
    const { data, error } = await sb
      .from("tenant_onboarding")
      .update(payload)
      .eq("id", state.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalizeState(data ?? state);
  }

  const { data, error } = await sb
    .from("tenant_onboarding")
    .insert({ ...payload, tenant_id: state.tenant_id })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeState(data ?? state);
}

export async function loadTenantSummary(
  sb: SupabaseClient,
  tenantId: string,
  companyId?: string | null
): Promise<TenantSummary> {
  const { data: tenant, error: tenantError } = await sb
    .from("tenants")
    .select(
      "id,slug,name,legal_name,status,plan_code,primary_currency,country_code,timezone,logo_url,primary_contact_email,settings,branding,trial_ends_at,created_at"
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw new Error(tenantError.message);
  if (!tenant) throw new Error("Tenant not found");

  const { data: subscription } = await sb
    .from("tenant_subscriptions")
    .select("id,tenant_id,plan_code,status,seats,modules,trial_ends_at,current_period_end")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: modules } = await sb
    .from("tenant_modules")
    .select("module_code,enabled")
    .eq("tenant_id", tenantId)
    .eq("enabled", true)
    .limit(200);

  const { data: steps } = await sb
    .from("tenant_setup_progress")
    .select("step_key,status")
    .eq("tenant_id", tenantId)
    .limit(50);

  const setupDone = steps?.filter((s) => s.status === "completed" || s.status === "skipped").length ?? 0;
  const setupTotal = Math.max(1, steps?.length ?? 1);

  const industry =
    ((tenant.settings as Record<string, unknown> | undefined)?.industry as string | undefined) ??
    ((tenant.branding as Record<string, unknown> | undefined)?.industry as string | undefined) ??
    null;

  return {
    tenant_id: tenant.id,
    company_id: companyId ?? null,
    organization_name: tenant.legal_name || tenant.name,
    slug: tenant.slug,
    industry: industry ?? null,
    country_code: tenant.country_code ?? null,
    currency: tenant.primary_currency ?? null,
    timezone: tenant.timezone ?? null,
    plan_code: subscription?.plan_code ?? tenant.plan_code ?? null,
    plan_name: planDisplayName(subscription?.plan_code ?? tenant.plan_code),
    subscription_status: subscription?.status ?? tenant.status ?? null,
    seats: subscription?.seats ?? null,
    trial_ends_at: subscription?.trial_ends_at ?? tenant.trial_ends_at ?? null,
    current_period_end: subscription?.current_period_end ?? null,
    modules_enabled: (modules ?? []).map((m) => m.module_code),
    setup_percent: Math.round((setupDone / setupTotal) * 100),
    setup_complete: setupDone === setupTotal,
    created_at: tenant.created_at,
  };
}

export async function syncSetupProgress(
  sb: SupabaseClient,
  state: WelcomeState
): Promise<void> {
  const mapping: Record<string, string> = {
    organization: "company",
    structure: "branch",
    security: "security",
    modules: "modules",
    business: "sequences",
    integrations: "branding",
    training: "team",
    go_live: "go_live",
  };

  const rows: Array<{
    tenant_id: string;
    company_id?: string | null;
    step_key: string;
    step_label: string;
    status: string;
    sort_order: number;
    completed_at: string | null;
    metadata: Record<string, unknown>;
  }> = [];

  for (const [wizardKey, setupKey] of Object.entries(mapping)) {
    const def = WELCOME_STEP_MAP[wizardKey as WelcomeStepKey];
    const run = state.steps_progress[wizardKey as WelcomeStepKey];
    if (!def) continue;
    rows.push({
      tenant_id: state.tenant_id,
      company_id: state.company_id ?? null,
      step_key: setupKey,
      step_label: def.label,
      status:
        run?.status === "completed"
          ? "completed"
          : run?.status === "skipped"
            ? "skipped"
            : "pending",
      sort_order: 100 + WELCOME_STEPS.findIndex((s) => s.key === wizardKey),
      completed_at:
        run?.status === "completed" || run?.status === "skipped"
          ? run.completed_at ?? new Date().toISOString()
          : null,
      metadata: { description: def.description, href: `/welcome?step=${wizardKey}` },
    });
  }

  // Only write rows that exist for the tenant (upsert is safe either way).
  const { error } = await sb.from("tenant_setup_progress").upsert(rows, {
    onConflict: "tenant_id,step_key",
  });
  if (error) throw new Error(error.message);
}

