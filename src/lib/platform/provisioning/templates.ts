/**
 * Provisioning template runtime catalog.
 *
 * The database table provisioning_templates is the metadata source of truth
 * (admin-editable). This module is the system seed parity layer: it supplies
 * the full orchestration defaults (workflows, AI agents, integrations,
 * backup/monitoring/compliance) that the migration seed summarizes. The
 * orchestrator merges DB row + runtime catalog so a fresh deployment always
 * has complete configuration even before templates are edited.
 */

import type { TemplateRuntimeConfig } from "./types";

export const TENANT_TEMPLATE_CODES = [
  "sme-starter",
  "mid-market-professional",
  "enterprise",
  "government",
  "private-cloud",
  "trial",
] as const;

export const INDUSTRY_TEMPLATE_CODES = [
  "industry-manufacturing",
  "industry-healthcare",
  "industry-retail",
  "industry-wholesale",
  "industry-education",
  "industry-government",
  "industry-ngo",
  "industry-construction",
  "industry-agriculture",
  "industry-hospitality",
  "industry-logistics",
  "industry-banking",
  "industry-insurance",
  "industry-mining",
  "industry-energy",
  "industry-utilities",
  "industry-telecom",
  "industry-professional-services",
] as const;

export const DEFAULT_TEMPLATE_CODE = "enterprise";

/** Workflow templates installed per industry / tenant template. */
export const WORKFLOW_CATALOG: Record<string, string[]> = {
  purchase_order_approval: ["procurement", "finance"],
  goods_receipt: ["inventory", "procurement"],
  production_order: ["manufacturing"],
  quality_inspection: ["quality", "manufacturing"],
  maintenance_work_order: ["maintenance", "assets"],
  sales_order: ["sales", "crm"],
  stock_reorder: ["inventory", "warehouse"],
  dispatch_plan: ["dispatch", "fleet"],
  budget_approval: ["finance"],
  contract_approval: ["procurement", "projects"],
  payment_certificate: ["projects", "finance"],
  leave_request: ["hr"],
  expense_claim: ["finance", "hr"],
  recruitment_hire: ["recruitment", "hr"],
};

/** AI agents enabled per template (names mirror the AI Agent catalog). */
export const AGENT_CATALOG = [
  "executive",
  "finance",
  "procurement",
  "inventory",
  "warehouse",
  "manufacturing",
  "quality",
  "assets",
  "fleet",
  "hr",
  "payroll",
  "recruitment",
  "crm",
  "projects",
  "service_desk",
  "compliance",
  "risk",
  "security",
  "maintenance",
] as const;

export type TemplateCatalogEntry = {
  code: string;
  name: string;
  kind: "tenant" | "industry";
  industry?: string;
  plan_code?: string;
  description: string;
  config: TemplateRuntimeConfig;
};

export const TEMPLATE_CATALOG: Record<string, TemplateCatalogEntry> = {
  "sme-starter": {
    code: "sme-starter",
    name: "SME Starter",
    kind: "tenant",
    plan_code: "starter",
    description: "Core ERP for small teams with 30-day trial",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "inventory", "sales", "service_desk", "projects", "ai_assistant"],
      workflows: ["purchase_order_approval", "leave_request", "expense_claim"],
      security: { mfa: "optional", password_min_length: 10, session_timeout_min: 480 },
      ai: { workspace: true, agents: ["executive", "finance"] },
      backup: { schedule: "daily", retention_days: 30, pitr: false },
      monitoring: { alerts: ["provisioning_failed", "storage_high"] },
      compliance: ["gdpr"],
    },
  },
  "mid-market-professional": {
    code: "mid-market-professional",
    name: "Mid-Market Professional",
    kind: "tenant",
    plan_code: "professional",
    description: "Multi-company ERP with standard modules and integrations",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "manufacturing", "assets", "fleet", "service_desk", "projects", "recruitment", "ai_assistant", "sales", "dispatch", "attendance"],
      workflows: ["purchase_order_approval", "sales_order", "stock_reorder", "leave_request", "expense_claim", "recruitment_hire"],
      security: { mfa: "optional", password_min_length: 10, session_timeout_min: 480 },
      ai: { workspace: true, agents: ["executive", "finance", "crm", "inventory"] },
      backup: { schedule: "daily", retention_days: 60, pitr: true },
      monitoring: { alerts: ["provisioning_failed", "storage_high", "api_error_rate"] },
      compliance: ["gdpr", "iso27001"],
      integrations: { smtp: true, webhooks: true, slack: true },
    },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    kind: "tenant",
    plan_code: "enterprise",
    description: "Full ERP suite, multi-entity, SSO, custom workflows and AI governance",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "manufacturing", "assets", "fleet", "service_desk", "projects", "recruitment", "ai_assistant", "sales", "dispatch", "attendance", "warehouse", "quality", "production", "pos", "document_management", "learning", "performance", "analytics", "workflow", "api_gateway"],
      workflows: ["purchase_order_approval", "goods_receipt", "production_order", "quality_inspection", "maintenance_work_order", "sales_order", "stock_reorder", "budget_approval", "contract_approval", "payment_certificate", "leave_request", "expense_claim", "recruitment_hire"],
      security: { mfa: "enforced", password_min_length: 12, session_timeout_min: 240, sso: true },
      ai: { workspace: true, agents: [...AGENT_CATALOG] },
      backup: { schedule: "hourly", retention_days: 90, pitr: true },
      monitoring: { alerts: ["provisioning_failed", "storage_high", "api_error_rate", "db_latency"] },
      compliance: ["gdpr", "iso27001", "soc2"],
      integrations: { smtp: true, sms: true, whatsapp: true, webhooks: true, slack: true, teams: true },
    },
  },
  government: {
    code: "government",
    name: "Government",
    kind: "tenant",
    industry: "government",
    plan_code: "government",
    description: "Public sector - residency, audit, privileged access, high capacity",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "assets", "fleet", "projects", "service_desk", "recruitment", "ai_assistant", "compliance", "analytics", "workflow", "document_management"],
      workflows: ["budget_approval", "contract_approval", "purchase_order_approval", "payment_certificate", "leave_request"],
      security: { mfa: "enforced", password_min_length: 12, session_timeout_min: 120, sso: true, audit: "enhanced", segregation_of_duties: true },
      ai: { workspace: true, agents: ["executive", "finance", "compliance", "risk", "security"] },
      backup: { schedule: "hourly", retention_days: 365, pitr: true },
      monitoring: { alerts: ["provisioning_failed", "api_error_rate", "db_latency", "security_event"] },
      compliance: ["gdpr", "iso27001", "soc2", "local_data_residency"],
    },
  },
  "private-cloud": {
    code: "private-cloud",
    name: "Private Cloud",
    kind: "tenant",
    plan_code: "enterprise",
    description: "Dedicated environment with regional data residency and SLA 99.95",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "manufacturing", "assets", "fleet", "service_desk", "projects", "recruitment", "ai_assistant", "analytics", "workflow", "api_gateway", "document_management"],
      workflows: ["purchase_order_approval", "contract_approval", "budget_approval", "leave_request", "expense_claim"],
      security: { mfa: "enforced", password_min_length: 12, session_timeout_min: 240, sso: true, audit: "enhanced" },
      ai: { workspace: true, agents: ["executive", "finance", "compliance", "risk", "security"] },
      backup: { schedule: "hourly", retention_days: 365, pitr: true },
      monitoring: { alerts: ["provisioning_failed", "api_error_rate", "db_latency", "storage_high"] },
      compliance: ["gdpr", "iso27001", "soc2", "local_data_residency"],
    },
  },
  trial: {
    code: "trial",
    name: "30-Day Trial",
    kind: "tenant",
    plan_code: "starter",
    description: "Trial tenant with limited capacity and guided setup",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "inventory", "sales", "service_desk", "projects", "ai_assistant"],
      workflows: ["purchase_order_approval", "leave_request", "expense_claim"],
      security: { mfa: "optional", password_min_length: 10, session_timeout_min: 480 },
      ai: { workspace: true, agents: ["executive", "finance"] },
      backup: { schedule: "daily", retention_days: 14, pitr: false },
      monitoring: { alerts: ["provisioning_failed"] },
      compliance: ["gdpr"],
    },
  },
  // Industry packs (modules + workflows + KPIs + compliance)
  "industry-manufacturing": {
    code: "industry-manufacturing", name: "Manufacturing", kind: "industry", industry: "manufacturing",
    description: "Production, BOM, quality, maintenance and shop-floor workflows",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "manufacturing", "production", "quality", "maintenance", "assets", "warehouse", "projects", "service_desk", "ai_assistant", "analytics"],
      workflows: ["purchase_order_approval", "goods_receipt", "production_order", "quality_inspection", "maintenance_work_order"],
      kpis: ["overall_equipment_effectiveness", "scrap_rate", "downtime"],
      compliance: ["iso27001"],
    },
  },
  "industry-healthcare": {
    code: "industry-healthcare", name: "Healthcare", kind: "industry", industry: "healthcare",
    description: "Patient records, facilities, compliance (HIPAA-ready) and scheduling",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "inventory", "assets", "projects", "service_desk", "ai_assistant", "compliance"],
      workflows: ["patient_admission", "consent_management", "procurement_approval"],
      kpis: ["patient_satisfaction", "bed_occupancy"],
      compliance: ["hipaa", "gdpr"],
    },
  },
  "industry-retail": {
    code: "industry-retail", name: "Retail", kind: "industry", industry: "retail",
    description: "POS, promotions, multi-branch inventory and customer loyalty",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "inventory", "sales", "pos", "warehouse", "procurement", "ai_assistant"],
      workflows: ["sales_order", "stock_reorder", "promotion_approval"],
      kpis: ["gross_margin", "sell_through", "basket_size"],
    },
  },
  "industry-wholesale": {
    code: "industry-wholesale", name: "Wholesale & Distribution", kind: "industry", industry: "wholesale",
    description: "Bulk pricing, distribution, fleet and warehouse workflows",
    config: {
      modules: ["finance", "crm", "procurement", "inventory", "sales", "warehouse", "fleet", "dispatch", "assets", "ai_assistant"],
      workflows: ["sales_order", "dispatch_plan", "stock_reorder"],
      kpis: ["fill_rate", "on_time_delivery"],
    },
  },
  "industry-education": {
    code: "industry-education", name: "Education", kind: "industry", industry: "education",
    description: "Students, courses, fees, examinations and learning",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "projects", "learning", "attendance", "ai_assistant"],
      workflows: ["student_enrollment", "fee_waiver_approval", "examination_result"],
      kpis: ["enrollment", "graduation_rate"],
    },
  },
  "industry-government": {
    code: "industry-government", name: "Government", kind: "industry", industry: "government",
    description: "Public administration, permits, budgeting and audit",
    config: {
      modules: ["finance", "hr", "payroll", "crm", "procurement", "projects", "compliance", "document_management", "analytics", "ai_assistant"],
      workflows: ["budget_approval", "permit_issuance", "procurement_approval"],
      kpis: ["budget_utilisation", "service_delivery"],
      compliance: ["government", "gdpr", "iso27001"],
    },
  },
  "industry-ngo": {
    code: "industry-ngo", name: "NGO & Non-Profit", kind: "industry", industry: "ngo",
    description: "Grants, donors, programs, volunteers and impact reporting",
    config: {
      modules: ["finance", "crm", "procurement", "inventory", "projects", "hr", "payroll", "ai_assistant"],
      workflows: ["grant_approval", "donor_receipt", "program_budget"],
      kpis: ["donor_retention", "program_efficiency"],
    },
  },
  "industry-construction": {
    code: "industry-construction", name: "Construction", kind: "industry", industry: "construction",
    description: "Projects, contracts, equipment, sites and subcontractors",
    config: {
      modules: ["finance", "crm", "procurement", "inventory", "projects", "assets", "fleet", "hr", "payroll", "ai_assistant"],
      workflows: ["contract_approval", "site_variation", "payment_certificate"],
      kpis: ["project_margin", "safety_incidents"],
    },
  },
  "industry-agriculture": {
    code: "industry-agriculture", name: "Agriculture", kind: "industry", industry: "agriculture",
    description: "Farms, inputs, harvest, livestock and agronomy",
    config: {
      modules: ["finance", "crm", "procurement", "inventory", "assets", "fleet", "projects", "ai_assistant"],
      workflows: ["input_request", "harvest_batch", "quality_inspection"],
      kpis: ["yield_per_hectare", "input_cost"],
    },
  },
  "industry-hospitality": {
    code: "industry-hospitality", name: "Hospitality", kind: "industry", industry: "hospitality",
    description: "Hotels, restaurants, bookings, POS and housekeeping",
    config: {
      modules: ["finance", "crm", "inventory", "sales", "pos", "hr", "payroll", "assets", "ai_assistant"],
      workflows: ["booking_confirmation", "housekeeping_rounds", "pos_end_of_day"],
      kpis: ["occupancy_rate", "revpar"],
    },
  },
  "industry-logistics": {
    code: "industry-logistics", name: "Logistics", kind: "industry", industry: "logistics",
    description: "Fleet, dispatch, tracking, warehousing and billing",
    config: {
      modules: ["finance", "crm", "sales", "procurement", "inventory", "warehouse", "fleet", "dispatch", "assets", "maintenance", "ai_assistant"],
      workflows: ["dispatch_plan", "trip_closeout", "maintenance_work_order"],
      kpis: ["on_time_delivery", "cost_per_km"],
    },
  },
  "industry-banking": {
    code: "industry-banking", name: "Banking", kind: "industry", industry: "banking",
    description: "Branches, KYC, loans, deposits and regulatory reporting",
    config: {
      modules: ["finance", "crm", "compliance", "document_management", "ai_assistant", "analytics"],
      workflows: ["kyc_verification", "loan_approval", "account_opening"],
      kpis: ["loan_portfolio", "non_performing_loans"],
      compliance: ["pci_dss", "gdpr"],
    },
  },
  "industry-insurance": {
    code: "industry-insurance", name: "Insurance", kind: "industry", industry: "insurance",
    description: "Policies, claims, premiums and reinsurance",
    config: {
      modules: ["finance", "crm", "compliance", "document_management", "ai_assistant"],
      workflows: ["policy_issuance", "claim_adjudication", "premium_renewal"],
      kpis: ["loss_ratio", "claims_cycle_time"],
      compliance: ["gdpr", "iso27001"],
    },
  },
  "industry-mining": {
    code: "industry-mining", name: "Mining", kind: "industry", industry: "mining",
    description: "Sites, equipment, extraction, safety and maintenance",
    config: {
      modules: ["finance", "hr", "payroll", "procurement", "inventory", "assets", "maintenance", "fleet", "compliance", "ai_assistant"],
      workflows: ["maintenance_work_order", "permit_issuance", "hazard_report"],
      kpis: ["equipment_availability", "safety_incidents"],
      compliance: ["iso27001", "local_data_residency"],
    },
  },
  "industry-energy": {
    code: "industry-energy", name: "Energy & Utilities", kind: "industry", industry: "energy",
    description: "Generation, distribution, meters and asset health",
    config: {
      modules: ["finance", "crm", "inventory", "assets", "maintenance", "projects", "service_desk", "ai_assistant"],
      workflows: ["maintenance_work_order", "meter_read", "outage_ticket"],
      kpis: ["asset_health_score", "outage_duration"],
    },
  },
  "industry-utilities": {
    code: "industry-utilities", name: "Utilities", kind: "industry", industry: "utilities",
    description: "Billing, meters, connections and field service",
    config: {
      modules: ["finance", "crm", "inventory", "assets", "maintenance", "service_desk", "dispatch", "ai_assistant"],
      workflows: ["meter_read", "connection_request", "billing_run"],
      kpis: ["collection_rate", "response_time"],
    },
  },
  "industry-telecom": {
    code: "industry-telecom", name: "Telecommunications", kind: "industry", industry: "telecom",
    description: "Subscribers, airtime, bundles and network assets",
    config: {
      modules: ["finance", "crm", "inventory", "assets", "maintenance", "service_desk", "sales", "ai_assistant"],
      workflows: ["subscriber_onboarding", "bundle_activation", "tower_maintenance"],
      kpis: ["churn_rate", "arpu"],
    },
  },
  "industry-professional-services": {
    code: "industry-professional-services", name: "Professional Services", kind: "industry", industry: "professional-services",
    description: "Clients, engagements, time tracking and billing",
    config: {
      modules: ["finance", "crm", "projects", "hr", "attendance", "inventory", "ai_assistant"],
      workflows: ["engagement_approval", "timesheet_approval", "client_invoice"],
      kpis: ["utilisation", "billable_hours"],
    },
  },
};

export function runtimeConfigFor(code: string | null | undefined): TemplateRuntimeConfig {
  const entry = TEMPLATE_CATALOG[code || ""];
  if (entry) return entry.config;
  return TEMPLATE_CATALOG[DEFAULT_TEMPLATE_CODE]?.config ?? {};
}

/** Merge a DB template row with the runtime catalog (DB wins on conflicts). */
export function mergeTemplateConfig(
  row: Partial<ProvisioningTemplateRowLike> | null | undefined,
  code: string | null | undefined
): { template: ProvisioningTemplateLike | null; config: TemplateRuntimeConfig } {
  const runtime = runtimeConfigFor(code);
  const dbConfig = (row?.config ?? {}) as Record<string, unknown>;
  const merged: TemplateRuntimeConfig = {
    ...runtime,
    ...(dbConfig as Partial<TemplateRuntimeConfig>),
  };
  return {
    template: row
      ? {
          template_code: row.template_code || code || "",
          name: row.name || code || "",
          kind: row.kind || "tenant",
          industry: row.industry || null,
          plan_code: row.plan_code || null,
          description: row.description || null,
          config: dbConfig,
        }
      : null,
    config: merged,
  };
}

type ProvisioningTemplateRowLike = {
  template_code: string;
  name: string;
  kind: string;
  industry?: string | null;
  plan_code?: string | null;
  description?: string | null;
  config?: unknown;
};

type ProvisioningTemplateLike = {
  template_code: string;
  name: string;
  kind: string;
  industry?: string | null;
  plan_code?: string | null;
  description?: string | null;
  config?: unknown;
};
