/** Enterprise Company Management — master org foundation */

export const COMPANY_TYPES = [
  "holding",
  "operating",
  "subsidiary",
  "joint_venture",
  "franchise",
  "sister",
  "branch_legal",
] as const;

export const ORG_NODE_TYPES = [
  "enterprise_group",
  "holding",
  "company",
  "subsidiary",
  "branch",
  "factory",
  "warehouse",
  "office",
  "distribution_center",
  "retail_outlet",
  "service_center",
  "regional_office",
  "project_site",
  "business_unit",
  "department",
  "cost_center",
  "profit_center",
] as const;

export const BUSINESS_UNIT_TYPES = [
  "manufacturing",
  "security_printing",
  "ict",
  "distribution",
  "logistics",
  "retail",
  "corporate",
] as const;

export const DOC_TYPES = [
  "incorporation",
  "tax",
  "license",
  "insurance",
  "iso",
  "policy",
  "sop",
  "board",
  "legal",
  "other",
] as const;

export const RISK_CATEGORIES = [
  "strategic",
  "financial",
  "operational",
  "compliance",
  "cyber",
  "environmental",
] as const;

export const INSURANCE_TYPES = [
  "property",
  "vehicle",
  "equipment",
  "employee",
  "liability",
  "cyber",
] as const;

export const CALENDAR_EVENT_TYPES = [
  "public_holiday",
  "company_holiday",
  "shutdown",
  "maintenance",
  "payroll",
  "financial_close",
  "production",
  "corporate",
] as const;

export const ENTERPRISE_MODULES = [
  { title: "Company Master", href: "/dashboard/enterprise/companies", desc: "Legal entities · TIN · branding · status" },
  { title: "Org Structure", href: "/dashboard/enterprise/structure", desc: "Branches · factories · warehouses · depts" },
  { title: "Org Chart", href: "/dashboard/enterprise/org-chart", desc: "Interactive hierarchy · managers" },
  { title: "Business Units", href: "/dashboard/enterprise/business-units", desc: "Manufacturing · print · ICT · retail" },
  { title: "Departments", href: "/dashboard/enterprise/departments", desc: "Finance · HR · Production · QC" },
  { title: "Cost Centers", href: "/dashboard/enterprise/cost-centers", desc: "Budgets · P&L mapping" },
  { title: "Company Settings", href: "/dashboard/enterprise/settings", desc: "Fiscal · HR · mfg · sales policies" },
  { title: "Documents", href: "/dashboard/enterprise/documents", desc: "Licenses · ISO · policies · expiry" },
  { title: "Calendar", href: "/dashboard/enterprise/calendar", desc: "Holidays · payroll · shutdowns" },
  { title: "Governance", href: "/dashboard/enterprise/governance", desc: "Board · committees · meetings" },
  { title: "Risk & Insurance", href: "/dashboard/enterprise/risk", desc: "Risk register · policies · renewals" },
  { title: "Directory", href: "/dashboard/enterprise/directory", desc: "Employees · branches · contacts" },
  { title: "AI Insights", href: "/dashboard/enterprise/ai", desc: "Branch · cost · compliance intelligence" },
  { title: "Classic Settings", href: "/dashboard/settings/company", desc: "Legacy company form" },
] as const;
