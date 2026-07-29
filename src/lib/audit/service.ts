import { createClient } from "@/lib/supabase/client";
import {
  computeEventHash,
  diffFields,
  formatFieldChanges,
  verifyChainSegment,
} from "./integrity";
import { scoreEventRisk } from "./ai";
import type { AuditEventInput } from "./types";

function sb() {
  return createClient();
}

function nextAuditId(seq: number): string {
  return `EAL-${String(seq).padStart(6, "0")}`;
}

export async function logAuditEvent(input: AuditEventInput) {
  const client = sb();

  // Next chain index + prev hash
  const { data: last } = await client
    .from("eal_events")
    .select("chain_index, integrity_hash")
    .eq("company_id", input.company_id)
    .order("chain_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const chainIndex = Number(last?.chain_index || 0) + 1;
  const prevHash = last?.integrity_hash || "GENESIS";
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
    company_id: input.company_id,
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
    created_at: now,
  };

  const { data, error } = await client.from("eal_events").insert(row).select("*").single();
  if (error) throw error;

  // Mirror into legacy audit_logs (best-effort)
  try {
    await client.from("audit_logs").insert({
      company_id: input.company_id,
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
    // legacy insert may fail if columns not migrated yet
  }

  // Auto-alert on high risk
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
      event_id: data.id,
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
  const { count } = await sb()
    .from("eal_alerts")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const alert_number = `ALT-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const { data, error } = await sb()
    .from("eal_alerts")
    .insert({
      company_id: input.company_id,
      alert_number,
      alert_type: input.alert_type,
      severity: input.severity || "medium",
      title: input.title,
      detail: input.detail,
      user_id: input.user_id,
      event_id: input.event_id,
      risk_score: input.risk_score || 50,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createIncidentFromAlert(input: {
  company_id: string;
  alert_id: string;
  created_by?: string | null;
  title?: string;
  description?: string;
}) {
  const { data: alert } = await sb()
    .from("eal_alerts")
    .select("*")
    .eq("id", input.alert_id)
    .single();
  if (!alert) throw new Error("Alert not found");

  const { count } = await sb()
    .from("eal_incidents")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const incident_number = `INC-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const { data, error } = await sb()
    .from("eal_incidents")
    .insert({
      company_id: input.company_id,
      incident_number,
      title: input.title || alert.title,
      description: input.description || alert.detail,
      category: "security",
      severity: alert.severity,
      status: "open",
      source_alert_id: alert.id,
      created_by: input.created_by,
      evidence: [{ type: "alert", id: alert.id, number: alert.alert_number }],
      timeline: [
        {
          at: new Date().toISOString(),
          event: "incident_created",
          from_alert: alert.alert_number,
        },
      ],
    })
    .select("*")
    .single();
  if (error) throw error;

  await sb()
    .from("eal_alerts")
    .update({ status: "investigating" })
    .eq("id", alert.id);

  // Best-effort Service Desk ticket
  try {
    await sb().from("support_tickets").insert({
      company_id: input.company_id,
      subject: `[Security] ${data.title}`,
      description: data.description,
      priority: data.severity === "critical" ? "critical" : "high",
      status: "open",
      category: "security",
      source: "audit_platform",
      created_by: input.created_by,
      metadata: { eal_incident: data.id, incident_number: data.incident_number },
    });
  } catch {
    // service desk schema may differ
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
  const { data, error } = await sb()
    .from("eal_approvals")
    .insert({
      company_id: input.company_id,
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
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
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

  const { data, error } = await sb()
    .from("eal_exports")
    .insert({
      company_id: input.company_id,
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
    })
    .select("*")
    .single();
  if (error) throw error;

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
  const { data, error } = await sb()
    .from("eal_api_calls")
    .insert({
      company_id: input.company_id,
      method: input.method,
      path: input.path,
      status_code: input.status_code,
      duration_ms: input.duration_ms,
      user_id: input.user_id,
      ip_address: input.ip_address || null,
      rate_limited: input.rate_limited || false,
      error_message: input.error_message,
      api_key_hint: input.api_key_hint,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await sb()
    .from("eal_print_audit")
    .insert({
      company_id: input.company_id,
      user_id: input.user_id,
      username: input.username,
      document_name: input.document_name,
      document_type: input.document_type,
      printer_name: input.printer_name,
      copies: input.copies || 1,
      outcome: input.outcome || "success",
      watermark_applied: input.watermark_applied || false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await sb()
    .from("eal_file_audit")
    .insert({
      company_id: input.company_id,
      user_id: input.user_id,
      username: input.username,
      file_name: input.file_name,
      file_type: input.file_type,
      action: input.action,
      version_no: input.version_no || 1,
      module: input.module,
      entity_id: input.entity_id,
      ip_address: input.ip_address || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function verifyIntegrityChain(companyId: string, limit = 200) {
  const { data } = await sb()
    .from("eal_events")
    .select(
      "chain_index, prev_hash, integrity_hash, audit_id, event_id, action, module, user_email, entity_id, before_state, after_state, created_at"
    )
    .eq("company_id", companyId)
    .order("chain_index", { ascending: true })
    .limit(limit);

  const events = data || [];
  const result = verifyChainSegment(events);

  const { count } = await sb()
    .from("eal_integrity_checkpoints")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);

  const root =
    events.length > 0
      ? events[events.length - 1].integrity_hash
      : "GENESIS";

  await sb().from("eal_integrity_checkpoints").insert({
    company_id: companyId,
    checkpoint_number: `CP-${String((count ?? 0) + 1).padStart(5, "0")}`,
    from_chain_index: events[0]?.chain_index ?? 0,
    to_chain_index: events[events.length - 1]?.chain_index ?? 0,
    events_count: events.length,
    root_hash: root || "EMPTY",
    status: result.valid ? "valid" : "broken",
    notes: result.message,
  });

  return { ...result, events_checked: events.length, root_hash: root };
}

export async function createAuditPackage(input: {
  company_id: string;
  name: string;
  framework_code?: string;
  period_start?: string;
  period_end?: string;
  created_by?: string | null;
}) {
  const { count } = await sb()
    .from("eal_audit_packages")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  let eq = sb()
    .from("eal_events")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  if (input.period_start) eq = eq.gte("created_at", input.period_start);
  if (input.period_end) eq = eq.lte("created_at", input.period_end + "T23:59:59");
  const { count: eventCount } = await eq;

  const { count: controlCount } = await sb()
    .from("eal_controls")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data, error } = await sb()
    .from("eal_audit_packages")
    .insert({
      company_id: input.company_id,
      package_number: `PKG-${String((count ?? 0) + 1).padStart(5, "0")}`,
      name: input.name,
      framework_code: input.framework_code,
      period_start: input.period_start || null,
      period_end: input.period_end || null,
      status: "ready",
      event_count: eventCount ?? 0,
      control_count: controlCount ?? 0,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export { formatFieldChanges, verifyChainSegment };
