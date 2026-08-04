/** Logging policy & config CRUD — session-scoped via /api/v2/crud */

import {
  crudGetOne,
  mustCreate,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

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
  try {
    await mustCreate("eal_config_history", {
      config_type: input.config_type,
      config_id: input.config_id,
      action: input.action,
      actor_id: input.actor_id,
      actor_email: input.actor_email,
      before_state: input.before_state,
      after_state: input.after_state,
      details: input.details,
    });
  } catch {
    /* best-effort */
  }
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
    policy_code: input.policy_code.toUpperCase(),
    name: input.name,
    module_scope: input.module_scope || "*",
    min_severity: input.min_severity || "info",
    capture_before_after: input.capture_before_after ?? true,
    enabled: input.enabled ?? true,
    description: input.description,
  };

  if (input.id) {
    const before = await crudGetOne("eal_logging_policies", input.id);
    const data = await mustUpdate("eal_logging_policies", input.id, row);
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

  const data = await mustCreate<Record<string, unknown>>(
    "eal_logging_policies",
    row
  );
  await logConfigChange({
    company_id: input.company_id,
    config_type: "logging_policy",
    config_id: String(data.id),
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
  const before = await crudGetOne("eal_logging_policies", input.id);
  const data = await mustUpdate("eal_logging_policies", input.id, {
    enabled: input.enabled,
  });
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
  const data = await mustUpdate<Record<string, unknown>>(
    "eal_siem_connectors",
    input.id,
    { enabled: input.enabled }
  );
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
    permissions: [
      "eal.view",
      "eal.export",
      "eal.investigate",
      "eal.archive",
      "audit.view",
    ],
    notes: "View all logs, export, investigations. Cannot modify events.",
  },
  {
    role: "Compliance Officer",
    permissions: [
      "eal.view",
      "eal.compliance",
      "eal.export",
      "eal.executive",
      "audit.view",
    ],
    notes: "Compliance reports, risk dashboards, packages.",
  },
  {
    role: "IT Security",
    permissions: [
      "eal.view",
      "eal.security",
      "eal.investigate",
      "eal.ai",
      "audit.view",
    ],
    notes: "Security events, incidents, live monitoring.",
  },
  {
    role: "System Administrator",
    permissions: ["eal.infra", "eal.config", "audit.view"],
    notes:
      "Infrastructure logs & config only. Cannot alter audit records.",
  },
  {
    role: "Executive Management",
    permissions: ["eal.executive", "eal.view", "audit.view"],
    notes: "Summary dashboards and high-level reports.",
  },
  {
    role: "Super Administrator",
    permissions: ["eal.*", "audit.*"],
    notes:
      "Full platform access. Still cannot edit/delete individual audit events (DB enforced).",
  },
] as const;
