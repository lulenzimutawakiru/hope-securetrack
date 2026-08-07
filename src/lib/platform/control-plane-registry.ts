/**
 * Enterprise Control Plane capability registry.
 * Maps every OS-admin surface to navigation, access, and isolation rules.
 */

export type ControlPlaneCapability = {
  id: string;
  layer: "platform" | "tenant" | "company";
  title: string;
  href: string;
  description: string;
  roles: string[];
};

export const CONTROL_PLANE_CAPABILITIES: ControlPlaneCapability[] = [
  // Platform layer
  { id: "command-center", layer: "platform", title: "Command Center", href: "/platform", description: "Health, estate, security, business KPIs", roles: ["Platform Owner", "CTO", "Security", "DevOps", "Compliance"] },
  { id: "leads", layer: "platform", title: "Leads & CRM", href: "/platform/leads", description: "Marketing leads, pipeline, follow-ups, source analytics", roles: ["Platform Owner", "CTO", "Compliance"] },
  { id: "analytics", layer: "platform", title: "Reports & Analytics", href: "/platform/analytics", description: "Platform-wide reporting, growth, revenue, usage trends", roles: ["Platform Owner", "CTO", "Compliance"] },
  { id: "assistant", layer: "platform", title: "AI Assistant", href: "/platform/assistant", description: "Natural-language queries over the control plane", roles: ["Platform Owner", "CTO", "Security", "DevOps", "Compliance"] },
  { id: "health", layer: "platform", title: "Health & Infrastructure", href: "/platform/health", description: "Database, Redis, workers, uptime", roles: ["CTO", "DevOps"] },
  { id: "monitoring", layer: "platform", title: "Monitoring", href: "/platform/monitoring", description: "Queues, latency, errors, events", roles: ["DevOps", "CTO"] },
  { id: "security", layer: "platform", title: "Security Center", href: "/platform/security", description: "MFA, alerts, privileged access, SSO", roles: ["Security", "Platform Owner", "CTO"] },
  { id: "audit", layer: "platform", title: "Audit Log Explorer", href: "/platform/audit", description: "Immutable admin, tenant, and security audit trail", roles: ["Security", "Compliance", "Platform Owner"] },
  { id: "sessions", layer: "platform", title: "Login Monitoring", href: "/platform/sessions", description: "Failed logins, sessions, and access anomalies", roles: ["Security", "Platform Owner"] },
  { id: "compliance", layer: "platform", title: "Audit & Compliance", href: "/platform/compliance", description: "Dual control, legal hold, evidence", roles: ["Compliance", "Security"] },
  { id: "governance", layer: "platform", title: "Data Governance", href: "/platform/governance", description: "Isolation, retention, residency", roles: ["Compliance", "Security"] },
  { id: "ai", layer: "platform", title: "AI Administration", href: "/platform/ai", description: "Providers, limits, tenant AI isolation", roles: ["CTO", "Security"] },
  { id: "integrations", layer: "platform", title: "Integration Center", href: "/platform/integrations", description: "Payments, comms, identity providers", roles: ["DevOps", "CTO"] },
  { id: "api", layer: "platform", title: "API Management", href: "/platform/api", description: "Keys, OAuth, rate limits, analytics", roles: ["DevOps", "Security"] },
  { id: "storage", layer: "platform", title: "Storage Management", href: "/platform/storage", description: "Usage, retention, encryption paths", roles: ["DevOps", "Compliance"] },
  { id: "database", layer: "platform", title: "Database Admin", href: "/platform/database", description: "Migrations, health (no raw SQL)", roles: ["DevOps", "CTO"] },
  { id: "backup", layer: "platform", title: "Backup & DR", href: "/platform/backup", description: "RPO/RTO, restore points", roles: ["DevOps", "CTO"] },
  { id: "deploy", layer: "platform", title: "Deployment Center", href: "/platform/deploy", description: "Envs, flags, rollback", roles: ["DevOps"] },
  { id: "notifications", layer: "platform", title: "Notification Center", href: "/platform/notifications", description: "Channels, templates, rules", roles: ["Platform Owner"] },
  { id: "support", layer: "platform", title: "Tenant Support", href: "/platform/support", description: "Tickets, controlled impersonation", roles: ["Platform Owner"] },
  { id: "workflows", layer: "platform", title: "Workflows", href: "/platform/workflows", description: "Dual-control, automation jobs", roles: ["CTO"] },
  { id: "jobs", layer: "platform", title: "Background Jobs", href: "/platform/jobs", description: "Queue operations", roles: ["DevOps"] },
  { id: "events", layer: "platform", title: "Event Stream", href: "/platform/events", description: "Domain events", roles: ["Security", "DevOps"] },
  { id: "ops", layer: "platform", title: "Ops / Elevation", href: "/platform/ops", description: "Break-glass, offboarding", roles: ["Platform Owner", "Security"] },
  { id: "config", layer: "platform", title: "System Configuration", href: "/platform/config", description: "No-code platform defaults", roles: ["Platform Owner"] },
  { id: "studio", layer: "platform", title: "Customization Studio", href: "/platform/studio", description: "Tenant customization governance", roles: ["Platform Owner"] },
  // Tenant layer
  { id: "tenants", layer: "tenant", title: "Tenant Management", href: "/platform/tenants", description: "Full CRUD + isolation controls", roles: ["Platform Owner"] },
  { id: "provisioning", layer: "tenant", title: "Provisioning Engine", href: "/platform/provisioning", description: "Automated tenant ready workflow", roles: ["Platform Owner"] },
  { id: "subscriptions", layer: "tenant", title: "Subscriptions", href: "/platform/subscriptions", description: "Plans, seats, upgrade/downgrade", roles: ["Platform Owner"] },
  { id: "billing", layer: "tenant", title: "Billing & Invoices", href: "/platform/billing", description: "MRR, renewals, payment status, dunning", roles: ["Platform Owner"] },
  { id: "usage", layer: "tenant", title: "Usage Metering", href: "/platform/usage", description: "Seats, storage, API, and module consumption", roles: ["Platform Owner", "DevOps", "CTO"] },
  { id: "modules", layer: "tenant", title: "Module Management", href: "/platform/modules", description: "Enable/disable ERP modules", roles: ["Platform Owner"] },
  { id: "flags", layer: "tenant", title: "Feature Flags", href: "/platform/flags", description: "Per-tenant capability toggles", roles: ["Platform Owner", "DevOps"] },
  { id: "users", layer: "tenant", title: "User Administration", href: "/platform/users", description: "Estate-wide identity", roles: ["Security", "Platform Owner"] },
  { id: "roles", layer: "tenant", title: "Roles & Permissions", href: "/platform/roles", description: "RBAC roles, permissions, platform access matrix", roles: ["Platform Owner", "Security", "CTO"] },
  { id: "access-reviews", layer: "tenant", title: "Access Reviews", href: "/platform/access-reviews", description: "Privileged access attestation and reviews", roles: ["Platform Owner", "Security", "Compliance"] },
  // Company layer
  { id: "companies", layer: "company", title: "Company Administration", href: "/platform/companies", description: "Legal entities under tenants", roles: ["Platform Owner"] },
];

export const ACCESS_MATRIX = [
  { role: "Platform Owner", access: "Full control plane" },
  { role: "CTO", access: "Infrastructure + Security + AI" },
  { role: "Security Admin", access: "Audit + Security + MFA/SSO" },
  { role: "DevOps", access: "Deployment + Monitoring + Jobs" },
  { role: "Compliance Officer", access: "Audit + Reports + Governance" },
  { role: "Tenant Owner", access: "Own tenant only (ERP, not CPanel)" },
  { role: "Company Admin", access: "Own company only (ERP)" },
  { role: "Normal User", access: "No CPanel access" },
] as const;

export const ERP_MODULE_CATALOG = [
  "finance",
  "hr",
  "payroll",
  "crm",
  "procurement",
  "inventory",
  "manufacturing",
  "assets",
  "fleet",
  "service_desk",
  "projects",
  "recruitment",
  "ai_assistant",
  "sales",
  "dispatch",
  "attendance",
] as const;

export type SubscriptionPlanCode =
  | "starter"
  | "professional"
  | "enterprise"
  | "government";

/** SaaS entitlement limits per commercial plan */
export type PlanEntitlements = {
  plan_code: SubscriptionPlanCode;
  name: string;
  description: string;
  max_users: number;
  max_companies: number;
  max_storage_gb: number;
  max_api_calls_day: number;
  max_ai_tokens_month: number;
  max_reports_month: number;
  max_automations: number;
  modules: "core" | "standard" | "all";
  trial_days: number;
  features: string[];
};

export const SUBSCRIPTION_PLANS: PlanEntitlements[] = [
  {
    plan_code: "starter",
    name: "Starter",
    description: "SME launch plan â€” core ERP with trial",
    max_users: 25,
    max_companies: 1,
    max_storage_gb: 10,
    max_api_calls_day: 5_000,
    max_ai_tokens_month: 100_000,
    max_reports_month: 50,
    max_automations: 10,
    modules: "core",
    trial_days: 30,
    features: ["core_modules", "basic_reports", "email_support"],
  },
  {
    plan_code: "professional",
    name: "Professional",
    description: "Growing mid-market multi-company",
    max_users: 200,
    max_companies: 5,
    max_storage_gb: 100,
    max_api_calls_day: 50_000,
    max_ai_tokens_month: 1_000_000,
    max_reports_month: 500,
    max_automations: 100,
    modules: "standard",
    trial_days: 14,
    features: [
      "standard_modules",
      "advanced_reports",
      "integrations",
      "priority_support",
    ],
  },
  {
    plan_code: "enterprise",
    name: "Enterprise",
    description: "Full ERP suite, multi-entity, AI governance",
    max_users: 2_000,
    max_companies: 50,
    max_storage_gb: 1_000,
    max_api_calls_day: 500_000,
    max_ai_tokens_month: 10_000_000,
    max_reports_month: 5_000,
    max_automations: 1_000,
    modules: "all",
    trial_days: 0,
    features: [
      "all_modules",
      "sso_saml",
      "custom_workflows",
      "dedicated_csm",
      "sla_99_9",
    ],
  },
  {
    plan_code: "government",
    name: "Government",
    description: "Public sector â€” residency, audit, high capacity",
    max_users: 10_000,
    max_companies: 200,
    max_storage_gb: 5_000,
    max_api_calls_day: 1_000_000,
    max_ai_tokens_month: 20_000_000,
    max_reports_month: 20_000,
    max_automations: 5_000,
    modules: "all",
    trial_days: 0,
    features: [
      "all_modules",
      "data_residency",
      "enhanced_audit",
      "segregation_of_duties",
      "privileged_access",
      "sla_99_95",
    ],
  },
];

export function getPlanEntitlements(
  planCode: string | null | undefined
): PlanEntitlements {
  const code = (planCode || "starter").toLowerCase() as SubscriptionPlanCode;
  return (
    SUBSCRIPTION_PLANS.find((p) => p.plan_code === code) ||
    SUBSCRIPTION_PLANS[0]
  );
}

/** Provisioning workflow labels (engine order) */
export const PROVISIONING_WORKFLOW = [
  "Create Tenant",
  "Create Database Namespace",
  "Create Default Roles",
  "Create Admin Account",
  "Enable Modules",
  "Apply Branding",
  "Send Welcome Email",
  "Tenant Ready",
] as const;
