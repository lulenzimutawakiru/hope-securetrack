/** Enterprise Finance domain types */

export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "cost_of_sales",
  "operating_expense",
  "admin_expense",
  "manufacturing_overhead",
  "financial_income",
  "financial_expense",
  "tax",
  "memorandum",
] as const;

export const JOURNAL_TYPES = [
  "sales",
  "purchase",
  "cash",
  "bank",
  "payroll",
  "inventory",
  "manufacturing",
  "depreciation",
  "adjustment",
  "closing",
  "intercompany",
  "general",
] as const;

export const PRODUCT_LINES = [
  "security_print",
  "bond",
  "packaging",
  "export",
  "gov",
  "corporate",
  "education",
] as const;

export interface JournalInput {
  company_id: string;
  journal_type?: string;
  journal_date?: string;
  description: string;
  currency?: string;
  source_module?: string;
  source_ref?: string;
  created_by?: string | null;
  lines: Array<{
    account_id?: string | null;
    account_code?: string;
    description?: string;
    debit?: number;
    credit?: number;
    cost_center_id?: string | null;
  }>;
}

export interface CostRollInput {
  company_id: string;
  product_name: string;
  product_line?: string;
  production_order_ref?: string;
  batch_qty?: number;
  unit_label?: string;
  direct_materials?: number;
  direct_labor?: number;
  factory_overhead?: number;
  machine_cost?: number;
  utility_cost?: number;
  packaging_cost?: number;
  transport_cost?: number;
  scrap_cost?: number;
  sheets_per_batch?: number;
  reams_per_batch?: number;
  boxes_per_batch?: number;
  pallets_per_batch?: number;
  tons_per_batch?: number;
  standard_cost?: number;
  created_by?: string | null;
}

export interface ApprovalInput {
  company_id: string;
  entity_type: string;
  entity_ref: string;
  amount?: number;
  currency?: string;
  requested_by?: string | null;
  level_required?: number;
  comments?: string;
}
