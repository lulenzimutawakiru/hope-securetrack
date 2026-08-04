/**
 * Reporting data source registry.
 *
 * Maps report `data_source` keys to real operational tables so the universal
 * report engine can resolve, company-scope, and aggregate data without ever
 * trusting client-supplied table names. Sources not present in this registry
 * are rejected before any query is built.
 *
 * Column-level access is enforced dynamically: a requested column is only
 * used if it exists on the resolved table (introspected per run), and all
 * reads are scoped to `company_id` from the authenticated session.
 */

export type ReportSource = {
  /** Real table name in the public schema */
  table: string;
  /** Module the source belongs to (catalog facet) */
  module: string;
  /** Preferred numeric metric column when aggregating (fallback hint) */
  metricHint?: string;
};

const SOURCES: Record<string, ReportSource> = {
  // ---- Finance & Accounting ----
  chart_of_accounts: { table: "chart_of_accounts", module: "finance", metricHint: "balance" },
  gl_journals: { table: "gl_journals", module: "finance", metricHint: "amount" },
  gl_journal_lines: { table: "gl_journal_lines", module: "finance", metricHint: "amount" },
  fin_posting_batches: { table: "fin_posting_batches", module: "finance", metricHint: "total_amount" },
  fiscal_periods: { table: "fiscal_periods", module: "finance" },
  currencies: { table: "currencies", module: "finance" },
  tax_codes: { table: "tax_codes", module: "finance", metricHint: "rate" },
  cost_centers: { table: "cost_centers", module: "finance" },
  budgets: { table: "budgets", module: "finance", metricHint: "amount" },
  budget_lines: { table: "budget_lines", module: "finance", metricHint: "amount" },
  invoices: { table: "invoices", module: "finance", metricHint: "total_amount" },
  ar_receipts: { table: "ar_receipts", module: "finance", metricHint: "amount" },
  ar_credit_notes: { table: "ar_credit_notes", module: "finance", metricHint: "amount" },
  ap_invoices: { table: "ap_invoices", module: "finance", metricHint: "total_amount" },
  ap_payments: { table: "ap_payments", module: "finance", metricHint: "amount" },
  bank_transactions: { table: "bank_transactions", module: "finance", metricHint: "amount" },
  bank_reconciliations: { table: "bank_reconciliations", module: "finance", metricHint: "closing_balance" },
  fin_expense_claims: { table: "fin_expense_claims", module: "finance", metricHint: "amount" },
  fixed_assets: { table: "fixed_assets", module: "finance", metricHint: "cost" },
  depreciation_entries: { table: "depreciation_entries", module: "finance", metricHint: "amount" },
  fin_production_profitability: { table: "fin_production_profitability", module: "finance", metricHint: "profit" },

  // ---- Sales & CRM ----
  customers: { table: "customers", module: "crm" },
  contracts: { table: "contracts", module: "crm", metricHint: "value" },
  sales_leads: { table: "sales_leads", module: "crm" },
  sales_opportunities: { table: "sales_opportunities", module: "crm", metricHint: "expected_value" },
  sales_orders: { table: "sales_orders", module: "crm", metricHint: "total_amount" },

  // ---- Procurement ----
  suppliers: { table: "suppliers", module: "procurement" },
  purchase_orders: { table: "purchase_orders", module: "procurement", metricHint: "total_amount" },
  purchase_requisitions: { table: "purchase_requisitions", module: "procurement", metricHint: "estimated_cost" },
  goods_receipts: { table: "goods_receipts", module: "procurement", metricHint: "quantity" },
  supplier_scorecards: { table: "supplier_scorecards", module: "procurement", metricHint: "score" },
  procurement_contracts: { table: "procurement_contracts", module: "procurement", metricHint: "value" },

  // ---- Inventory & Warehouse ----
  stock_balances: { table: "stock_balances", module: "inventory", metricHint: "quantity" },
  stock_adjustments: { table: "stock_adjustments", module: "inventory", metricHint: "quantity" },
  stock_transfers: { table: "stock_transfers", module: "inventory", metricHint: "quantity" },
  cycle_counts: { table: "cycle_counts", module: "inventory", metricHint: "quantity" },

  // ---- Manufacturing & Quality ----
  mes_production_orders: { table: "mes_production_orders", module: "production", metricHint: "planned_quantity" },
  mes_production_lines: { table: "mes_production_lines", module: "production", metricHint: "quantity" },
  mes_material_issues: { table: "mes_material_issues", module: "production", metricHint: "quantity" },
  mes_waste_records: { table: "mes_waste_records", module: "production", metricHint: "quantity" },
  mes_downtime: { table: "mes_downtime", module: "production", metricHint: "duration_minutes" },
  mes_oee_snapshots: { table: "mes_oee_snapshots", module: "production", metricHint: "oee" },
  mes_maintenance_orders: { table: "mes_maintenance_orders", module: "production", metricHint: "cost" },
  mes_quality_inspections: { table: "mes_quality_inspections", module: "quality" },
  mes_ncr: { table: "mes_ncr", module: "quality" },

  // ---- Assets ----
  ast_assets: { table: "ast_assets", module: "assets", metricHint: "cost" },

  // ---- Fleet ----
  fleet_vehicles: { table: "fleet_vehicles", module: "fleet", metricHint: "cost" },
  fleet_trips: { table: "fleet_trips", module: "fleet", metricHint: "distance_km" },
  fleet_fuel_logs: { table: "fleet_fuel_logs", module: "fleet", metricHint: "quantity" },
  fleet_costs: { table: "fleet_costs", module: "fleet", metricHint: "amount" },
  fleet_maintenance: { table: "fleet_maintenance", module: "fleet", metricHint: "cost" },
  fleet_deliveries: { table: "fleet_deliveries", module: "fleet", metricHint: "quantity" },
  fleet_driver_performance: { table: "fleet_driver_performance", module: "fleet", metricHint: "score" },
  fleet_vehicle_documents: { table: "fleet_vehicle_documents", module: "fleet" },
  fleet_accidents: { table: "fleet_accidents", module: "fleet" },

  // ---- HR, Payroll, Recruitment ----
  employees: { table: "employees", module: "hr" },
  employee_exits: { table: "employee_exits", module: "hr" },
  attendance_records: { table: "attendance_records", module: "hr" },
  leave_requests: { table: "leave_requests", module: "hr" },
  pay_payslips: { table: "pay_payslips", module: "payroll", metricHint: "net_pay" },
  payroll_runs: { table: "payroll_runs", module: "payroll", metricHint: "total_amount" },
  ta_vacancies: { table: "ta_vacancies", module: "recruitment" },
  ta_applications: { table: "ta_applications", module: "recruitment" },

  // ---- Projects ----
  ppm_projects: { table: "ppm_projects", module: "projects", metricHint: "budget" },
  ppm_tasks: { table: "ppm_tasks", module: "projects", metricHint: "planned_hours" },
  ppm_budgets: { table: "ppm_budgets", module: "projects", metricHint: "amount" },
  ppm_expenses: { table: "ppm_expenses", module: "projects", metricHint: "amount" },
  ppm_revenue: { table: "ppm_revenue", module: "projects", metricHint: "amount" },
  ppm_risks: { table: "ppm_risks", module: "projects" },
  ppm_issues: { table: "ppm_issues", module: "projects" },
  ppm_portfolios: { table: "ppm_portfolios", module: "projects" },
  ppm_resource_allocations: { table: "ppm_resource_allocations", module: "projects", metricHint: "allocation_pct" },
  ppm_timesheets: { table: "ppm_timesheets", module: "projects", metricHint: "hours" },

  // ---- Service Desk ----
  support_tickets: { table: "support_tickets", module: "servicedesk" },
  sd_problems: { table: "sd_problems", module: "servicedesk" },
  sd_csat_responses: { table: "sd_csat_responses", module: "servicedesk", metricHint: "score" },

  // ---- Security, Audit, Compliance ----
  login_history: { table: "login_history", module: "security" },
  security_alerts: { table: "security_alerts", module: "security" },
  audit_log: { table: "audit_log", module: "audit" },
  eal_events: { table: "eal_events", module: "compliance" },
  eal_approvals: { table: "eal_approvals", module: "compliance" },
  eal_controls: { table: "eal_controls", module: "compliance" },
  eal_findings: { table: "eal_findings", module: "compliance" },

  // ---- BI internal sources ----
  bi_kpis: { table: "bi_kpis", module: "bi", metricHint: "actual_value" },
  bi_ai_insights: { table: "bi_ai_insights", module: "bi", metricHint: "impact_score" },
};

/** Legacy seeds reference sources that no longer exist as tables. */
const LEGACY_SOURCES = new Set(["inventory_balances", "production_batches", "verification_logs"]);

export function isKnownSource(key: string | null | undefined): boolean {
  if (!key) return false;
  return key in SOURCES;
}

export function isLegacySource(key: string | null | undefined): boolean {
  return Boolean(key && LEGACY_SOURCES.has(key));
}

export function resolveSource(key: string | null | undefined): ReportSource | null {
  if (!key) return null;
  return SOURCES[key] ?? null;
}

export function listSources(): Array<ReportSource & { key: string }> {
  return Object.entries(SOURCES).map(([key, src]) => ({ key, ...src }));
}

export function sourceModules(): string[] {
  return [...new Set(Object.values(SOURCES).map((s) => s.module))].sort();
}

/** Column-name safety: only allow simple snake_case identifiers. */
export function isValidColumn(name: unknown): name is string {
  return (
    typeof name === "string" &&
    /^[a-z][a-z0-9_]{0,62}$/i.test(name)
  );
}

/** Operator whitelist for ad-hoc filters. */
export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";

export function isValidOperator(op: unknown): op is FilterOperator {
  return ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"].includes(String(op));
}