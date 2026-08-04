/**
 * Enterprise audit logging service — all I/O via /api/v2/crud (no browser client).
 */

import {
  computeEventHash,
  diffFields,
  formatFieldChanges,
  verifyChainSegment,
} from "./integrity";
import { scoreEventRisk } from "./ai";
import type { AuditEventInput } from "./types";
import {
  crudCount,
  crudGetOne,
  mustCreate,
  mustList,
  mustUpdate,
} from "@/lib/crud/domain-helpers";

function nextAuditId(seq: number): string {
  return `EAL-${String(seq).padStart(6, "0")}`;
}

export async function logAuditEvent(input: AuditEventInput) {
  const lastRows = await mustList<Record<string, unknown>>("eal_events", {
    pageSize: 1,
    sort: "chain_index",
    order: "desc",
  });
  const last = lastRows[0];
  const chainIndex = Number(last?.chain_index || 0) + 1;
  const prevHash = (last?.integrity_hash as string) || "GENESIS";
  const auditId = nextAuditId(chainIndex);
  const now = new Date().toISOString();
  const changed = diffFields(input.before_state, input.after_state);
  const severity = input.severity || "info";
  const risk = scoreEventRisk({
    event_type: input.event_type,
    severity,
    crud_op: input.crud_op,
    module: input.module,
  });

  const integrity_hash = computeEventHash({
    prevHash,
    auditId,
    eventId: input.event_type,
    action: input.action,
    module: input.module,
    userEmail: input.user_email,
    entityId: input.entity_id,
    beforeJson: input.before_state ? JSON.stringify(input.before_state) : "",
    afterJson: input.after_state ? JSON.stringify(input.after_state) : "",
    timestamp: now,
    chainIndex,
  });

  const row = {
    audit_id: auditId,
    event_id: input.event_type,
    correlation_id: input.correlation_id || `corr-${Date.now().toString(36)}`,
    transaction_id: input.transaction_id,
    user_id: input.user_id,
    username: input.username,
    full_name: input.full_name,
    user_email: input.user_email,
    user_role: input.user_role,
    department: input.department,
    branch_name: input.branch_name,
    session_id: input.session_id,
    device_name: input.device_name,
    os_name: input.os_name,
    browser: input.browser,
    device_fingerprint: input.device_fingerprint,
    ip_address: input.ip_address || null,
    user_agent: input.user_agent,
    mfa_status: input.mfa_status,
    auth_method: input.auth_method,
    module: input.module,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    entity_reference: input.entity_reference,
    event_type: input.event_type,
    crud_op: input.crud_op,
    action: input.action,
    severity,
    title: input.title || input.action,
    details: input.details,
    before_state: input.before_state,
    after_state: input.after_state,
    changed_fields: changed.length ? changed : null,
    local_time: now,
    geo_country: input.geo_country,
    geo_lat: input.geo_lat,
    geo_lng: input.geo_lng,
    api_source: input.api_source,
    prev_hash: prevHash,
    integrity_hash,
    signature: integrity_hash.slice(0, 32),
    chain_index: chainIndex,
    risk_score: risk,
    metadata: input.metadata || {},
  };

  const data = await mustCreate<Record<string, unknown>>("eal_events", row);

  try {
    await mustCreate("audit_logs", {
      user_id: input.user_id,
      user_email: input.user_email,
      user_role: input.user_role,
      action: input.action,
      module: input.module,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      entity_reference: input.entity_reference,
      before_state: input.before_state,
      after_state: input.after_state,
      ip_address: input.ip_address || null,
      user_agent: input.user_agent,
      event_id: input.event_type,
      correlation_id: row.correlation_id,
      severity,
      department: input.department,
      branch_name: input.branch_name,
      session_id: input.session_id,
      integrity_hash,
      prev_hash: prevHash,
      changed_fields: changed,
      crud_op: input.crud_op,
      metadata: { eal_id: data.id, audit_id: auditId },
    });
  } catch {
    /* legacy table may lag */
  }

  if (risk >= 70) {
    await createSecurityAlert({
      company_id: input.company_id,
      alert_type: input.event_type.includes("login")
        ? "failed_login"
        : input.module === "payroll" || input.event_type.includes("salary")
          ? "payroll_change"
          : "privilege",
      severity: risk >= 90 ? "critical" : "high",
      title: input.title || input.action,
      detail: input.details,
      user_id: input.user_id,
      event_id: String(data.id),
      risk_score: risk,
    });
  }

  return data;
}

export async function createSecurityAlert(input: {
  company_id: string;
  alert_type: string;
  severity?: string;
  title: string;
  detail?: string;
  user_id?: string | null;
  event_id?: string | null;
  risk_score?: number;
}) {
  const count = await crudCount("eal_alerts");
  const alert_number = `ALT-${String(count + 1).padStart(5, "0")}`;

  return mustCreate("eal_alerts", {
    alert_number,
    alert_type: input.alert_type,
    severity: input.severity || "medium",
    title: input.title,
    detail: input.detail,
    user_id: input.user_id,
    event_id: input.event_id,
    risk_score: input.risk_score || 50,
    status: "open",
  });
}

export async function createIncidentFromAlert(input: {
  company_id: string;
  alert_id: string;
  created_by?: string | null;
  title?: string;
  description?: string;
}) {
  const alert = await crudGetOne<Record<string, unknown>>(
    "eal_alerts",
    input.alert_id
  );
  if (!alert) throw new Error("Alert not found");

  const count = await crudCount("eal_incidents");
  const incident_number = `INC-${String(count + 1).padStart(5, "0")}`;

  const data = await mustCreate<Record<string, unknown>>("eal_incidents", {
    incident_number,
    title: input.title || alert.title,
    description: input.description || alert.detail,
    category: "security",
    severity: alert.severity,
    status: "open",
    source_alert_id: alert.id,
    evidence: [{ type: "alert", id: alert.id, number: alert.alert_number }],
    timeline: [
      {
        at: new Date().toISOString(),
        event: "incident_created",
        from_alert: alert.alert_number,
      },
    ],
  });

  await mustUpdate("eal_alerts", String(alert.id), {
    status: "investigating",
  });

  try {
    await mustCreate("support_tickets", {
      subject: `[Security] ${data.title}`,
      description: data.description,
      priority: data.severity === "critical" ? "critical" : "high",
      status: "open",
      category: "security",
      source: "audit_platform",
      metadata: {
        eal_incident: data.id,
        incident_number: data.incident_number,
      },
    });
  } catch {
    /* service desk optional */
  }

  return data;
}

export async function recordApproval(input: {
  company_id: string;
  approval_chain_id: string;
  sequence_no?: number;
  module: string;
  entity_type?: string;
  entity_id?: string | null;
  entity_reference?: string;
  requestor_id?: string | null;
  requestor_name?: string;
  approver_id?: string | null;
  approver_name: string;
  decision: string;
  comments?: string;
  previous_approver?: string;
  next_approver?: string;
}) {
  return mustCreate("eal_approvals", {
    approval_chain_id: input.approval_chain_id,
    sequence_no: input.sequence_no || 1,
    module: input.module,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    entity_reference: input.entity_reference,
    requestor_id: input.requestor_id,
    requestor_name: input.requestor_name,
    approver_id: input.approver_id,
    approver_name: input.approver_name,
    decision: input.decision,
    comments: input.comments,
    digital_signature: computeEventHash({
      prevHash: input.approval_chain_id,
      auditId: input.entity_reference || "",
      eventId: input.decision,
      action: "approve",
      module: input.module,
      userEmail: input.approver_name,
      timestamp: new Date().toISOString(),
      chainIndex: input.sequence_no || 1,
    }).slice(0, 48),
    previous_approver: input.previous_approver,
    next_approver: input.next_approver,
    decided_at: new Date().toISOString(),
  });
}

export async function logExport(input: {
  company_id: string;
  user_id?: string | null;
  username?: string;
  export_format: string;
  module?: string;
  entity_type?: string;
  record_count?: number;
  file_size_bytes?: number;
  contains_sensitive?: boolean;
  destination?: string;
}) {
  const hour = new Date().getHours();
  const after_hours = hour >= 22 || hour < 5;
  let risk = 10;
  if (input.contains_sensitive) risk += 30;
  if (after_hours) risk += 25;
  if ((input.record_count || 0) > 5000) risk += 20;

  const data = await mustCreate("eal_exports", {
    user_id: input.user_id,
    username: input.username,
    export_format: input.export_format,
    module: input.module,
    entity_type: input.entity_type,
    record_count: input.record_count || 0,
    file_size_bytes: input.file_size_bytes || 0,
    contains_sensitive: input.contains_sensitive || false,
    after_hours,
    risk_score: risk,
    destination: input.destination || "download",
    status: "completed",
  });

  if (risk >= 50) {
    await createSecurityAlert({
      company_id: input.company_id,
      alert_type: "unusual_export",
      severity: risk >= 70 ? "high" : "medium",
      title: `Data export: ${input.export_format.toUpperCase()} · ${input.module || "system"}`,
      detail: `${input.record_count || 0} records · sensitive=${!!input.contains_sensitive} · after_hours=${after_hours}`,
      user_id: input.user_id,
      risk_score: risk,
    });
  }

  return data;
}

export async function logApiCall(input: {
  company_id: string;
  method: string;
  path: string;
  status_code?: number;
  duration_ms?: number;
  user_id?: string | null;
  ip_address?: string;
  rate_limited?: boolean;
  error_message?: string;
  api_key_hint?: string;
}) {
  return mustCreate("eal_api_calls", {
    method: input.method,
    path: input.path,
    status_code: input.status_code,
    duration_ms: input.duration_ms,
    user_id: input.user_id,
    ip_address: input.ip_address || null,
    rate_limited: input.rate_limited || false,
    error_message: input.error_message,
    api_key_hint: input.api_key_hint,
  });
}

export async function logPrintAudit(input: {
  company_id: string;
  user_id?: string | null;
  username?: string;
  document_name: string;
  document_type?: string;
  printer_name?: string;
  copies?: number;
  outcome?: string;
  watermark_applied?: boolean;
}) {
  return mustCreate("eal_print_audit", {
    user_id: input.user_id,
    username: input.username,
    document_name: input.document_name,
    document_type: input.document_type,
    printer_name: input.printer_name,
    copies: input.copies || 1,
    outcome: input.outcome || "success",
    watermark_applied: input.watermark_applied || false,
  });
}

export async function logFileAudit(input: {
  company_id: string;
  user_id?: string | null;
  username?: string;
  file_name: string;
  file_type?: string;
  action: string;
  version_no?: number;
  module?: string;
  entity_id?: string | null;
  ip_address?: string;
}) {
  return mustCreate("eal_file_audit", {
    user_id: input.user_id,
    username: input.username,
    file_name: input.file_name,
    file_type: input.file_type,
    action: input.action,
    version_no: input.version_no || 1,
    module: input.module,
    entity_id: input.entity_id,
    ip_address: input.ip_address || null,
  });
}

export async function verifyIntegrityChain(companyId: string, limit = 200) {
  void companyId;
  const events = await mustList<Record<string, unknown>>("eal_events", {
    pageSize: Math.min(100, limit),
    sort: "chain_index",
    order: "asc",
  });
  // Walk more pages if needed
  let all = events;
  if (limit > 100) {
    const more = await mustList<Record<string, unknown>>("eal_events", {
      page: 2,
      pageSize: Math.min(100, limit - 100),
      sort: "chain_index",
      order: "asc",
    });
    all = all.concat(more);
  }

  const result = verifyChainSegment(all);
  const count = await crudCount("eal_integrity_checkpoints");
  const root =
    all.length > 0
      ? String(all[all.length - 1].integrity_hash ?? "")
      : "GENESIS";

  await mustCreate("eal_integrity_checkpoints", {
    checkpoint_number: `CP-${String(count + 1).padStart(5, "0")}`,
    from_chain_index: all[0]?.chain_index ?? 0,
    to_chain_index: all[all.length - 1]?.chain_index ?? 0,
    events_count: all.length,
    root_hash: root || "EMPTY",
    status: result.valid ? "valid" : "broken",
    notes: result.message,
  });

  return { ...result, events_checked: all.length, root_hash: root };
}

export async function createAuditPackage(input: {
  company_id: string;
  name: string;
  framework_code?: string;
  period_start?: string;
  period_end?: string;
  created_by?: string | null;
}) {
  const count = await crudCount("eal_audit_packages");
  const filters: Record<string, unknown> = {};
  if (input.period_start || input.period_end) {
    filters.created_at = {
      ...(input.period_start ? { gte: input.period_start } : {}),
      ...(input.period_end ? { lte: input.period_end + "T23:59:59" } : {}),
    };
  }
  const eventCount = await crudCount(
    "eal_events",
    Object.keys(filters).length ? filters : undefined
  );
  const controlCount = await crudCount("eal_controls");

  return mustCreate("eal_audit_packages", {
    package_number: `PKG-${String(count + 1).padStart(5, "0")}`,
    name: input.name,
    framework_code: input.framework_code,
    period_start: input.period_start || null,
    period_end: input.period_end || null,
    status: "ready",
    event_count: eventCount,
    control_count: controlCount,
  });
}

export { formatFieldChanges, verifyChainSegment };
