/** Enterprise Audit Logging & Compliance types */

export const AUDIT_MODULES = [
  "authentication",
  "iam",
  "hr",
  "payroll",
  "finance",
  "gl",
  "procurement",
  "crm",
  "sales",
  "invoicing",
  "inventory",
  "warehouse",
  "production",
  "packaging",
  "assets",
  "fleet",
  "maintenance",
  "quality",
  "projects",
  "service_desk",
  "documents",
  "branding",
  "credentials",
  "print",
  "qr",
  "portal",
  "api",
  "workflows",
  "reports",
  "settings",
  "notifications",
  "security",
] as const;

export const AUDIT_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const CRUD_OPS = [
  "create",
  "read",
  "update",
  "delete",
  "login",
  "logout",
  "export",
  "print",
  "approve",
  "reject",
  "config",
  "restore",
  "assign",
] as const;

export const COMPLIANCE_FRAMEWORKS = [
  { code: "ISO27001", name: "ISO/IEC 27001" },
  { code: "ISO9001", name: "ISO 9001" },
  { code: "SOC2", name: "SOC 2 Type II" },
  { code: "GDPR", name: "GDPR" },
  { code: "UG-DPA", name: "Uganda Data Protection Act" },
  { code: "FIN-AUDIT", name: "Financial Audit" },
] as const;

export const RETENTION_PRESETS = [
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
  { label: "1 Year", days: 365 },
  { label: "3 Years", days: 1095 },
  { label: "5 Years", days: 1825 },
  { label: "7 Years", days: 2555 },
  { label: "Permanent", days: -1 },
] as const;

export const ALERT_TYPES = [
  { value: "failed_login", label: "Failed logins" },
  { value: "privilege", label: "Privilege escalation" },
  { value: "unusual_export", label: "Unusual export" },
  { value: "night_activity", label: "Night activity" },
  { value: "impossible_travel", label: "Impossible travel" },
  { value: "payroll_change", label: "Payroll change" },
  { value: "mass_delete", label: "Mass deletion" },
  { value: "duplicate_invoice", label: "Duplicate invoice" },
  { value: "api_abuse", label: "API abuse" },
  { value: "permission_escalation", label: "Permission escalation" },
] as const;

export const AUDIT_LIFECYCLE = [
  "Capture",
  "Hash-chain",
  "Monitor",
  "Alert",
  "Investigate",
  "Incident",
  "Evidence",
  "Retain",
] as const;

export interface AuditEventInput {
  company_id: string;
  user_id?: string | null;
  username?: string;
  full_name?: string;
  user_email?: string;
  user_role?: string;
  department?: string;
  branch_name?: string;
  session_id?: string;
  device_name?: string;
  os_name?: string;
  browser?: string;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  mfa_status?: string;
  auth_method?: string;
  module: string;
  entity_type?: string;
  entity_id?: string | null;
  entity_reference?: string;
  event_type: string;
  crud_op?: string;
  action: string;
  severity?: string;
  title?: string;
  details?: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  correlation_id?: string;
  transaction_id?: string;
  geo_country?: string;
  geo_lat?: number;
  geo_lng?: number;
  api_source?: string;
  metadata?: Record<string, unknown>;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}
