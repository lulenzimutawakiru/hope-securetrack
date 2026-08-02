/**
 * RLS business permission enforcement (Phase 2) — static contract.
 *
 * Verifies the migration supabase/migrations/20260801000002_rls_business_permission_enforcement.sql
 * actually hardens the data-layer RBAC gap:
 *
 *   - Every high-risk business table gets RESTRICTIVE write policies
 *     (INSERT / UPDATE / DELETE) gated on module permissions or super admin.
 *   - SELECT stays open to company members (the client UI reads directly).
 *   - The roles restrictive policy keeps global role templates readable
 *     (company_id IS NULL AND tenant_id IS NULL) while writes stay locked.
 *
 * Pure static guarantees: no database, no credentials, runs in CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260801000002_rls_business_permission_enforcement.sql"
);

const sql = readFileSync(MIGRATION, "utf8");

/** Every table that receives RESTRICTIVE write policies in this phase. */
const HARDENED_TABLES = [
  // Finance / accounting
  "invoices",
  "invoice_payments",
  "gl_journals",
  "gl_journal_lines",
  "ar_receipts",
  "ar_credit_notes",
  "ap_invoices",
  "ap_payments",
  "fin_auto_journals",
  // Payroll
  "payroll_runs",
  "payroll_lines",
  "pay_payslips",
  "pay_payment_batches",
  // Sales / CRM
  "sales_orders",
  "customers",
  // HR
  "employees",
  // Procurement
  "purchase_orders",
  "purchase_order_lines",
  "suppliers",
  // Parent-scoped line items (no own tenant_id; gated via parent)
  "invoice_lines",
  "sales_order_lines",
] as const;

const WRITE_ACTIONS = ["insert", "update", "delete"] as const;

describe("RLS permission enforcement migration", () => {
  it("exists and is non-trivial", () => {
    expect(sql.length).toBeGreaterThan(10_000);
  });

  it("hardens every high-risk business table with write policies", () => {
    for (const table of HARDENED_TABLES) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sql,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sql,
          `${policy} must be RESTRICTIVE`
        ).toContain(`CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`);
      }
    }
  });

  it("defines exactly 63 write policies (21 tables x 3 actions)", () => {
    const created = sql.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    // SELECT policies remain permissive company-scoped; this phase only adds
    // RESTRICTIVE policies for write actions.
    const restrictiveSelect = sql.match(
      /AS RESTRICTIVE FOR SELECT/i
    );
    expect(restrictiveSelect).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    // Every write policy must reference the permission helper or super admin.
    const policyBodies = sql.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("restores read visibility of global role templates on roles", () => {
    const rolesPolicy = sql.match(
      /CREATE POLICY tenant_isolation_restrict ON roles[\s\S]*?;/i
    )?.[0];
    expect(rolesPolicy).toBeTruthy();
    expect(rolesPolicy).toContain("company_id IS NULL");
    expect(rolesPolicy).toContain("tenant_id IS NULL");
    expect(rolesPolicy).toContain("tenant_company_access(");
  });

  it("recreates the roles restrictive policy (drop before create)", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS tenant_isolation_restrict ON roles;");
    expect(sql).toContain("CREATE POLICY tenant_isolation_restrict ON roles");
  });

  it("uses only permission slugs verified against the live catalog", () => {
    // Finance
    expect(sql).toContain("'finance.manage'");
    expect(sql).toContain("'finance.post'");
    expect(sql).toContain("'finance.approve'");
    expect(sql).toContain("'finance.admin'");
    expect(sql).toContain("'finance.cfo'");
    expect(sql).toContain("'invoices.manage'");
    // Payroll
    expect(sql).toContain("'payroll.manage'");
    expect(sql).toContain("'payroll.process'");
    expect(sql).toContain("'payroll.approve'");
    expect(sql).toContain("'payroll.pay'");
    expect(sql).toContain("'payroll.admin'");
    // Sales / CRM / HR / Procurement
    expect(sql).toContain("'sales.manage'");
    expect(sql).toContain("'sales.admin'");
    expect(sql).toContain("'crm.manage'");
    expect(sql).toContain("'crm.admin'");
    expect(sql).toContain("'hr.manage'");
    expect(sql).toContain("'users.manage'");
    expect(sql).toContain("'procurement.manage'");
    expect(sql).toContain("'procurement.approve'");
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    // These were candidate slugs that do NOT exist live — must not appear.
    for (const banned of ["sales.approve", "hr.admin", "hr.delete"]) {
      expect(sql, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});


/**
 * Phase 3 - RLS business permission enforcement part 2 (static contract).
 *
 * Verifies supabase/migrations/20260801000003_rls_business_permission_enforcement_part2.sql
 * extends the Phase 2 hardening to the remaining core ERP modules:
 * inventory, manufacturing (MES), fleet, projects (PPM), attendance / workforce
 * and recruitment (TA). Same guarantees as Phase 2: RESTRICTIVE write policies
 * (INSERT / UPDATE / DELETE) gated on module permissions or super admin, SELECT
 * stays open to company members, and every permission slug is verified against
 * the live permissions catalog.
 */
const MIGRATION_PART2 = resolve(
  process.cwd(),
  "supabase/migrations/20260801000003_rls_business_permission_enforcement_part2.sql"
);

const sqlPart2 = readFileSync(MIGRATION_PART2, "utf8");

/** Every table hardened in Phase 3 (65 tables x 3 write actions = 195 policies). */
const HARDENED_TABLES_PART2 = [
  // Inventory
  "products",
  "product_categories",
  "warehouses",
  "warehouse_zones",
  "warehouse_bins",
  "warehouse_racks",
  "stock_balances",
  "stock_adjustments",
  "stock_adjustment_lines",
  "stock_transfers",
  "stock_transfer_lines",
  "stock_reservations",
  // Manufacturing (MES)
  "bom_headers",
  "bom_lines",
  "mes_work_orders",
  "mes_production_orders",
  "mes_production_plans",
  "mes_rework_orders",
  "production_batches",
  "mes_work_centers",
  "mes_routings",
  "mes_routing_operations",
  "mes_quality_inspections",
  // Fleet
  "fleet_vehicles",
  "fleet_drivers",
  "fleet_fuel_logs",
  "fleet_fuel_requests",
  "fleet_maintenance",
  "fleet_trips",
  "fleet_repair_orders",
  "fleet_work_orders",
  "fleet_vehicle_assignments",
  "fleet_inspections",
  "fleet_insurance_policies",
  "fleet_settings",
  // Projects (PPM)
  "ppm_projects",
  "ppm_tasks",
  "ppm_milestones",
  "ppm_risks",
  "ppm_issues",
  "ppm_timesheets",
  "ppm_time_logs",
  "ppm_budgets",
  "ppm_expenses",
  "ppm_change_requests",
  "ppm_deliverables",
  "ppm_approvals",
  // Attendance / Workforce
  "attendance_records",
  "att_approvals",
  "att_corrections",
  "att_shift_swaps",
  "att_remote_work",
  "att_holidays",
  "att_settings",
  "shift_templates",
  "shift_assignments",
  // Recruitment (TA)
  "ta_vacancies",
  "ta_candidates",
  "ta_applications",
  "ta_requisitions",
  "ta_positions",
  "ta_interviews",
  "ta_offers",
  "ta_assessments",
  "ta_background_checks",
] as const;

/** Permission slugs verified against the live permissions catalog. */
const VERIFIED_SLUGS_PART2 = [
  "inventory.manage",
  "inventory.adjust",
  "inventory.move",
  "inventory.transfer",
  "inventory.grn",
  "inventory.qc",
  "inventory.valuation",
  "products.manage",
  "mes.manage",
  "mes.plan",
  "mes.planning",
  "mes.operate",
  "mes.shopfloor",
  "mes.quality",
  "quality.approve",
  "production.create",
  "production.edit",
  "production.manage",
  "fleet.manage",
  "fleet.admin",
  "fleet.approve",
  "fleet.dispatch",
  "fleet.drivers",
  "fleet.fuel",
  "fleet.maintenance",
  "fleet.track",
  "ppm.manage",
  "ppm.admin",
  "ppm.approve",
  "ppm.execute",
  "ppm.plan",
  "ppm.finance",
  "att.manage",
  "att.admin",
  "att.approve",
  "att.field",
  "att.clock",
  "wfm.manage",
  "wfm.approve",
  "ta.manage",
  "ta.admin",
  "ta.recruit",
  "ta.approve",
  "hr.recruit",
] as const;

describe("RLS permission enforcement migration part 2 (inventory/mes/fleet/ppm/attendance/ta)", () => {
  it("exists and is non-trivial", () => {
    expect(sqlPart2.length).toBeGreaterThan(10_000);
  });

  it("hardens every module table with write policies", () => {
    for (const table of HARDENED_TABLES_PART2) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sqlPart2,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sqlPart2,
          `${policy} must be RESTRICTIVE`
        ).toContain(
          `CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`
        );
      }
    }
  });

  it("defines exactly 195 write policies (65 tables x 3 actions)", () => {
    const created =
      sqlPart2.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES_PART2.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
    // Drop-first convention: every CREATE has a matching DROP IF EXISTS
    const dropped =
      sqlPart2.match(/DROP POLICY IF EXISTS \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(dropped.length).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    expect(sqlPart2.match(/AS RESTRICTIVE FOR SELECT/i)).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    const policyBodies = sqlPart2.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    expect(policyBodies.length).toBe(HARDENED_TABLES_PART2.length * WRITE_ACTIONS.length);
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("gates parent-scoped line items through their header row", () => {
    // warehouse_racks has no own company_id; the write gate must require the
    // parent warehouse to belong to the caller's company.
    for (const action of WRITE_ACTIONS) {
      const marker = `CREATE POLICY warehouse_racks_write_restrict_${action} ON warehouse_racks AS RESTRICTIVE FOR ${action.toUpperCase()}`;
      const start = sqlPart2.indexOf(marker);
      expect(start, `${marker} must exist`).toBeGreaterThan(-1);
      const body = sqlPart2.slice(start, sqlPart2.indexOf(";", start) + 1);
      expect(body).toContain(
        "warehouse_id IN (SELECT id FROM warehouses WHERE company_id = public.user_company_id())"
      );
    }
  });

  it("uses only permission slugs verified against the live catalog", () => {
    const slugRe = /'([a-z]+\.[a-z]+)'/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugRe.exec(sqlPart2)) !== null) {
      found.add(match[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    const verified = new Set<string>(VERIFIED_SLUGS_PART2);
    for (const slug of found) {
      expect(verified.has(slug), `unverified slug ${slug}`).toBe(true);
    }
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    for (const banned of ["sales.approve", "hr.admin", "hr.delete"]) {
      expect(sqlPart2, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});

/**
 * Phase 4 - RLS business permission enforcement part 3 (static contract).
 *
 * Verifies supabase/migrations/20260801000004_rls_business_permission_enforcement_part3.sql
 * extends the hardening to the remaining ERP modules: finance / accounting
 * master data, payroll master & support tables, HR, CRM, sales, procurement,
 * billing and service desk. Same guarantees as Phases 2 and 3: RESTRICTIVE
 * write policies (INSERT / UPDATE / DELETE) gated on module permissions or
 * super admin, SELECT stays open to company members, and every permission slug
 * is verified against the live permissions catalog.
 */
const MIGRATION_PART3 = resolve(
  process.cwd(),
  "supabase/migrations/20260801000004_rls_business_permission_enforcement_part3.sql"
);

const sqlPart3 = readFileSync(MIGRATION_PART3, "utf8");

/** Every table hardened in Phase 4 (164 tables x 3 write actions = 492 policies). */
const HARDENED_TABLES_PART3 = [
  "chart_of_accounts",
  "budgets",
  "budget_lines",
  "cost_centers",
  "bank_accounts",
  "bank_transactions",
  "bank_reconciliations",
  "tax_codes",
  "treasury_facilities",
  "depreciation_entries",
  "credit_reviews",
  "fin_cash_positions",
  "fin_tax_returns",
  "pay_advances",
  "pay_loans",
  "pay_loan_schedules",
  "pay_components",
  "pay_employee_components",
  "pay_rules",
  "pay_salary_structures",
  "pay_salary_grades",
  "pay_salary_scales",
  "pay_salary_bands",
  "pay_structure_lines",
  "pay_tax_brackets",
  "pay_statutory_rates",
  "pay_periods",
  "pay_settings",
  "pay_gl_mappings",
  "pay_approvals",
  "pay_corrections",
  "pay_benefit_plans",
  "pay_employee_benefits",
  "pay_final_settlements",
  "pay_formulas",
  "pay_gratuity_rules",
  "pay_groups",
  "pay_incentives",
  "pay_mobile_money",
  "pay_overtime_claims",
  "pay_pension_schemes",
  "pay_shift_premiums",
  "pay_simulations",
  "pay_bonuses",
  "pay_commissions",
  "pay_cost_allocations",
  "pay_calendars",
  "pay_documents",
  "leave_requests",
  "leave_balances",
  "overtime_requests",
  "departments",
  "training_courses",
  "training_enrollments",
  "training_records",
  "performance_reviews",
  "safety_incidents",
  "safety_inductions",
  "public_holidays",
  "ppe_issuances",
  "crm_contacts",
  "crm_activities",
  "crm_campaigns",
  "crm_contracts",
  "crm_dealers",
  "crm_segments",
  "crm_consents",
  "crm_documents",
  "crm_notes",
  "crm_portal_requests",
  "crm_sales_targets",
  "crm_tenders",
  "crm_health_scores",
  "crm_loyalty_ledger",
  "crm_loyalty_programs",
  "crm_loyalty_rewards",
  "crm_communications",
  "crm_timeline",
  "crm_insights",
  "sales_leads",
  "sales_opportunities",
  "quotations",
  "sales_returns",
  "sales_contracts",
  "sales_contract_lines",
  "sales_order_approvals",
  "sales_price_lists",
  "sales_price_items",
  "sales_discount_rules",
  "sales_promotions",
  "sales_rebates",
  "sales_forecasts",
  "sales_teams",
  "sales_territories",
  "sales_targets",
  "sales_channels",
  "sales_commissions",
  "sales_visit_plans",
  "sales_samples",
  "sales_settings",
  "sales_documents",
  "sales_activities",
  "purchase_requisitions",
  "rfqs",
  "rfq_lines",
  "supplier_quotations",
  "supplier_quotation_lines",
  "procurement_contracts",
  "inbound_shipments",
  "inventory_approvals",
  "bill_contracts",
  "bill_contract_milestones",
  "bill_credit_notes",
  "bill_debit_notes",
  "bill_credit_approvals",
  "bill_credit_rules",
  "bill_payment_terms",
  "bill_payment_gateways",
  "bill_payment_intents",
  "bill_recurring_schedules",
  "bill_reminders",
  "bill_dunning_rules",
  "bill_fraud_alerts",
  "bill_invoice_templates",
  "bill_invoice_versions",
  "bill_price_lists",
  "bill_price_list_items",
  "bill_tax_codes",
  "bill_tax_groups",
  "bill_sequences",
  "bill_statement_requests",
  "bill_approval_actions",
  "bill_approval_steps",
  "bill_revenue_entries",
  "bill_revenue_schedules",
  "bill_reconciliation_batches",
  "bill_reconciliation_lines",
  "bill_portal_disputes",
  "bill_portal_users",
  "bill_projects",
  "bill_project_entries",
  "bill_delivery_links",
  "support_tickets",
  "sd_agents",
  "sd_approvals",
  "sd_automations",
  "sd_calendars",
  "sd_categories",
  "sd_changes",
  "sd_channels",
  "sd_cmdb_cis",
  "sd_cmdb_relations",
  "sd_csat_responses",
  "sd_escalation_rules",
  "sd_field_jobs",
  "sd_holidays",
  "sd_inbound_items",
  "sd_knowledge_articles",
  "sd_major_incidents",
  "sd_nps_responses",
  "sd_problems",
  "sd_sla_policies",
  "sd_teams",
  "sd_ticket_templates",
] as const;

/** Permission slugs verified against the live permissions catalog. */
const VERIFIED_SLUGS_PART3 = [
  "finance.manage",
  "finance.post",
  "finance.approve",
  "finance.admin",
  "finance.cfo",
  "finance.tax",
  "finance.bank",
  "finance.treasury",
  "finance.close",
  "finance.consolidate",
  "finance.costing",
  "finance.fpa",
  "finance.multibook",
  "payroll.manage",
  "payroll.process",
  "payroll.approve",
  "payroll.pay",
  "payroll.admin",
  "payroll.bank",
  "payroll.costing",
  "payroll.tax",
  "payroll.self",
  "hr.manage",
  "hr.self",
  "hr.training",
  "hr.performance",
  "hr.payroll",
  "hr.recruit",
  "hr.view",
  "crm.manage",
  "crm.admin",
  "crm.leads",
  "crm.opportunities",
  "crm.marketing",
  "crm.service",
  "crm.portal",
  "crm.credit",
  "crm.export",
  "crm.view",
  "sales.manage",
  "sales.admin",
  "sales.pipeline",
  "sales.quotes",
  "sales.contracts",
  "sales.returns",
  "sales.pricing",
  "sales.commissions",
  "sales.forecast",
  "sales.credit",
  "sales.view",
  "procurement.manage",
  "procurement.approve",
  "procurement.suppliers",
  "procurement.view",
  "settings.manage",
  "settings.view",
  "inventory.manage",
  "invoices.manage",
  "users.manage",
  "billing.manage",
  "billing.approve",
  "billing.contracts",
  "billing.credit",
  "billing.recurring",
  "billing.collect",
  "billing.tax",
  "billing.projects",
  "billing.portal",
  "billing.mfg",
  "billing.design",
  "billing.view",
  "sd.manage",
  "sd.admin",
  "sd.agent",
  "sd.approve",
  "sd.change",
  "sd.field",
  "sd.knowledge",
  "sd.major",
  "sd.portal",
  "sd.view",
] as const;

describe("RLS permission enforcement migration part 3 (finance/payroll/hr/crm/sales/procurement/billing/sd)", () => {
  it("exists and is non-trivial", () => {
    expect(sqlPart3.length).toBeGreaterThan(10_000);
  });

  it("hardens every module table with write policies", () => {
    for (const table of HARDENED_TABLES_PART3) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sqlPart3,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sqlPart3,
          `${policy} must be RESTRICTIVE`
        ).toContain(
          `CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`
        );
      }
    }
  });

  it("defines exactly 492 write policies (164 tables x 3 actions)", () => {
    const created =
      sqlPart3.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES_PART3.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
    // Drop-first convention: every CREATE has a matching DROP IF EXISTS
    const dropped =
      sqlPart3.match(/DROP POLICY IF EXISTS \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(dropped.length).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    expect(sqlPart3.match(/AS RESTRICTIVE FOR SELECT/i)).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    const policyBodies = sqlPart3.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    expect(policyBodies.length).toBe(HARDENED_TABLES_PART3.length * WRITE_ACTIONS.length);
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("uses only permission slugs verified against the live catalog", () => {
    const slugRe = /'([a-z]+\.[a-z]+)'/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugRe.exec(sqlPart3)) !== null) {
      found.add(match[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    const verified = new Set<string>(VERIFIED_SLUGS_PART3);
    for (const slug of found) {
      expect(verified.has(slug), `unverified slug ${slug}`).toBe(true);
    }
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    for (const banned of ["sales.approve", "hr.admin", "hr.delete", "billing.admin"]) {
      expect(sqlPart3, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});

/**
 * Phase 5 - RLS business permission enforcement part 4 (static contract).
 *
 * Verifies supabase/migrations/20260801000005_rls_business_permission_enforcement_part4.sql
 * extends the hardening to the remaining ERP modules: asset tracking, digital
 * identity, underwriting, supplier relationship management, business
 * intelligence / reporting, the remaining finance & accounting tables,
 * print / labels / packaging, communications, and the shared org / inventory /
 * SCM / HR / dispatch / SD catalog / workflow support tables. Same guarantees as
 * Phases 2-4: RESTRICTIVE write policies (INSERT / UPDATE / DELETE) gated on
 * module permissions or super admin, SELECT stays open to company members, and
 * every permission slug is verified against the live permissions catalog.
 */
const MIGRATION_PART4 = resolve(
  process.cwd(),
  "supabase/migrations/20260801000005_rls_business_permission_enforcement_part4.sql"
);

const sqlPart4 = readFileSync(MIGRATION_PART4, "utf8");

/** Every table hardened in Phase 5 (269 tables x 3 write actions = 807 policies). */
const HARDENED_TABLES_PART4 = [
  // Asset Tracking
  "ast_assets",
  "ast_categories",
  "ast_assignments",
  "ast_locations",
  "ast_documents",
  "ast_identifiers",
  "ast_number_sequences",
  "ast_tag_templates",
  "ast_maintenance_links",
  "ast_audits",
  "ast_audit_lines",
  "ast_events",
  "ast_alerts",
  // Digital Identity
  "di_org_units",
  "di_lifecycle_events",
  "di_provision_templates",
  "di_provision_jobs",
  "di_provision_checklist",
  "di_job_sequences",
  "di_sync_rules",
  "di_clearance_assignments",
  "di_clearance_matrix",
  "di_id_card_templates",
  "di_id_cards",
  "di_biometric_profiles",
  "di_biometric_devices",
  "di_document_vault",
  "di_asset_assignments",
  "di_approval_routes",
  // Underwriting
  "uw_persons",
  "uw_person_links",
  "uw_module_entitlements",
  "uw_identity_events",
  "uw_upid_sequences",
  "uw_merge_log",
  // Supplier Relationship Management
  "srm_categories",
  "srm_contacts",
  "srm_onboarding",
  "srm_documents",
  "srm_timeline",
  "srm_quality_inspections",
  "srm_ncrs",
  "srm_scorecards",
  "srm_risks",
  "srm_communications",
  "srm_portal_requests",
  "srm_rfq_evaluations",
  "srm_match_logs",
  "srm_registry_items",
  "srm_registry_approvals",
  "srm_material_lots",
  "srm_trace_links",
  "srm_compliance_items",
  "srm_demand_forecasts",
  "srm_capacity_confirmations",
  "srm_delivery_slots",
  "srm_collab_documents",
  "srm_procurement_savings",
  // Business Intelligence / Reporting
  "bi_dashboards",
  "bi_dashboard_widgets",
  "bi_kpis",
  "bi_kpi_snapshots",
  "bi_report_definitions",
  "bi_report_runs",
  "bi_report_schedules",
  "bi_report_shares",
  "bi_report_approvals",
  "bi_analytics_models",
  "bi_data_marts",
  "bi_dwh_objects",
  "bi_chart_catalog",
  "bi_document_jobs",
  "bi_document_revisions",
  "bi_intelligent_documents",
  "bi_forecast_results",
  "bi_regulatory_packages",
  "bi_service_registry",
  // Finance / Accounting
  "fin_banks",
  "fin_bank_statements",
  "fin_account_groups",
  "fin_ap_credit_notes",
  "fin_ap_debit_notes",
  "fin_ar_debit_notes",
  "fin_approvals",
  "fin_asset_capitalizations",
  "fin_asset_disposals",
  "fin_asset_impairments",
  "fin_asset_revaluations",
  "fin_asset_transfers",
  "fin_budget_revisions",
  "fin_budget_templates",
  "fin_budget_variance",
  "fin_business_units",
  "fin_cash_counts",
  "fin_cash_forecasts",
  "fin_cip",
  "fin_close_adjustments",
  "fin_close_checklists",
  "fin_collections",
  "fin_corporate_tax",
  "fin_cost_rolls",
  "fin_cost_variances",
  "fin_costing_methods",
  "fin_currency_translation",
  "fin_customer_statements",
  "fin_deferred_revenue",
  "fin_dimension_values",
  "fin_dimensions",
  "fin_electronic_payments",
  "fin_elimination_entries",
  "fin_excise_duty",
  "fin_expense_claims",
  "fin_export_revenue",
  "fin_forecasts",
  "fin_government_contracts",
  "fin_group_consolidation",
  "fin_guarantees",
  "fin_import_duty",
  "fin_intercompany_txns",
  "fin_internal_controls",
  "fin_inventory_adjustments",
  "fin_inventory_valuation",
  "fin_investments",
  "fin_journal_templates",
  "fin_leases",
  "fin_letters_of_credit",
  "fin_liquidity",
  "fin_loans",
  "fin_mobile_money_txns",
  "fin_payment_plans",
  "fin_payment_runs",
  "fin_payroll_journals",
  "fin_period_locks",
  "fin_petty_cash",
  "fin_policies",
  "fin_posting_batches",
  "fin_posting_rules",
  "fin_production_profitability",
  "fin_profit_centers",
  "fin_project_billing",
  "fin_project_costs",
  "fin_project_profitability",
  "fin_reconciliations",
  "fin_recurring_invoices",
  "fin_recurring_journals",
  "fin_revenue_recognition",
  "fin_risk_register",
  "fin_settings",
  "fin_sod_rules",
  "fin_standard_costs",
  "fin_stock_revaluations",
  "fin_subscription_revenue",
  "fin_supplier_recon",
  "fin_supplier_statements",
  "fin_tax_calendar",
  "fin_tax_jurisdictions",
  "fin_trial_balance",
  "fin_wip",
  "fin_withholding_tax",
  "fiscal_years",
  // ERP
  "fiscal_periods",
  // Finance / Accounting
  "fixed_assets",
  // Inventory / SCM
  "goods_receipts",
  "goods_receipt_lines",
  "inventory_inspections",
  "inventory_valuations",
  // SCM / Supplier Management
  "scm_sustainability",
  "supplier_scorecards",
  "supply_chain_risks",
  // HR / Workforce
  "hr_cases",
  "labor_cost_entries",
  "employee_skills",
  "employee_objectives",
  "employee_assets",
  "employee_exits",
  "job_requisitions",
  "job_applicants",
  "skill_catalog",
  // Production / MRP
  "mrp_runs",
  "mrp_recommendations",
  "production_machines",
  "demand_forecasts",
  // Inventory / SCM
  "cycle_counts",
  "cycle_count_lines",
  "cartons",
  "reams",
  // Sales / CRM
  "retailers",
  "distributors",
  // Production / MRP
  "factories",
  // Org / Settings
  "branches",
  // Finance / Accounting
  "exchange_rates",
  // Settings
  "erp_modules",
  // Settings / Sequences
  "document_sequences",
  // Workflow
  "approval_authority",
  "approval_workflows",
  "wf_instances",
  // Security / Workflow
  "sec_dual_control_requests",
  // Dispatch / Field
  "dispatches",
  "field_jobs",
  // Sales / CRM
  "sales_call_logs",
  "sales_competitors",
  // Service Desk Catalog
  "sd_catalog_categories",
  "sd_catalog_items",
  "sd_catalog_requests",
  // Print
  "printers",
  "prt_designs",
  "prt_templates",
  "prt_servers",
  "prt_server_printers",
  "prt_batches",
  "prt_rules",
  "prt_automation_rules",
  "prt_schedules",
  "prt_security_profiles",
  "prt_department_access",
  "prt_quotas",
  "prt_id_card_jobs",
  "prt_product_label_jobs",
  "prt_media",
  "prt_document_profiles",
  "prt_consumables",
  "prt_barcode_presets",
  "prt_inventory_labels",
  "prt_secure_pdfs",
  // Labels
  "lbl_barcodes",
  "lbl_batches",
  "lbl_categories",
  "lbl_compliance",
  "lbl_documents",
  "lbl_fields",
  "lbl_formats",
  "lbl_gs1",
  "lbl_instances",
  "lbl_jobs",
  "lbl_materials",
  "lbl_pallet",
  "lbl_printer_profiles",
  "lbl_reprints",
  "lbl_rules",
  "lbl_security",
  "lbl_settings",
  "lbl_shelf",
  "lbl_shipping",
  "lbl_stock",
  "lbl_templates",
  "lbl_variables",
  // Packaging
  "pkg_carton_sizes",
  "pkg_lines",
  "pkg_material_issues",
  "pkg_materials",
  "pkg_packing_lists",
  "pkg_pallet_cartons",
  "pkg_pallets",
  "pkg_product_rules",
  "pkg_qc_checks",
  "pkg_rule_materials",
  "pkg_sessions",
  "pkg_weights",
  "pkg_work_orders",
  // Communications
  "comm_announcements",
  "comm_campaigns",
  "comm_document_jobs",
  "comm_event_rules",
  "comm_messages",
  "comm_providers",
  "comm_reminders",
  "comm_schedules",
  "comm_sequences",
  "comm_templates",
] as const;

/** Permission slugs verified against the live permissions catalog. */
const VERIFIED_SLUGS_PART4 = [
  "ast.assign",
  "ast.audit",
  "ast.manage",
  "ast.print",
  "billing.projects",
  "billing.recurring",
  "comm.admin",
  "comm.broadcast",
  "comm.manage",
  "comm.templates",
  "crm.manage",
  "di.admin",
  "di.biometrics",
  "di.cards",
  "di.clearance",
  "di.manage",
  "di.org",
  "di.provision",
  "dispatch.manage",
  "ec.risk",
  "finance.admin",
  "finance.approve",
  "finance.bank",
  "finance.close",
  "finance.consolidate",
  "finance.costing",
  "finance.fpa",
  "finance.manage",
  "finance.post",
  "finance.tax",
  "finance.treasury",
  "hr.manage",
  "hr.performance",
  "hr.recruit",
  "iam.manage",
  "inventory.adjust",
  "inventory.grn",
  "inventory.manage",
  "inventory.qc",
  "inventory.valuation",
  "lbl.admin",
  "lbl.approve",
  "lbl.design",
  "lbl.manage",
  "lbl.print",
  "lbl.security",
  "mes.manage",
  "mes.planning",
  "payroll.costing",
  "payroll.manage",
  "pkg.approve",
  "pkg.manage",
  "pkg.operate",
  "ppm.finance",
  "print.admin",
  "print.design",
  "print.manage",
  "print.operate",
  "print.security",
  "procurement.manage",
  "production.manage",
  "products.manage",
  "reports.assistant",
  "reports.dashboards",
  "reports.documents",
  "reports.dwh",
  "reports.export",
  "reports.intelligence",
  "reports.kpis",
  "reports.manage",
  "reports.regulatory",
  "reports.schedule",
  "sales.forecast",
  "sales.manage",
  "scm.manage",
  "scm.risk",
  "sd.manage",
  "sd.portal",
  "security.admin",
  "settings.manage",
  "settings.sequences",
  "settings.workflows",
  "srm.admin",
  "srm.approve",
  "srm.contracts",
  "srm.manage",
  "srm.portal",
  "srm.quality",
  "uw.admin",
  "uw.manage",
  "uw.merge",
  "wfm.field",
  "workflow.manage",
] as const;

describe("RLS permission enforcement migration part 4 (ast/di/uw/srm/bi/fin/print/lbl/pkg/comm/support)", () => {
  it("exists and is non-trivial", () => {
    expect(sqlPart4.length).toBeGreaterThan(10_000);
  });

  it("hardens every module table with write policies", () => {
    for (const table of HARDENED_TABLES_PART4) {
      for (const action of WRITE_ACTIONS) {
        const policy = `${table}_write_restrict_${action}`;
        expect(
          sqlPart4,
          `${policy} must be defined for ${table}`
        ).toContain(`CREATE POLICY ${policy} ON ${table}`);
        expect(
          sqlPart4,
          `${policy} must be RESTRICTIVE`
        ).toContain(
          `CREATE POLICY ${policy} ON ${table} AS RESTRICTIVE FOR ${action.toUpperCase()}`
        );
      }
    }
  });

  it("defines exactly 807 write policies (269 tables x 3 actions)", () => {
    const created =
      sqlPart4.match(/CREATE POLICY \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(created.length).toBe(HARDENED_TABLES_PART4.length * WRITE_ACTIONS.length);
    // No duplicate CREATE statements for the same policy name
    expect(new Set(created).size).toBe(created.length);
    // Drop-first convention: every CREATE has a matching DROP IF EXISTS
    const dropped =
      sqlPart4.match(/DROP POLICY IF EXISTS \w+_write_restrict_(insert|update|delete) ON \w+/g) ?? [];
    expect(dropped.length).toBe(created.length);
  });

  it("keeps SELECT open to company members (no restrictive SELECT gate)", () => {
    expect(sqlPart4.match(/AS RESTRICTIVE FOR SELECT/i)).toBeNull();
  });

  it("gates writes on module permissions or super admin", () => {
    const policyBodies = sqlPart4.match(/CREATE POLICY \w+_write_restrict_\w+[\s\S]*?;/g) ?? [];
    expect(policyBodies.length).toBe(HARDENED_TABLES_PART4.length * WRITE_ACTIONS.length);
    for (const body of policyBodies) {
      expect(
        body,
        `write policy must enforce permission: ${body.slice(0, 120)}`
      ).toMatch(/is_super_admin\(\)|has_any_permission\(/);
    }
  });

  it("uses only permission slugs verified against the live catalog", () => {
    const slugRe = /'([a-z]+\.[a-z]+)'/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = slugRe.exec(sqlPart4)) !== null) {
      found.add(match[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    const verified = new Set<string>(VERIFIED_SLUGS_PART4);
    for (const slug of found) {
      expect(verified.has(slug), `unverified slug ${slug}`).toBe(true);
    }
  });

  it("does not reference permission slugs absent from the live catalog", () => {
    for (const banned of ["sales.approve", "hr.admin", "hr.delete", "finance.tax.manage"]) {
      expect(sqlPart4, `banned slug ${banned}`).not.toContain(`'${banned}'`);
    }
  });
});
