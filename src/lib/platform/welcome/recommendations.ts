/**
 * Welcome Experience — metadata-driven recommendations.
 * Maps industry × plan → modules, workflows, security defaults, KPIs,
 * compliance frameworks and dashboards. Everything is deterministic and
 * tenant-agnostic so the same rules power every tenant safely.
 */

import type { WelcomeModuleDef, WelcomeIntegrationDef } from "./types";

export const WELCOME_MODULES: WelcomeModuleDef[] = [
  { code: "finance", name: "Finance & Accounting", description: "GL, AP, AR, treasury, fixed assets and multi-currency ledger.", category: "Finance", icon: "Landmark", href: "/dashboard/finance", syncCode: "finance", core: true, recommended: true },
  { code: "payroll", name: "Payroll", description: "Compensation, statutory deductions, payslips and reporting.", category: "People", icon: "Wallet", href: "/dashboard/payroll", syncCode: "payroll", recommended: true },
  { code: "hr", name: "Human Resources", description: "Employee lifecycle, contracts, leaves and performance.", category: "People", icon: "Users", href: "/dashboard/hr", syncCode: "hr", recommended: true },
  { code: "talent", name: "Recruitment", description: "Job postings, candidates, interviews and offers (ATS).", category: "People", icon: "UserPlus", href: "/dashboard/talent", syncCode: "talent" },
  { code: "attendance", name: "Attendance", description: "Time tracking, shifts, biometrics and absence.", category: "People", icon: "Clock", href: "/dashboard/attendance", syncCode: "attendance", recommended: true },
  { code: "crm", name: "CRM", description: "Leads, opportunities, accounts and follow-ups.", category: "Revenue", icon: "Contact", href: "/dashboard/crm", syncCode: "crm", recommended: true },
  { code: "sales", name: "Sales & POS", description: "Orders, invoicing, quotations and point of sale.", category: "Revenue", icon: "ShoppingCart", href: "/dashboard/sales", syncCode: "sales", recommended: true },
  { code: "procurement", name: "Procurement", description: "Purchase orders, suppliers, RFQs and vendor management.", category: "Supply", icon: "ShoppingBag", href: "/dashboard/procurement", syncCode: "procurement", recommended: true },
  { code: "inventory", name: "Inventory", description: "Stock levels, warehouses, transfers and valuations.", category: "Supply", icon: "Boxes", href: "/dashboard/inventory", syncCode: "inventory", recommended: true },
  { code: "manufacturing", name: "Manufacturing (MES)", description: "BOMs, routings, work orders and shop-floor execution.", category: "Operations", icon: "Factory", href: "/dashboard/production", syncCode: "manufacturing", industries: ["Manufacturing", "Construction", "Mining"] },
  { code: "quality", name: "Quality Management", description: "Inspections, non-conformance and corrective actions.", category: "Operations", icon: "BadgeCheck", href: "/dashboard/settings/modules" },
  { code: "maintenance", name: "Maintenance", description: "Preventive and corrective maintenance schedules.", category: "Operations", icon: "Wrench", href: "/dashboard/settings/modules" },
  { code: "fleet", name: "Fleet", description: "Vehicles, drivers, trips, fuel and telematics.", category: "Operations", icon: "Truck", href: "/dashboard/fleet", syncCode: "fleet", industries: ["Logistics", "Agriculture", "Construction", "Mining", "Transport"] },
  { code: "assets", name: "Asset Management", description: "Fixed assets, depreciation, QR/RFID tagging and audits.", category: "Operations", icon: "Box", href: "/dashboard/assets", syncCode: "assets", recommended: true },
  { code: "projects", name: "Projects (PPM)", description: "Projects, tasks, budgets, timesheets and milestones.", category: "Delivery", icon: "FolderKanban", href: "/dashboard/projects", syncCode: "projects", industries: ["Construction", "Professional Services", "NGO"] },
  { code: "service_desk", name: "Service Desk", description: "Tickets, SLAs, knowledge base and customer support.", category: "Service", icon: "Headphones", href: "/dashboard/service-desk" },
  { code: "document", name: "Document Management", description: "Secure document repository, retention and e-sign.", category: "Service", icon: "FileText", href: "/dashboard/settings/email" },
  { code: "workflow", name: "Workflow Automation", description: "Approvals, automations and business rules designer.", category: "Platform", icon: "Workflow", href: "/dashboard/workflows" },
  { code: "ai", name: "AI Platform", description: "Copilot, anomaly detection and AI insights.", category: "Platform", icon: "BrainCircuit", href: "/dashboard/settings/ai", recommended: true },
  { code: "bi", name: "BI & Analytics", description: "Dashboards, reports, pivots and exports.", category: "Platform", icon: "BarChart3", href: "/dashboard/reports", syncCode: "bi", core: true, recommended: true },
  { code: "identity", name: "Identity & Access", description: "Users, roles, permissions, SSO and MFA.", category: "Platform", icon: "IdCard", href: "/dashboard/identity", syncCode: "identity", core: true, recommended: true },
  { code: "audit", name: "Audit Centre", description: "Immutable audit trail and compliance evidence.", category: "Platform", icon: "ScrollText", href: "/dashboard/audit", syncCode: "audit", core: true, recommended: true },
  { code: "pos", name: "Point of Sale", description: "Retail counter, receipts, cash and drawer control.", category: "Revenue", icon: "Store", industries: ["Retail", "Hospitality"] },
  { code: "hotel", name: "Hospitality", description: "Rooms, bookings, housekeeping and property ops.", category: "Industry", icon: "Hotel", industries: ["Hospitality"] },
  { code: "restaurant", name: "Restaurant", description: "Tables, kitchen orders and menu management.", category: "Industry", icon: "Utensils", industries: ["Hospitality"] },
  { code: "school", name: "Education (School)", description: "Students, classes, fees, exams and reports.", category: "Industry", icon: "School", industries: ["Education"] },
  { code: "hospital", name: "Healthcare", description: "Patients, appointments, billing and records.", category: "Industry", icon: "HeartPulse", industries: ["Healthcare"] },
  { code: "agriculture", name: "Agriculture", description: "Farms, crops, inputs and harvest tracking.", category: "Industry", icon: "Sprout", industries: ["Agriculture"] },
  { code: "construction", name: "Construction", description: "Sites, contracts, BOQs and progress billing.", category: "Industry", icon: "HardHat", industries: ["Construction"] },
];

export const WELCOME_INTEGRATIONS: WelcomeIntegrationDef[] = [
  { code: "email", name: "Email (SMTP)", description: "Transactional email, invoices and notifications.", category: "communications", icon: "Mail" },
  { code: "sms", name: "SMS Gateway", description: "Alerts, OTPs and customer messages.", category: "communications", icon: "MessageSquare" },
  { code: "whatsapp", name: "WhatsApp", description: "Business messaging and updates.", category: "communications", icon: "MessageCircle" },
  { code: "slack", name: "Slack", description: "Workflow notifications and alerts.", category: "productivity", icon: "Hash" },
  { code: "microsoft365", name: "Microsoft 365", description: "Calendar, mail and identity federation.", category: "productivity", icon: "Cloud" },
  { code: "google", name: "Google Workspace", description: "Calendar, mail and SSO.", category: "productivity", icon: "Cloud" },
  { code: "stripe", name: "Stripe", description: "Card payments and recurring billing.", category: "payments", icon: "CreditCard" },
  { code: "flutterwave", name: "Flutterwave", description: "Pan-African payments and payouts.", category: "payments", icon: "CreditCard" },
  { code: "paystack", name: "Paystack", description: "West African payment gateway.", category: "payments", icon: "CreditCard" },
  { code: "pesapal", name: "Pesapal", description: "East African payments and POS.", category: "payments", icon: "CreditCard" },
  { code: "mtn_momo", name: "MTN Mobile Money", description: "MoMo collections and disbursements.", category: "payments", icon: "Smartphone" },
  { code: "airtel_money", name: "Airtel Money", description: "Airtel mobile money payments.", category: "payments", icon: "Smartphone" },
  { code: "sso", name: "SSO / OIDC", description: "SAML 2.0 and OpenID Connect identity.", category: "identity", icon: "KeyRound" },
  { code: "ldap", name: "LDAP / AD", description: "Active Directory and LDAP sync.", category: "identity", icon: "Server" },
  { code: "biometric", name: "Biometrics", description: "Attendance devices and readers.", category: "iot", icon: "Fingerprint" },
  { code: "iot", name: "IoT & GPS", description: "Sensors, telematics and asset tracking.", category: "iot", icon: "Radio" },
  { code: "rest", name: "REST APIs", description: "Open API-first integrations.", category: "data", icon: "Braces" },
  { code: "webhooks", name: "Webhooks", description: "Event-driven outbound automation.", category: "data", icon: "Webhook" },
];

export const INDUSTRY_KEYS: Record<string, string> = {
  manufacturing: "Manufacturing",
  healthcare: "Healthcare",
  education: "Education",
  school: "Education",
  university: "Education",
  government: "Government",
  ngo: "NGO",
  construction: "Construction",
  retail: "Retail",
  wholesale: "Wholesale",
  distribution: "Distribution",
  hospitality: "Hospitality",
  hotel: "Hospitality",
  telecom: "Telecommunications",
  telecommunication: "Telecommunications",
  agriculture: "Agriculture",
  farming: "Agriculture",
  logistics: "Logistics",
  transport: "Logistics",
  insurance: "Insurance",
  microfinance: "Microfinance",
  sacco: "SACCO",
  bank: "Banking",
  banking: "Banking",
  "professional services": "Professional Services",
  consulting: "Professional Services",
  mining: "Mining",
  utilities: "Utilities",
  energy: "Energy",
  automotive: "Automotive",
};

export type IndustryPack = {
  key: string;
  label: string;
  modules: string[];
  workflows: string[];
  security: string[];
  kpis: string[];
  compliance: string[];
  reports: string[];
  dashboards: string[];
  description: string;
};

export const INDUSTRY_PACKS: Record<string, IndustryPack> = {
  Manufacturing: {
    key: "Manufacturing",
    label: "Manufacturing",
    description: "MES, BOMs, work orders, quality and plant floor controls.",
    modules: ["manufacturing", "quality", "maintenance", "inventory", "procurement", "assets", "attendance"],
    workflows: ["Purchase approval", "Production order release", "Quality inspection", "Supplier onboarding", "Maintenance work order"],
    security: ["Segregation of duties (production vs quality)", "MFA for supervisors"],
    kpis: ["OEE", "On-time delivery", "Scrap rate", "Inventory turns", "Work order cycle time"],
    compliance: ["ISO 9001", "ISO 14001"],
    reports: ["Production summary", "BOM cost roll-up", "Quality defects", "Machine utilisation"],
    dashboards: ["Production control tower", "Plant maintenance"],
  },
  Healthcare: {
    key: "Healthcare",
    label: "Healthcare",
    description: "Patients, appointments, billing, wards and regulatory reporting.",
    modules: ["hospital", "finance", "hr", "inventory", "procurement", "service_desk"],
    workflows: ["Patient admission", "Pharmacy requisition", "Procurement approval", "Medical leave"],
    security: ["HIPAA-style access control", "Consent-based data sharing", "MFA for clinicians"],
    kpis: ["Patient satisfaction", "Bed occupancy", "Average stay", "Drug stock-out rate"],
    compliance: ["HIPAA", "ISO 27001", "Uganda Data Protection & Privacy Act"],
    reports: ["Clinical revenue", "Pharmacy consumption", "Patient visits", "Ward utilisation"],
    dashboards: ["Hospital operations", "Revenue cycle"],
  },
  Education: {
    key: "Education",
    label: "Education",
    description: "Students, classes, fees, exams, transcripts and campuses.",
    modules: ["school", "finance", "hr", "attendance", "crm", "document"],
    workflows: ["Student admission", "Fee payment", "Exemption approval", "Leave approval"],
    security: ["Guardian consent", "FERPA-style record privacy"],
    kpis: ["Enrolment", "Fee collection rate", "Retention", "Average grade", "Staff-to-student ratio"],
    compliance: ["Data protection", "Accreditation reporting"],
    reports: ["Enrolment by class", "Fee ledger", "Examination results", "Staff payroll"],
    dashboards: ["Campus performance", "Fee collection"],
  },
  Government: {
    key: "Government",
    label: "Government",
    description: "Public finance, budgeting, procurement, citizens and transparency.",
    modules: ["finance", "procurement", "hr", "payroll", "projects", "audit", "document"],
    workflows: ["Budget approval", "Public procurement", "Vote release", "Expense authorization"],
    security: ["Mandatory MFA", "Segregation of duties", "Immutable audit"],
    kpis: ["Budget absorption", "Procurement lead time", "Vote utilisation", "Audit findings"],
    compliance: ["PFMA", "PPDA", "ISO 37001"],
    reports: ["Budget execution", "Procurement register", "Payroll by vote", "Asset register"],
    dashboards: ["Public finance", "Procurement"],
  },
  NGO: {
    key: "NGO",
    label: "NGO",
    description: "Donor grants, programs, projects, volunteers and compliance.",
    modules: ["projects", "finance", "crm", "procurement", "hr", "document", "bi"],
    workflows: ["Grant approval", "Project budget revision", "Donor report", "Expense approval"],
    security: ["Donor data privacy", "Consent management"],
    kpis: ["Grant utilisation", "Project completion", "Overhead ratio", "Donor retention"],
    compliance: ["Donor reporting", "Uganda NGO Act"],
    reports: ["Grant utilisation", "Project expenditure", "Donor reports", "Programme KPIs"],
    dashboards: ["Programme health", "Grant portfolio"],
  },
  Construction: {
    key: "Construction",
    label: "Construction",
    description: "Sites, contracts, BOQs, subcontractors and progress billing.",
    modules: ["construction", "projects", "finance", "procurement", "inventory", "assets", "fleet"],
    workflows: ["Contract approval", "BOQ variation", "Subcontractor payment", "Site requisition"],
    security: ["Site-based permissions", "Payment segregation"],
    kpis: ["Project margin", "Progress vs plan", "Change order value", "Safety incidents"],
    compliance: ["OSH Act", "Building regulations"],
    reports: ["Job cost", "Progress billing", "Plant utilisation", "Subcontractor ledger"],
    dashboards: ["Site control tower", "Cash flow"],
  },
  Retail: {
    key: "Retail",
    label: "Retail",
    description: "POS, stock, promotions, multi-branch and supplier replenishment.",
    modules: ["pos", "sales", "inventory", "procurement", "finance", "crm", "bi"],
    workflows: ["Price change", "Stock transfer", "Purchase approval", "Returns"],
    security: ["Cashier permissions", "Refund segregation"],
    kpis: ["Gross margin", "Stock turns", "Basket size", "Sales per sqm", "Shrinkage"],
    compliance: ["Consumer protection", "E-receipt rules"],
    reports: ["Daily sales", "Stock movement", "Supplier performance", "Margin by SKU"],
    dashboards: ["Retail command center", "Branch comparison"],
  },
  Wholesale: {
    key: "Wholesale",
    label: "Wholesale",
    description: "Distribution, bulk pricing, credit customers and route sales.",
    modules: ["sales", "inventory", "procurement", "finance", "crm", "fleet"],
    workflows: ["Credit limit", "Bulk order", "Stock transfer", "Debt collection"],
    security: ["Credit approval segregation"],
    kpis: ["Debtor days", "Stock coverage", "Order fill rate", "Gross margin"],
    compliance: ["Consumer protection"],
    reports: ["Customer ageing", "Sales by territory", "Stock coverage", "Route performance"],
    dashboards: ["Distribution control", "Receivables"],
  },
  Hospitality: {
    key: "Hospitality",
    label: "Hospitality",
    description: "Rooms, bookings, F&B, housekeeping and events.",
    modules: ["hotel", "restaurant", "pos", "finance", "hr", "crm"],
    workflows: ["Booking confirmation", "Complimentary upgrade", "Discount approval"],
    security: ["Guest data privacy"],
    kpis: ["Occupancy", "ADR / RevPAR", "Food cost", "Guest satisfaction"],
    compliance: ["Data protection"],
    reports: ["Rooms revenue", "F&B cost", "Housekeeping status", "Guest ledger"],
    dashboards: ["Front desk", "F&B"],
  },
  Agriculture: {
    key: "Agriculture",
    label: "Agriculture",
    description: "Farms, crops, inputs, harvest, livestock and outgrowers.",
    modules: ["agriculture", "inventory", "procurement", "sales", "finance", "fleet", "assets"],
    workflows: ["Input requisition", "Harvest recording", "Outgrower payment", "Crop cycle"],
    security: ["Outgrower data consent"],
    kpis: ["Yield per hectare", "Input cost", "Harvest loss", "Outgrower satisfaction"],
    compliance: ["Seed & plant act", "Fair trade"],
    reports: ["Field production", "Input usage", "Harvest by crop", "Outgrower ledger"],
    dashboards: ["Farm operations", "Input stock"],
  },
  Logistics: {
    key: "Logistics",
    label: "Logistics",
    description: "Trips, dispatch, tracking, fuel and driver management.",
    modules: ["fleet", "dispatch", "inventory", "sales", "finance", "service_desk"],
    workflows: ["Trip approval", "Fuel issue", "Incident report", "Customer delivery"],
    security: ["Driver permissions", "Geofence alerts"],
    kpis: ["On-time delivery", "Cost per km", "Fuel efficiency", "Vehicle uptime"],
    compliance: ["Traffic & transport act"],
    reports: ["Trip log", "Fuel consumption", "Vehicle maintenance", "Customer deliveries"],
    dashboards: ["Fleet control tower", "Dispatch"],
  },
  Banking: {
    key: "Banking",
    label: "Banking",
    description: "Core financial operations, lending, deposits and compliance.",
    modules: ["finance", "crm", "document", "audit", "bi"],
    workflows: ["Loan approval", "KYC review", "Transaction authorization", "Credit committee"],
    security: ["Mandatory MFA", "Segregation of duties", "KYC/AML controls"],
    kpis: ["NPL ratio", "Cost-to-income", "Deposit growth", "Loan turnaround"],
    compliance: ["BoU prudential standards", "AML/CFT", "KYC"],
    reports: ["Loan book", "Deposit book", "NPL", "Regulatory returns"],
    dashboards: ["Treasury", "Credit risk"],
  },
  Microfinance: {
    key: "Microfinance",
    label: "Microfinance",
    description: "Client loans, savings, groups, repayments and field officers.",
    modules: ["finance", "crm", "document", "bi"],
    workflows: ["Loan appraisal", "Disbursement approval", "Write-off", "Group guarantee"],
    security: ["Client data privacy", "Segregation of duties"],
    kpis: ["Portfolio at risk", "Loan growth", "Repayment rate", "Client retention"],
    compliance: ["MDI Act", "Client protection"],
    reports: ["Portfolio", "Repayment schedule", "Field officer performance", "Savings"],
    dashboards: ["Loan portfolio", "Collections"],
  },
  SACCO: {
    key: "SACCO",
    label: "SACCO",
    description: "Member savings, loans, dividends and governance.",
    modules: ["finance", "crm", "document"],
    workflows: ["Loan application", "Committee approval", "Dividend declaration"],
    security: ["Member data privacy"],
    kpis: ["Membership growth", "Loan book", "Delinquency", "Dividend payout"],
    compliance: ["SACCO regulations"],
    reports: ["Member register", "Loan book", "Savings", "Committee reports"],
    dashboards: ["SACCO health", "Collections"],
  },
  "Professional Services": {
    key: "Professional Services",
    label: "Professional Services",
    description: "Projects, timesheets, billing, retainers and clients.",
    modules: ["projects", "finance", "crm", "hr", "bi"],
    workflows: ["Engagement approval", "Timesheet approval", "Invoicing", "Expense approval"],
    security: ["Client data isolation"],
    kpis: ["Utilisation", "Billable hours", "Project margin", "Client satisfaction"],
    compliance: ["Data protection"],
    reports: ["Utilisation", "WIP", "Client profitability", "Timesheets"],
    dashboards: ["Practice performance", "Pipeline"],
  },
  Mining: {
    key: "Mining",
    label: "Mining",
    description: "Sites, equipment, production, safety and compliance.",
    modules: ["manufacturing", "assets", "maintenance", "fleet", "procurement", "inventory", "hr"],
    workflows: ["Work order", "Asset transfer", "Safety incident", "Supplier onboarding"],
    security: ["Safety-critical permissions", "MFA for control room"],
    kpis: ["Tonnes mined", "Equipment availability", "Safety incidents", "Cost per tonne"],
    compliance: ["Mining act", "OSH"],
    reports: ["Production", "Equipment utilisation", "Safety", "Inventory"],
    dashboards: ["Mine control", "Equipment health"],
  },
  Utilities: {
    key: "Utilities",
    label: "Utilities",
    description: "Meters, billing, collections, outages and field work.",
    modules: ["finance", "service_desk", "assets", "maintenance", "inventory", "crm"],
    workflows: ["Meter reading", "Billing exception", "Outage report", "Field work order"],
    security: ["Field staff scope limits"],
    kpis: ["Collection rate", "Outage duration", "Meter accuracy", "Debtor days"],
    compliance: ["Utility regulator"],
    reports: ["Billing", "Collections", "Outages", "Meter operations"],
    dashboards: ["Utilities command", "Collections"],
  },
  Energy: {
    key: "Energy",
    label: "Energy",
    description: "Assets, production, maintenance, HSE and trading.",
    modules: ["assets", "maintenance", "finance", "procurement", "projects", "hr"],
    workflows: ["Work order", "HSE incident", "Project approval", "Procurement"],
    security: ["HSE reporting", "Control room MFA"],
    kpis: ["Uptime", "HSE incidents", "Opex per unit", "Project progress"],
    compliance: ["Energy regulator", "HSE"],
    reports: ["Production", "Maintenance", "HSE", "Capex"],
    dashboards: ["Energy control", "Asset health"],
  },
  Telecommunications: {
    key: "Telecommunications",
    label: "Telecommunications",
    description: "Subscribers, billing, devices, field teams and network assets.",
    modules: ["finance", "crm", "service_desk", "assets", "inventory", "projects"],
    workflows: ["Subscriber onboarding", "Tariff change", "Device dispatch", "Field ticket"],
    security: ["Subscriber data privacy"],
    kpis: ["Subscriber growth", "ARPU", "Churn", "Field resolution time"],
    compliance: ["UCC regulations", "Data protection"],
    reports: ["Subscribers", "Revenue", "Field tickets", "Network assets"],
    dashboards: ["Telco operations", "Field service"],
  },
  Insurance: {
    key: "Insurance",
    label: "Insurance",
    description: "Policies, premiums, claims, brokers and reinsurance.",
    modules: ["finance", "crm", "document", "bi", "service_desk"],
    workflows: ["Policy issuance", "Claim assessment", "Premium refund", "Reinsurance"],
    security: ["Claim segregation", "Consumer data privacy"],
    kpis: ["Combined ratio", "Claim cycle", "Policy growth", "Persistency"],
    compliance: ["Insurance act", "Consumer protection"],
    reports: ["Policy book", "Claims", "Premiums", "Broker commissions"],
    dashboards: ["Underwriting", "Claims"],
  },
};

export const DEFAULT_PACK: IndustryPack = {
  key: "Professional Services",
  label: "Professional Services",
  description: "A balanced default pack for organisations without a specialised industry pack.",
  modules: ["finance", "payroll", "hr", "crm", "sales", "procurement", "inventory", "assets", "projects", "bi", "ai"],
  workflows: ["Expense approval", "Purchase approval", "Leave approval", "Invoice approval"],
  security: ["MFA for administrators", "Session timeout", "Role-based permissions"],
  kpis: ["Revenue", "Gross margin", "Debtor days", "Employee headcount", "Project margin"],
  compliance: ["ISO 27001", "GDPR-style data protection"],
  reports: ["P&L by company", "Receivables ageing", "Payroll summary", "Asset register"],
  dashboards: ["Executive overview", "Cash position"],
};

export const PLANS: Record<string, { name: string; seats: number; modules: string[]; support: string }> = {
  starter: { name: "Starter", seats: 10, modules: ["finance", "sales", "crm", "inventory"], support: "Community" },
  professional: { name: "Professional", seats: 50, modules: ["finance", "payroll", "hr", "crm", "sales", "procurement", "inventory", "assets", "bi"], support: "Standard" },
  business: { name: "Business", seats: 250, modules: ["finance", "payroll", "hr", "talent", "attendance", "crm", "sales", "procurement", "inventory", "assets", "projects", "bi", "ai"], support: "Priority" },
  enterprise: { name: "Enterprise", seats: 1000, modules: ["all"], support: "Dedicated" },
  government: { name: "Government", seats: 5000, modules: ["all"], support: "Dedicated" },
  education: { name: "Education", seats: 5000, modules: ["all"], support: "Priority" },
  healthcare: { name: "Healthcare", seats: 1000, modules: ["all"], support: "Dedicated" },
  manufacturing: { name: "Manufacturing", seats: 1000, modules: ["all"], support: "Dedicated" },
  "private-cloud": { name: "Private Cloud", seats: 100000, modules: ["all"], support: "Enterprise" },
  "dedicated-cloud": { name: "Dedicated Cloud", seats: 100000, modules: ["all"], support: "Enterprise" },
  onpremise: { name: "On-Premise", seats: 100000, modules: ["all"], support: "Enterprise" },
};

export function resolveIndustryKey(industry?: string | null): string {
  if (!industry) return "Professional Services";
  const norm = industry.trim().toLowerCase();
  return INDUSTRY_KEYS[norm] ?? industry;
}

export function getIndustryPack(industry?: string | null): IndustryPack {
  const key = resolveIndustryKey(industry);
  return INDUSTRY_PACKS[key] ?? DEFAULT_PACK;
}

export type ModuleRecommendation = {
  code: string;
  name: string;
  reason: string;
  entitlement: "licensed" | "trial" | "recommended";
};

/** Recommended module set for an industry × plan combination. */
export function recommendModules(input: {
  industry?: string | null;
  planCode?: string | null;
}): ModuleRecommendation[] {
  const pack = getIndustryPack(input.industry);
  const plan = input.planCode ? PLANS[input.planCode.toLowerCase()] : undefined;
  const planAll = plan?.modules.includes("all");

  const out: ModuleRecommendation[] = [];
  const seen = new Set<string>();

  // Core modules always
  for (const m of WELCOME_MODULES) {
    if (m.core && !seen.has(m.code)) {
      seen.add(m.code);
      out.push({
        code: m.code,
        name: m.name,
        reason: "Core platform module included in every plan.",
        entitlement: "licensed",
      });
    }
  }

  // Industry pack modules
  for (const code of pack.modules) {
    if (seen.has(code)) continue;
    seen.add(code);
    const def = WELCOME_MODULES.find((m) => m.code === code);
    out.push({
      code,
      name: def?.name ?? code,
      reason: `Recommended for the ${pack.label} industry pack.`,
      entitlement: planAll ? "licensed" : "trial",
    });
  }

  // Plan modules
  if (plan) {
    for (const code of plan.modules) {
      if (code === "all" || seen.has(code)) continue;
      seen.add(code);
      const def = WELCOME_MODULES.find((m) => m.code === code);
      if (!def) continue;
      out.push({
        code,
        name: def.name,
        reason: `Included in the ${plan.name} plan.`,
        entitlement: "licensed",
      });
    }
  }

  // AI + BI + identity for everyone
  for (const code of ["ai", "bi", "identity", "audit"]) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      name: WELCOME_MODULES.find((m) => m.code === code)?.name ?? code,
      reason: "Platform capability recommended for every tenant.",
      entitlement: "recommended",
    });
  }

  return out;
}

export function moduleDef(code: string): WelcomeModuleDef | undefined {
  return WELCOME_MODULES.find((m) => m.code === code);
}

export function integrationDef(code: string): WelcomeIntegrationDef | undefined {
  return WELCOME_INTEGRATIONS.find((i) => i.code === code);
}

export const COMPLIANCE_FRAMEWORKS = [
  "ISO 27001",
  "SOC 2",
  "GDPR",
  "PCI DSS",
  "HIPAA",
  "Uganda Data Protection & Privacy Act",
  "Kenya Data Protection Act",
  "Tanzania Data Protection",
  "Nigeria NDPR",
  "South Africa POPIA",
] as const;

export const IMPORT_ENTITIES = [
  "Customers",
  "Suppliers",
  "Employees",
  "Products",
  "Inventory",
  "Assets",
  "Accounts (Chart of Accounts)",
  "Opening Balances",
  "Bank Accounts",
  "Projects",
  "Vendors",
  "Branches",
  "Warehouses",
  "Departments",
  "Budgets",
] as const;

export const IMPORT_SOURCES = [
  "Excel",
  "CSV",
  "JSON",
  "XML",
  "SAP",
  "Oracle",
  "Microsoft Dynamics",
  "QuickBooks",
  "Xero",
  "Odoo",
  "Zoho",
  "Tally",
  "Pastel",
  "Sage",
  "MYOB",
  "REST API",
  "Database",
] as const;

export const TRAINING_OFFERINGS = [
  { key: "guided_tours", label: "Guided Tours", description: "Interactive walkthroughs of every module." },
  { key: "video_tutorials", label: "Video Tutorials", description: "Short, focused product videos." },
  { key: "interactive_lessons", label: "Interactive Lessons", description: "Hands-on practice in a safe sandbox." },
  { key: "practice", label: "Practice Environment", description: "Explore with realistic sample data." },
  { key: "knowledge_base", label: "Knowledge Base", description: "Searchable documentation and FAQs." },
  { key: "ai_trainer", label: "AI Trainer", description: "Ask the assistant anything about the platform." },
  { key: "certification", label: "Certification", description: "Earn administrator and user certificates." },
] as const;

export const TRAINING_AUDIENCES = [
  "Administrator Training",
  "End User Training",
  "Manager Training",
  "Finance Training",
  "HR Training",
  "IT Training",
] as const;

export function planDisplayName(planCode?: string | null): string {
  if (!planCode) return "Trial";
  return PLANS[planCode.toLowerCase()]?.name ?? planCode;
}
