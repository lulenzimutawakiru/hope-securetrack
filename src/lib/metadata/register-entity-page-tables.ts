/**
 * Registers business tables used by generated module EntityPages so they are
 * available through `/api/v2/crud/[entity]`.
 *
 * Entity key === table name. Idempotent: skips tables already defined in
 * ENTITY_REGISTRY (core entities win).
 *
 * Soft-delete + common searchable columns match the EntityPage UX.
 */

import {
  defineEntity,
  getEntityDefinition,
  type EntityModule,
} from "@/lib/metadata/entity-registry";
import { listFinEntityTables } from "@/lib/finance/entities";
import { listPayEntityTables } from "@/lib/payroll/entities";
import { listFleetEntityTables } from "@/lib/fleet/entities";
import { listSalesEntityTables } from "@/lib/sales/entities";
import { listAttEntityTables } from "@/lib/attendance/entities";
import { listTaEntityTables } from "@/lib/ta/entities";
import { listPpmEntityTables } from "@/lib/ppm/entities";
import { listLblEntityTables } from "@/lib/lbl/entities";
import { listMesEntityTables } from "@/lib/mes/entities";

type ModuleSpec = {
  module: EntityModule;
  view: string;
  manage: string;
};

/** Map table name prefix → module + permission slugs. */
function resolveSpec(table: string): ModuleSpec {
  if (table.startsWith("fin_") || table === "fiscal_years") {
    return { module: "finance", view: "finance.view", manage: "finance.manage" };
  }
  if (table.startsWith("pay_")) {
    return { module: "payroll", view: "payroll.view", manage: "payroll.manage" };
  }
  if (table.startsWith("fleet_")) {
    return { module: "fleet", view: "fleet.view", manage: "fleet.manage" };
  }
  if (table.startsWith("sales_")) {
    return { module: "sales", view: "sales.view", manage: "sales.manage" };
  }
  if (table.startsWith("att_")) {
    return {
      module: "attendance",
      view: "attendance.view",
      manage: "attendance.manage",
    };
  }
  if (table.startsWith("ta_")) {
    return { module: "ta", view: "ta.view", manage: "ta.manage" };
  }
  if (table.startsWith("ppm_")) {
    return { module: "ppm", view: "ppm.view", manage: "ppm.manage" };
  }
  if (table.startsWith("lbl_")) {
    return { module: "print", view: "print.view", manage: "print.manage" };
  }
  if (table.startsWith("mes_")) {
    return { module: "mes", view: "mes.view", manage: "mes.manage" };
  }
  // Fallbacks used by entity configs that share core tables
  if (table.startsWith("ar_") || table.startsWith("ap_") || table.startsWith("bank_")) {
    return { module: "finance", view: "finance.view", manage: "finance.manage" };
  }
  if (table === "credit_reviews") {
    return { module: "crm", view: "crm.view", manage: "crm.manage" };
  }
  if (table === "support_tickets") {
    return { module: "sd", view: "sd.view", manage: "sd.manage" };
  }
  if (table === "attendance_records" || table.startsWith("shift_")) {
    return {
      module: "attendance",
      view: "attendance.view",
      manage: "attendance.manage",
    };
  }
  return { module: "settings", view: "settings.view", manage: "settings.manage" };
}

/**
 * Tables referenced by module EntityPage configs that are not always present
 * in the hand-authored registry. Keep sorted for reviewability.
 */
export const ENTITY_PAGE_TABLES: readonly string[] = [
  // Finance
  "fin_account_groups",
  "fin_dimensions",
  "fin_profit_centers",
  "fin_business_units",
  "fin_journal_templates",
  "fin_recurring_journals",
  "fin_posting_batches",
  "fin_trial_balance",
  "fin_period_locks",
  "fin_ar_debit_notes",
  "fin_collections",
  "fin_payment_plans",
  "fin_customer_statements",
  "fin_recurring_invoices",
  "fin_ap_credit_notes",
  "fin_ap_debit_notes",
  "fin_payment_runs",
  "fin_supplier_statements",
  "fin_supplier_recon",
  "fin_banks",
  "fin_bank_statements",
  "fin_electronic_payments",
  "fin_petty_cash",
  "fin_cash_forecasts",
  "fin_liquidity",
  "fin_investments",
  "fin_loans",
  "fin_letters_of_credit",
  "fin_guarantees",
  "fin_budget_templates",
  "fin_budget_revisions",
  "fin_budget_variance",
  "fin_forecasts",
  "fin_costing_methods",
  "fin_standard_costs",
  "fin_cost_rolls",
  "fin_cost_variances",
  "fin_wip",
  "fin_withholding_tax",
  "fin_tax_jurisdictions",
  "fin_intercompany_txns",
  "fin_elimination_entries",
  "fin_notifications",
  "fin_settings",
  "fin_audit_log",
  "fin_mobile_money_txns",
  // Payroll
  "pay_calendars",
  "pay_periods",
  "pay_salary_grades",
  "pay_salary_bands",
  "pay_salary_scales",
  "pay_groups",
  "pay_commissions",
  "pay_incentives",
  "pay_shift_premiums",
  "pay_formulas",
  "pay_simulations",
  "pay_corrections",
  "pay_final_settlements",
  "pay_cost_allocations",
  "pay_mobile_money",
  "pay_bank_files",
  "pay_pension_schemes",
  "pay_gratuity_rules",
  "pay_gl_mappings",
  "pay_documents",
  "pay_settings",
  "pay_audit",
  // Fleet
  "fleet_vehicle_categories",
  "fleet_vehicle_types",
  "fleet_vehicle_brands",
  "fleet_vehicle_models",
  "fleet_vehicle_documents",
  "fleet_vehicle_photos",
  "fleet_vehicle_assignments",
  "fleet_drivers",
  "fleet_driver_licenses",
  "fleet_driver_certifications",
  "fleet_driver_training",
  "fleet_driver_medicals",
  "fleet_driver_violations",
  "fleet_driver_performance",
  "fleet_driver_attendance",
  "fleet_gps_devices",
  "fleet_gps_locations",
  "fleet_geofences",
  "fleet_trips",
  "fleet_trip_requests",
  "fleet_trip_routes",
  "fleet_dispatch_orders",
  "fleet_deliveries",
  "fleet_proof_of_delivery",
  "fleet_containers",
  "fleet_cargo",
  "fleet_fuel_stations",
  "fleet_fuel_cards",
  "fleet_fuel_requests",
  "fleet_fuel_transactions",
  "fleet_maintenance_plans",
  "fleet_work_orders",
  "fleet_repair_orders",
  "fleet_workshops",
  "fleet_mechanics",
  "fleet_spare_parts",
  "fleet_tyres",
  "fleet_batteries",
  "fleet_insurance_policies",
  "fleet_road_licenses",
  "fleet_inspections",
  "fleet_accidents",
  "fleet_claims",
  "fleet_odometer_logs",
  "fleet_costs",
  "fleet_iot_devices",
  "fleet_telematics",
  "fleet_approvals",
  "fleet_notifications",
  "fleet_settings",
  "fleet_audit_log",
  // Sales
  "sales_activities",
  "sales_call_logs",
  "sales_competitors",
  "sales_price_lists",
  "sales_price_items",
  "sales_discount_rules",
  "sales_promotions",
  "sales_order_approvals",
  "sales_settings",
  "sales_contracts",
  "sales_contract_lines",
  "sales_rebates",
  "sales_territories",
  "sales_teams",
  "sales_channels",
  "sales_visit_plans",
  "sales_samples",
  "sales_forecasts",
  "sales_targets",
  "sales_return_lines",
  "sales_documents",
  "sales_insights",
  "sales_notifications",
  "sales_audit_log",
  "sales_ai_insights",
  // Attendance
  "att_devices",
  "att_device_users",
  "att_device_punches",
  "att_device_integrations",
  "att_events",
  "att_policies",
  "att_shift_rotations",
  "att_shift_swaps",
  "att_breaks",
  "att_holidays",
  "att_corrections",
  "att_approvals",
  "att_qr_tokens",
  "att_beacons",
  "att_nfc_tags",
  "att_rfid_badges",
  "att_remote_work",
  "att_field_assignments",
  "att_violations",
  "att_notifications",
  "att_settings",
  "att_audit_log",
  // Talent
  "ta_headcount_plans",
  "ta_requisitions",
  "ta_positions",
  "ta_job_library",
  "ta_pipeline_stages",
  "ta_talent_pool",
  "ta_referrals",
  "ta_agencies",
  "ta_campus_events",
  "ta_assessments",
  "ta_assessment_attempts",
  "ta_interviews",
  "ta_background_checks",
  "ta_references",
  "ta_medical_exams",
  "ta_offers",
  "ta_onboarding_tasks",
  "ta_documents",
  "ta_settings",
  "ta_audit_log",
  "ta_ai_insights",
  // PPM
  "ppm_portfolios",
  "ppm_programs",
  "ppm_templates",
  "ppm_project_requests",
  "ppm_business_cases",
  "ppm_categories",
  "ppm_project_types",
  "ppm_wbs",
  "ppm_milestones",
  "ppm_deliverables",
  "ppm_tasks",
  "ppm_checklists",
  "ppm_dependencies",
  "ppm_sprints",
  "ppm_backlog",
  "ppm_roadmap",
  "ppm_resources",
  "ppm_resource_allocations",
  "ppm_timesheets",
  "ppm_time_logs",
  "ppm_budgets",
  "ppm_expenses",
  "ppm_purchase_requests",
  "ppm_documents",
  "ppm_change_requests",
  "ppm_risks",
  "ppm_issues",
  "ppm_decisions",
  "ppm_lessons",
  "ppm_meetings",
  "ppm_inspections",
  "ppm_ncr",
  "ppm_invoices",
  "ppm_progress_claims",
  "ppm_retentions",
  "ppm_revenue",
  "ppm_asset_allocations",
  "ppm_inventory_allocations",
  "ppm_approvals",
  "ppm_notifications",
  "ppm_settings",
  "ppm_audit_log",
  "ppm_baselines",
  "ppm_calendar_events",
  // Labels
  "lbl_formats",
  "lbl_categories",
  "lbl_templates",
  "lbl_fields",
  "lbl_variables",
  "lbl_materials",
  "lbl_stock",
  "lbl_barcodes",
  "lbl_gs1",
  "lbl_security",
  "lbl_rules",
  "lbl_batches",
  "lbl_instances",
  "lbl_jobs",
  "lbl_reprints",
  "lbl_approvals",
  "lbl_shipping",
  "lbl_pallet",
  "lbl_shelf",
  "lbl_compliance",
  "lbl_printer_profiles",
  "lbl_documents",
  "lbl_notifications",
  "lbl_settings",
  "lbl_audit_log",
  "lbl_ai_insights",
] as const;

let registered = false;

function registerTable(table: string): boolean {
  if (getEntityDefinition(table)) return false;
  const spec = resolveSpec(table);
  defineEntity(
    table,
    table,
    spec.module,
    {
      view: spec.view,
      create: spec.manage,
      update: spec.manage,
      delete: spec.manage,
    },
    {
      softDelete: true,
      searchable: [
        "name",
        "code",
        "title",
        "status",
        "description",
        "number",
        "reference",
      ],
      createdBy: true,
      updatedBy: true,
    }
  );
  return true;
}

/**
 * Ensure entity-page tables are in the registry. Safe to call multiple times.
 * Returns the number of newly registered entities.
 */
export function ensureEntityPageTablesRegistered(): number {
  if (registered) return 0;
  registered = true;
  let count = 0;
  for (const table of ENTITY_PAGE_TABLES) {
    if (registerTable(table)) count += 1;
  }
  // Also register every table referenced by module EntityPage configs.
  const extraTables = [
    ...listFinEntityTables(),
    ...listPayEntityTables(),
    ...listFleetEntityTables(),
    ...listSalesEntityTables(),
    ...listAttEntityTables(),
    ...listTaEntityTables(),
    ...listPpmEntityTables(),
    ...listLblEntityTables(),
    ...listMesEntityTables(),
  ];
  for (const table of extraTables) {
    if (registerTable(table)) count += 1;
  }
  return count;
}

// Register on module load so /api/v2/crud and getEntityDefinition see them.
ensureEntityPageTablesRegistered();
