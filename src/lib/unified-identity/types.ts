/** Unified Identity & Workforce Ecosystem */

export const PERSON_KINDS = [
  "workforce",
  "contractor",
  "visitor",
  "customer",
  "supplier",
  "partner",
  "system",
  "guest",
] as const;

export const PERSON_STATUSES = [
  "provisional",
  "active",
  "suspended",
  "leave",
  "terminated",
  "archived",
] as const;

export const LINK_TYPES = [
  "auth_account",
  "employee",
  "workforce_credential",
  "crm_contact",
  "srm_contact",
  "customer_portal",
  "supplier_portal",
  "payroll",
  "service_desk",
  "hopechat",
  "asset_custodian",
  "fleet_driver",
  "contractor",
  "visitor",
  "other",
] as const;

export const MODULE_CODES = [
  "identity",
  "hr",
  "profiles",
  "credentials",
  "payroll",
  "crm",
  "srm",
  "sales",
  "finance",
  "production",
  "inventory",
  "dispatch",
  "assets",
  "service_desk",
  "hopechat",
  "notifications",
  "portal",
  "audit",
] as const;

/** Module map: which ERP surfaces use the same digital person */
export const MODULE_IDENTITY_MAP: Array<{
  module: string;
  label: string;
  linkTypes: string[];
  description: string;
}> = [
  {
    module: "identity",
    label: "Login / IDM",
    linkTypes: ["auth_account"],
    description: "Authentication, roles, MFA, sessions",
  },
  {
    module: "hr",
    label: "Human Capital",
    linkTypes: ["employee"],
    description: "Employee master, leave, attendance",
  },
  {
    module: "profiles",
    label: "Digital Profile 360°",
    linkTypes: ["employee"],
    description: "Skills, documents, timeline, self-service",
  },
  {
    module: "credentials",
    label: "ID Badges & Access",
    linkTypes: ["workforce_credential"],
    description: "Physical cards, QR, zones, biometrics",
  },
  {
    module: "payroll",
    label: "Payroll",
    linkTypes: ["payroll", "employee"],
    description: "Payslips, tax, benefits",
  },
  {
    module: "crm",
    label: "CRM",
    linkTypes: ["crm_contact", "customer_portal"],
    description: "Customer contacts & portal users",
  },
  {
    module: "srm",
    label: "SRM / Procurement",
    linkTypes: ["srm_contact", "supplier_portal"],
    description: "Supplier contacts & portal users",
  },
  {
    module: "production",
    label: "Production / MES",
    linkTypes: ["employee"],
    description: "Shop-floor operators & supervisors",
  },
  {
    module: "dispatch",
    label: "Dispatch / Fleet",
    linkTypes: ["fleet_driver", "employee"],
    description: "Drivers & field staff",
  },
  {
    module: "assets",
    label: "Asset Management",
    linkTypes: ["asset_custodian", "employee"],
    description: "Asset custodians & assignees",
  },
  {
    module: "service_desk",
    label: "Service Desk",
    linkTypes: ["service_desk", "employee"],
    description: "Agents, requesters, approvers",
  },
  {
    module: "hopechat",
    label: "HopeChat",
    linkTypes: ["hopechat", "auth_account"],
    description: "Presence, channels, meetings",
  },
  {
    module: "finance",
    label: "Finance",
    linkTypes: ["auth_account", "employee"],
    description: "Approvers, cost-centre owners",
  },
];

export interface PersonInput {
  company_id: string;
  display_name: string;
  legal_first_name?: string;
  legal_last_name?: string;
  preferred_name?: string;
  primary_email?: string;
  primary_phone?: string;
  person_kinds?: string[];
  department?: string;
  job_title?: string;
  branch_name?: string;
  user_profile_id?: string | null;
  employee_id?: string | null;
  created_by?: string | null;
}

export interface LinkInput {
  company_id: string;
  person_id: string;
  link_type: string;
  module_code: string;
  entity_table?: string;
  entity_id?: string;
  entity_code?: string;
  is_primary?: boolean;
}
