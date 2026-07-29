/** Logging policy & config CRUD (configs mutable; events never are) */

import { createClient } from "@/lib/supabase/client";

function sb() {
  return createClient();
}

export async function logConfigChange(input: {
  company_id: string;
  config_type: string;
  config_id?: string | null;
  action: string;
  actor_id?: string | null;
  actor_email?: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  details?: string;
}) {
  await sb().from("eal_config_history").insert({
    company_id: input.company_id,
    config_type: input.config_type,
    config_id: input.config_id,
    action: input.action,
    actor_id: input.actor_id,
    actor_email: input.actor_email,
    before_state: input.before_state,
    after_state: input.after_state,
    details: input.details,
  });
}

export async function upsertLoggingPolicy(input: {
  company_id: string;
  id?: string;
  policy_code: string;
  name: string;
  module_scope?: string;
  min_severity?: string;
  capture_before_after?: boolean;
  enabled?: boolean;
  description?: string;
  actor_id?: string | null;
  actor_email?: string;
}) {
  const row = {
    company_id: input.company_id,
    policy_code: input.policy_code.toUpperCase(),
    name: input.name,
    module_scope: input.module_scope || "*",
    min_severity: input.min_severity || "info",
    capture_before_after: input.capture_before_after ?? true,
    enabled: input.enabled ?? true,
    description: input.description,
    updated_by: input.actor_id,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data: before } = await sb()
      .from("eal_logging_policies")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    const { data, error } = await sb()
      .from("eal_logging_policies")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    await logConfigChange({
      company_id: input.company_id,
      config_type: "logging_policy",
      config_id: input.id,
      action: "update",
      actor_id: input.actor_id,
      actor_email: input.actor_email,
      before_state: before as Record<string, unknown>,
      after_state: data as Record<string, unknown>,
    });
    return data;
  }

  const { data, error } = await sb()
    .from("eal_logging_policies")
    .insert({ ...row, created_by: input.actor_id })
    .select("*")
    .single();
  if (error) throw error;
  await logConfigChange({
    company_id: input.company_id,
    config_type: "logging_policy",
    config_id: data.id,
    action: "create",
    actor_id: input.actor_id,
    actor_email: input.actor_email,
    after_state: data as Record<string, unknown>,
  });
  return data;
}

export async function setPolicyEnabled(input: {
  company_id: string;
  id: string;
  enabled: boolean;
  actor_id?: string | null;
  actor_email?: string;
}) {
  const { data: before } = await sb()
    .from("eal_logging_policies")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  const { data, error } = await sb()
    .from("eal_logging_policies")
    .update({ enabled: input.enabled, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw error;
  await logConfigChange({
    company_id: input.company_id,
    config_type: "logging_policy",
    config_id: input.id,
    action: input.enabled ? "enable" : "disable",
    actor_id: input.actor_id,
    actor_email: input.actor_email,
    before_state: before as Record<string, unknown>,
    after_state: data as Record<string, unknown>,
  });
  return data;
}

export async function toggleSiemConnector(input: {
  company_id: string;
  id: string;
  enabled: boolean;
  actor_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("eal_siem_connectors")
    .update({ enabled: input.enabled })
    .eq("id", input.id)
    .eq("company_id", input.company_id)
    .select("*")
    .single();
  if (error) throw error;
  await logConfigChange({
    company_id: input.company_id,
    config_type: "siem",
    config_id: input.id,
    action: input.enabled ? "enable" : "disable",
    actor_id: input.actor_id,
    after_state: { enabled: input.enabled, provider: data.provider },
  });
  return data;
}

export const ROLE_MATRIX = [
  {
    role: "Internal Auditor",
    permissions: ["eal.view", "eal.export", "eal.investigate", "eal.archive", "audit.view"],
    notes: "View all logs, export, investigations. Cannot modify events.",
  },
  {
    role: "Compliance Officer",
    permissions: ["eal.view", "eal.compliance", "eal.export", "eal.executive", "audit.view"],
    notes: "Compliance reports, risk dashboards, packages.",
  },
  {
    role: "IT Security",
    permissions: ["eal.view", "eal.security", "eal.investigate", "eal.ai", "audit.view"],
    notes: "Security events, incidents, live monitoring.",
  },
  {
    role: "System Administrator",
    permissions: ["eal.infra", "eal.config", "audit.view"],
    notes: "Infrastructure logs & config only. Cannot alter audit records.",
  },
  {
    role: "Executive Management",
    permissions: ["eal.executive", "eal.view", "audit.view"],
    notes: "Summary dashboards and high-level reports.",
  },
  {
    role: "Super Administrator",
    permissions: ["eal.*", "audit.*"],
    notes: "Full platform access. Still cannot edit/delete individual audit events (DB enforced).",
  },
] as const;
