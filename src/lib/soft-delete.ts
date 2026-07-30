/**
 * Soft-delete / restore helpers for enterprise recycle bin.
 * Prefer deleted_at over hard delete for recoverable records.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type SoftDeleteTable =
  | "chart_of_accounts"
  | "products"
  | "branches"
  | "gl_journals"
  | "ap_invoices"
  | "bank_accounts"
  | "fixed_assets"
  | "budgets"
  | "bi_report_definitions"
  | "bi_dashboards"
  | "bi_kpis"
  | "bi_intelligent_documents"
  | "suppliers"
  | "employees"
  | "wid_identities"
  | "wid_credentials"
  | "wid_card_templates"
  | "wid_card_brands"
  | "wid_card_inventory"
  | "invoices"
  | "customers"
  | "bill_invoice_templates"
  | "bill_recurring_schedules"
  | "fleet_vehicles"
  | "fleet_drivers"
  | "ppm_projects"
  | "ppm_tasks"
  | "att_locations"
  | "att_devices"
  | "fin_expense_claims"
  | "fin_posting_rules"
  | "sales_orders"
  | "sales_leads"
  | "sales_opportunities"
  | "quotations"
  | "sales_contracts"
  | "sales_price_lists"
  | "sales_teams"
  | "sales_targets"
  | "sales_forecasts"
  | "lbl_templates"
  | "lbl_batches"
  | "lbl_instances"
  | "lbl_materials"
  | "lbl_formats"
  | "ta_vacancies"
  | "ta_candidates"
  | "ta_applications"
  | "ta_offers"
  | "ta_requisitions"
  | "pay_employee_profiles"
  | "pay_components"
  | "pay_salary_structures"
  | "pay_loans"
  | "pay_benefit_plans"
  | "pay_bonuses"
  | "pay_calendars"
  | "pay_periods"
  | "pay_commissions"
  | "pay_incentives"
  | "pay_formulas"
  | "pay_simulations"
  | "pay_corrections"
  | "pay_final_settlements"
  | "pay_cost_allocations"
  | "pay_mobile_money"
  | "pay_bank_files"
  | "wf_instances"
  | "bill_portal_users"
  | "hc_meetings"
  | "hc_channels"
  | "purchase_orders"
  | "purchase_requisitions"
  | "work_orders"
  | "mes_work_orders";

export async function softDelete(
  supabase: SupabaseClient,
  table: string,
  id: string,
  extra?: Record<string, unknown>
) {
  return supabase
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      ...(extra || {}),
    })
    .eq("id", id);
}

export async function softDeleteMany(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  extra?: Record<string, unknown>
) {
  return supabase
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      ...(extra || {}),
    })
    .in("id", ids);
}

export async function restoreRecord(
  supabase: SupabaseClient,
  table: string,
  id: string,
  extra?: Record<string, unknown>
) {
  return supabase
    .from(table)
    .update({
      deleted_at: null,
      ...(extra || {}),
    })
    .eq("id", id);
}

export async function restoreMany(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  extra?: Record<string, unknown>
) {
  return supabase
    .from(table)
    .update({
      deleted_at: null,
      ...(extra || {}),
    })
    .in("id", ids);
}

/** Tables registered in the Recycle Bin hub */
export const RECYCLE_BIN_SOURCES: Array<{
  table: string;
  label: string;
  titleKey: string;
  codeKey?: string;
  module: string;
}> = [
  {
    table: "chart_of_accounts",
    label: "Chart of Accounts",
    titleKey: "account_name",
    codeKey: "account_code",
    module: "finance",
  },
  {
    table: "products",
    label: "Products",
    titleKey: "name",
    codeKey: "product_code",
    module: "products",
  },
  {
    table: "branches",
    label: "Branches",
    titleKey: "name",
    codeKey: "code",
    module: "settings",
  },
  {
    table: "gl_journals",
    label: "GL Journals",
    titleKey: "journal_number",
    codeKey: "journal_type",
    module: "finance",
  },
  {
    table: "ap_invoices",
    label: "AP Invoices",
    titleKey: "invoice_number",
    module: "finance",
  },
  {
    table: "bank_accounts",
    label: "Bank Accounts",
    titleKey: "account_name",
    codeKey: "account_code",
    module: "finance",
  },
  {
    table: "fixed_assets",
    label: "Fixed Assets",
    titleKey: "asset_name",
    codeKey: "asset_code",
    module: "finance",
  },
  {
    table: "budgets",
    label: "Budgets",
    titleKey: "name",
    codeKey: "budget_code",
    module: "finance",
  },
  {
    table: "wid_identities",
    label: "Workforce Identities",
    titleKey: "full_name",
    codeKey: "identity_number",
    module: "credentials",
  },
  {
    table: "wid_credentials",
    label: "ID Credentials",
    titleKey: "credential_number",
    codeKey: "status",
    module: "credentials",
  },
  {
    table: "wid_card_templates",
    label: "Card Templates",
    titleKey: "name",
    codeKey: "template_code",
    module: "credentials",
  },
  {
    table: "wid_card_inventory",
    label: "Card Inventory Batches",
    titleKey: "batch_number",
    codeKey: "card_type",
    module: "credentials",
  },
  {
    table: "invoices",
    label: "Invoices",
    titleKey: "invoice_number",
    codeKey: "status",
    module: "billing",
  },
  {
    table: "sales_orders",
    label: "Sales Orders",
    titleKey: "order_number",
    codeKey: "status",
    module: "sales",
  },
  {
    table: "sales_leads",
    label: "Sales Leads",
    titleKey: "company_name",
    codeKey: "lead_number",
    module: "sales",
  },
  {
    table: "sales_opportunities",
    label: "Opportunities",
    titleKey: "name",
    codeKey: "opportunity_number",
    module: "sales",
  },
  {
    table: "quotations",
    label: "Quotations",
    titleKey: "quote_number",
    codeKey: "status",
    module: "sales",
  },
  {
    table: "sales_contracts",
    label: "Sales Contracts",
    titleKey: "name",
    codeKey: "contract_number",
    module: "sales",
  },
  {
    table: "sales_price_lists",
    label: "Price Lists",
    titleKey: "name",
    codeKey: "price_list_code",
    module: "sales",
  },
  {
    table: "lbl_templates",
    label: "Label Templates",
    titleKey: "name",
    codeKey: "template_code",
    module: "labels",
  },
  {
    table: "lbl_batches",
    label: "Label Batches",
    titleKey: "name",
    codeKey: "batch_code",
    module: "labels",
  },
  {
    table: "lbl_instances",
    label: "Label Instances",
    titleKey: "label_number",
    codeKey: "serial_number",
    module: "labels",
  },
  {
    table: "lbl_materials",
    label: "Label Materials",
    titleKey: "name",
    codeKey: "material_code",
    module: "labels",
  },
  {
    table: "lbl_formats",
    label: "Label Formats",
    titleKey: "name",
    codeKey: "format_code",
    module: "labels",
  },
  {
    table: "ta_vacancies",
    label: "Vacancies",
    titleKey: "title",
    codeKey: "vacancy_code",
    module: "talent",
  },
  {
    table: "ta_candidates",
    label: "Candidates",
    titleKey: "first_name",
    codeKey: "candidate_number",
    module: "talent",
  },
  {
    table: "ta_applications",
    label: "Applications",
    titleKey: "candidate_name",
    codeKey: "application_number",
    module: "talent",
  },
  {
    table: "ta_offers",
    label: "Offers",
    titleKey: "candidate_name",
    codeKey: "offer_number",
    module: "talent",
  },
  {
    table: "pay_employee_profiles",
    label: "Pay Profiles",
    titleKey: "salary_grade",
    codeKey: "employee_id",
    module: "payroll",
  },
  {
    table: "pay_loans",
    label: "Payroll Loans",
    titleKey: "loan_type",
    codeKey: "loan_number",
    module: "payroll",
  },
  {
    table: "pay_commissions",
    label: "Commissions",
    titleKey: "employee_name",
    codeKey: "commission_code",
    module: "payroll",
  },
  {
    table: "pay_incentives",
    label: "Incentives",
    titleKey: "name",
    codeKey: "incentive_code",
    module: "payroll",
  },
  {
    table: "pay_simulations",
    label: "Payroll Simulations",
    titleKey: "name",
    codeKey: "simulation_code",
    module: "payroll",
  },
  {
    table: "pay_final_settlements",
    label: "Final Settlements",
    titleKey: "employee_name",
    codeKey: "settlement_code",
    module: "payroll",
  },
  {
    table: "customers",
    label: "Billing Customers",
    titleKey: "name",
    codeKey: "code",
    module: "billing",
  },
  {
    table: "bill_invoice_templates",
    label: "Invoice Templates",
    titleKey: "name",
    codeKey: "template_code",
    module: "billing",
  },
  // Fleet
  {
    table: "fleet_vehicles",
    label: "Fleet Vehicles",
    titleKey: "registration",
    codeKey: "vehicle_code",
    module: "fleet",
  },
  {
    table: "fleet_drivers",
    label: "Fleet Drivers",
    titleKey: "full_name",
    codeKey: "driver_code",
    module: "fleet",
  },
  // Projects (PPM)
  {
    table: "ppm_projects",
    label: "Projects",
    titleKey: "name",
    codeKey: "project_code",
    module: "projects",
  },
  {
    table: "ppm_tasks",
    label: "Project Tasks",
    titleKey: "name",
    codeKey: "task_code",
    module: "projects",
  },
  // Attendance
  {
    table: "att_locations",
    label: "Attendance Locations",
    titleKey: "name",
    codeKey: "location_code",
    module: "attendance",
  },
  {
    table: "att_devices",
    label: "Attendance Devices",
    titleKey: "name",
    codeKey: "device_code",
    module: "attendance",
  },
  {
    table: "att_policies",
    label: "Attendance Policies",
    titleKey: "name",
    codeKey: "policy_code",
    module: "attendance",
  },
  // Finance lifecycle
  {
    table: "fin_expense_claims",
    label: "Expense Claims",
    titleKey: "claim_number",
    codeKey: "claimant_name",
    module: "finance",
  },
  {
    table: "fin_posting_rules",
    label: "Posting Rules",
    titleKey: "name",
    codeKey: "rule_code",
    module: "finance",
  },
  {
    table: "fin_leases",
    label: "Leases",
    titleKey: "lease_number",
    codeKey: "lessor_name",
    module: "finance",
  },
];
