-- ============================================================================
-- RLS Business Permission Enforcement - Part 3 (Phase 4)
--
-- Closes the data-layer RBAC gap for the remaining ERP modules: finance /
-- accounting master data, payroll master & support tables, HR, CRM, sales,
-- procurement, billing and service desk. As in Phases 2 and 3, any
-- authenticated company member could previously INSERT / UPDATE / DELETE these
-- records directly through the browser client because the permissive *_all
-- policies were gated only by company_id = user_company_id().
--
-- This migration adds RESTRICTIVE write policies (INSERT / UPDATE / DELETE) to
-- 164 core business tables. Restrictive policies AND with the existing
-- permissive policies and the migration-71 tenant_isolation_restrict policy, so
-- writes now require:
--   1. tenant + company scope (existing policies), AND
--   2. a matching module permission (new policies) OR super_administrator.
--
-- SELECT stays open to any company member (the 900+ page client UI reads
-- directly); only WRITE paths are hardened. Every permission slug below was
-- verified against the live permissions catalog, and each union is a superset of
-- the permission slugs the CRUD engine registry uses for the same table, so no
-- API flow that passes the registry check is denied at the database layer.
-- Every table in this phase carries its own company_id / tenant_id, so the
-- write gates bind directly to the caller's company via the migration-71
-- tenant_isolation_restrict policy (no parent-scoped indirection required).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Finance / Accounting: chart_of_accounts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS chart_of_accounts_write_restrict_insert ON chart_of_accounts;
CREATE POLICY chart_of_accounts_write_restrict_insert ON chart_of_accounts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin','finance.post']));
DROP POLICY IF EXISTS chart_of_accounts_write_restrict_update ON chart_of_accounts;
CREATE POLICY chart_of_accounts_write_restrict_update ON chart_of_accounts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin','finance.post']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin','finance.post']));
DROP POLICY IF EXISTS chart_of_accounts_write_restrict_delete ON chart_of_accounts;
CREATE POLICY chart_of_accounts_write_restrict_delete ON chart_of_accounts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin','finance.post']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: budgets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS budgets_write_restrict_insert ON budgets;
CREATE POLICY budgets_write_restrict_insert ON budgets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
DROP POLICY IF EXISTS budgets_write_restrict_update ON budgets;
CREATE POLICY budgets_write_restrict_update ON budgets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
DROP POLICY IF EXISTS budgets_write_restrict_delete ON budgets;
CREATE POLICY budgets_write_restrict_delete ON budgets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: budget_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS budget_lines_write_restrict_insert ON budget_lines;
CREATE POLICY budget_lines_write_restrict_insert ON budget_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
DROP POLICY IF EXISTS budget_lines_write_restrict_update ON budget_lines;
CREATE POLICY budget_lines_write_restrict_update ON budget_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
DROP POLICY IF EXISTS budget_lines_write_restrict_delete ON budget_lines;
CREATE POLICY budget_lines_write_restrict_delete ON budget_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.fpa','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: cost_centers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS cost_centers_write_restrict_insert ON cost_centers;
CREATE POLICY cost_centers_write_restrict_insert ON cost_centers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS cost_centers_write_restrict_update ON cost_centers;
CREATE POLICY cost_centers_write_restrict_update ON cost_centers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
DROP POLICY IF EXISTS cost_centers_write_restrict_delete ON cost_centers;
CREATE POLICY cost_centers_write_restrict_delete ON cost_centers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: bank_accounts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bank_accounts_write_restrict_insert ON bank_accounts;
CREATE POLICY bank_accounts_write_restrict_insert ON bank_accounts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_accounts_write_restrict_update ON bank_accounts;
CREATE POLICY bank_accounts_write_restrict_update ON bank_accounts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_accounts_write_restrict_delete ON bank_accounts;
CREATE POLICY bank_accounts_write_restrict_delete ON bank_accounts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: bank_transactions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bank_transactions_write_restrict_insert ON bank_transactions;
CREATE POLICY bank_transactions_write_restrict_insert ON bank_transactions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_transactions_write_restrict_update ON bank_transactions;
CREATE POLICY bank_transactions_write_restrict_update ON bank_transactions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_transactions_write_restrict_delete ON bank_transactions;
CREATE POLICY bank_transactions_write_restrict_delete ON bank_transactions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: bank_reconciliations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bank_reconciliations_write_restrict_insert ON bank_reconciliations;
CREATE POLICY bank_reconciliations_write_restrict_insert ON bank_reconciliations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_reconciliations_write_restrict_update ON bank_reconciliations;
CREATE POLICY bank_reconciliations_write_restrict_update ON bank_reconciliations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
DROP POLICY IF EXISTS bank_reconciliations_write_restrict_delete ON bank_reconciliations;
CREATE POLICY bank_reconciliations_write_restrict_delete ON bank_reconciliations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.bank','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: tax_codes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS tax_codes_write_restrict_insert ON tax_codes;
CREATE POLICY tax_codes_write_restrict_insert ON tax_codes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
DROP POLICY IF EXISTS tax_codes_write_restrict_update ON tax_codes;
CREATE POLICY tax_codes_write_restrict_update ON tax_codes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
DROP POLICY IF EXISTS tax_codes_write_restrict_delete ON tax_codes;
CREATE POLICY tax_codes_write_restrict_delete ON tax_codes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: treasury_facilities  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS treasury_facilities_write_restrict_insert ON treasury_facilities;
CREATE POLICY treasury_facilities_write_restrict_insert ON treasury_facilities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.admin','finance.cfo']));
DROP POLICY IF EXISTS treasury_facilities_write_restrict_update ON treasury_facilities;
CREATE POLICY treasury_facilities_write_restrict_update ON treasury_facilities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.admin','finance.cfo']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.admin','finance.cfo']));
DROP POLICY IF EXISTS treasury_facilities_write_restrict_delete ON treasury_facilities;
CREATE POLICY treasury_facilities_write_restrict_delete ON treasury_facilities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.admin','finance.cfo']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: depreciation_entries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS depreciation_entries_write_restrict_insert ON depreciation_entries;
CREATE POLICY depreciation_entries_write_restrict_insert ON depreciation_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.costing','finance.post','finance.admin']));
DROP POLICY IF EXISTS depreciation_entries_write_restrict_update ON depreciation_entries;
CREATE POLICY depreciation_entries_write_restrict_update ON depreciation_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.costing','finance.post','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.costing','finance.post','finance.admin']));
DROP POLICY IF EXISTS depreciation_entries_write_restrict_delete ON depreciation_entries;
CREATE POLICY depreciation_entries_write_restrict_delete ON depreciation_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.costing','finance.post','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: credit_reviews  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS credit_reviews_write_restrict_insert ON credit_reviews;
CREATE POLICY credit_reviews_write_restrict_insert ON credit_reviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo','finance.approve','crm.credit']));
DROP POLICY IF EXISTS credit_reviews_write_restrict_update ON credit_reviews;
CREATE POLICY credit_reviews_write_restrict_update ON credit_reviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo','finance.approve','crm.credit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo','finance.approve','crm.credit']));
DROP POLICY IF EXISTS credit_reviews_write_restrict_delete ON credit_reviews;
CREATE POLICY credit_reviews_write_restrict_delete ON credit_reviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.cfo','finance.approve','crm.credit']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_cash_positions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_cash_positions_write_restrict_insert ON fin_cash_positions;
CREATE POLICY fin_cash_positions_write_restrict_insert ON fin_cash_positions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.cfo','finance.admin']));
DROP POLICY IF EXISTS fin_cash_positions_write_restrict_update ON fin_cash_positions;
CREATE POLICY fin_cash_positions_write_restrict_update ON fin_cash_positions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.cfo','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.cfo','finance.admin']));
DROP POLICY IF EXISTS fin_cash_positions_write_restrict_delete ON fin_cash_positions;
CREATE POLICY fin_cash_positions_write_restrict_delete ON fin_cash_positions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.treasury','finance.cfo','finance.admin']));
-- ----------------------------------------------------------------------------
-- Finance / Accounting: fin_tax_returns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_tax_returns_write_restrict_insert ON fin_tax_returns;
CREATE POLICY fin_tax_returns_write_restrict_insert ON fin_tax_returns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
DROP POLICY IF EXISTS fin_tax_returns_write_restrict_update ON fin_tax_returns;
CREATE POLICY fin_tax_returns_write_restrict_update ON fin_tax_returns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
DROP POLICY IF EXISTS fin_tax_returns_write_restrict_delete ON fin_tax_returns;
CREATE POLICY fin_tax_returns_write_restrict_delete ON fin_tax_returns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.tax','finance.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_advances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_advances_write_restrict_insert ON pay_advances;
CREATE POLICY pay_advances_write_restrict_insert ON pay_advances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self','payroll.approve']));
DROP POLICY IF EXISTS pay_advances_write_restrict_update ON pay_advances;
CREATE POLICY pay_advances_write_restrict_update ON pay_advances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self','payroll.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self','payroll.approve']));
DROP POLICY IF EXISTS pay_advances_write_restrict_delete ON pay_advances;
CREATE POLICY pay_advances_write_restrict_delete ON pay_advances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self','payroll.approve']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_loans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_loans_write_restrict_insert ON pay_loans;
CREATE POLICY pay_loans_write_restrict_insert ON pay_loans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_loans_write_restrict_update ON pay_loans;
CREATE POLICY pay_loans_write_restrict_update ON pay_loans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_loans_write_restrict_delete ON pay_loans;
CREATE POLICY pay_loans_write_restrict_delete ON pay_loans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_loan_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_loan_schedules_write_restrict_insert ON pay_loan_schedules;
CREATE POLICY pay_loan_schedules_write_restrict_insert ON pay_loan_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_loan_schedules_write_restrict_update ON pay_loan_schedules;
CREATE POLICY pay_loan_schedules_write_restrict_update ON pay_loan_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_loan_schedules_write_restrict_delete ON pay_loan_schedules;
CREATE POLICY pay_loan_schedules_write_restrict_delete ON pay_loan_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_components  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_components_write_restrict_insert ON pay_components;
CREATE POLICY pay_components_write_restrict_insert ON pay_components AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_components_write_restrict_update ON pay_components;
CREATE POLICY pay_components_write_restrict_update ON pay_components AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_components_write_restrict_delete ON pay_components;
CREATE POLICY pay_components_write_restrict_delete ON pay_components AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_employee_components  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_employee_components_write_restrict_insert ON pay_employee_components;
CREATE POLICY pay_employee_components_write_restrict_insert ON pay_employee_components AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_employee_components_write_restrict_update ON pay_employee_components;
CREATE POLICY pay_employee_components_write_restrict_update ON pay_employee_components AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_employee_components_write_restrict_delete ON pay_employee_components;
CREATE POLICY pay_employee_components_write_restrict_delete ON pay_employee_components AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_rules_write_restrict_insert ON pay_rules;
CREATE POLICY pay_rules_write_restrict_insert ON pay_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_rules_write_restrict_update ON pay_rules;
CREATE POLICY pay_rules_write_restrict_update ON pay_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_rules_write_restrict_delete ON pay_rules;
CREATE POLICY pay_rules_write_restrict_delete ON pay_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_salary_structures  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_salary_structures_write_restrict_insert ON pay_salary_structures;
CREATE POLICY pay_salary_structures_write_restrict_insert ON pay_salary_structures AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_salary_structures_write_restrict_update ON pay_salary_structures;
CREATE POLICY pay_salary_structures_write_restrict_update ON pay_salary_structures AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_salary_structures_write_restrict_delete ON pay_salary_structures;
CREATE POLICY pay_salary_structures_write_restrict_delete ON pay_salary_structures AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_salary_grades  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_salary_grades_write_restrict_insert ON pay_salary_grades;
CREATE POLICY pay_salary_grades_write_restrict_insert ON pay_salary_grades AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_grades_write_restrict_update ON pay_salary_grades;
CREATE POLICY pay_salary_grades_write_restrict_update ON pay_salary_grades AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_grades_write_restrict_delete ON pay_salary_grades;
CREATE POLICY pay_salary_grades_write_restrict_delete ON pay_salary_grades AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_salary_scales  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_salary_scales_write_restrict_insert ON pay_salary_scales;
CREATE POLICY pay_salary_scales_write_restrict_insert ON pay_salary_scales AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_scales_write_restrict_update ON pay_salary_scales;
CREATE POLICY pay_salary_scales_write_restrict_update ON pay_salary_scales AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_scales_write_restrict_delete ON pay_salary_scales;
CREATE POLICY pay_salary_scales_write_restrict_delete ON pay_salary_scales AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_salary_bands  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_salary_bands_write_restrict_insert ON pay_salary_bands;
CREATE POLICY pay_salary_bands_write_restrict_insert ON pay_salary_bands AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_bands_write_restrict_update ON pay_salary_bands;
CREATE POLICY pay_salary_bands_write_restrict_update ON pay_salary_bands AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_salary_bands_write_restrict_delete ON pay_salary_bands;
CREATE POLICY pay_salary_bands_write_restrict_delete ON pay_salary_bands AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_structure_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_structure_lines_write_restrict_insert ON pay_structure_lines;
CREATE POLICY pay_structure_lines_write_restrict_insert ON pay_structure_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_structure_lines_write_restrict_update ON pay_structure_lines;
CREATE POLICY pay_structure_lines_write_restrict_update ON pay_structure_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_structure_lines_write_restrict_delete ON pay_structure_lines;
CREATE POLICY pay_structure_lines_write_restrict_delete ON pay_structure_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_tax_brackets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_tax_brackets_write_restrict_insert ON pay_tax_brackets;
CREATE POLICY pay_tax_brackets_write_restrict_insert ON pay_tax_brackets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
DROP POLICY IF EXISTS pay_tax_brackets_write_restrict_update ON pay_tax_brackets;
CREATE POLICY pay_tax_brackets_write_restrict_update ON pay_tax_brackets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
DROP POLICY IF EXISTS pay_tax_brackets_write_restrict_delete ON pay_tax_brackets;
CREATE POLICY pay_tax_brackets_write_restrict_delete ON pay_tax_brackets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_statutory_rates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_statutory_rates_write_restrict_insert ON pay_statutory_rates;
CREATE POLICY pay_statutory_rates_write_restrict_insert ON pay_statutory_rates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
DROP POLICY IF EXISTS pay_statutory_rates_write_restrict_update ON pay_statutory_rates;
CREATE POLICY pay_statutory_rates_write_restrict_update ON pay_statutory_rates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
DROP POLICY IF EXISTS pay_statutory_rates_write_restrict_delete ON pay_statutory_rates;
CREATE POLICY pay_statutory_rates_write_restrict_delete ON pay_statutory_rates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.tax']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_periods  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_periods_write_restrict_insert ON pay_periods;
CREATE POLICY pay_periods_write_restrict_insert ON pay_periods AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_periods_write_restrict_update ON pay_periods;
CREATE POLICY pay_periods_write_restrict_update ON pay_periods AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_periods_write_restrict_delete ON pay_periods;
CREATE POLICY pay_periods_write_restrict_delete ON pay_periods AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_settings_write_restrict_insert ON pay_settings;
CREATE POLICY pay_settings_write_restrict_insert ON pay_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_settings_write_restrict_update ON pay_settings;
CREATE POLICY pay_settings_write_restrict_update ON pay_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_settings_write_restrict_delete ON pay_settings;
CREATE POLICY pay_settings_write_restrict_delete ON pay_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_gl_mappings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_gl_mappings_write_restrict_insert ON pay_gl_mappings;
CREATE POLICY pay_gl_mappings_write_restrict_insert ON pay_gl_mappings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','finance.manage','finance.post']));
DROP POLICY IF EXISTS pay_gl_mappings_write_restrict_update ON pay_gl_mappings;
CREATE POLICY pay_gl_mappings_write_restrict_update ON pay_gl_mappings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','finance.manage','finance.post']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','finance.manage','finance.post']));
DROP POLICY IF EXISTS pay_gl_mappings_write_restrict_delete ON pay_gl_mappings;
CREATE POLICY pay_gl_mappings_write_restrict_delete ON pay_gl_mappings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','finance.manage','finance.post']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_approvals_write_restrict_insert ON pay_approvals;
CREATE POLICY pay_approvals_write_restrict_insert ON pay_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
DROP POLICY IF EXISTS pay_approvals_write_restrict_update ON pay_approvals;
CREATE POLICY pay_approvals_write_restrict_update ON pay_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
DROP POLICY IF EXISTS pay_approvals_write_restrict_delete ON pay_approvals;
CREATE POLICY pay_approvals_write_restrict_delete ON pay_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_corrections  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_corrections_write_restrict_insert ON pay_corrections;
CREATE POLICY pay_corrections_write_restrict_insert ON pay_corrections AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_corrections_write_restrict_update ON pay_corrections;
CREATE POLICY pay_corrections_write_restrict_update ON pay_corrections AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_corrections_write_restrict_delete ON pay_corrections;
CREATE POLICY pay_corrections_write_restrict_delete ON pay_corrections AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_benefit_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_benefit_plans_write_restrict_insert ON pay_benefit_plans;
CREATE POLICY pay_benefit_plans_write_restrict_insert ON pay_benefit_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_benefit_plans_write_restrict_update ON pay_benefit_plans;
CREATE POLICY pay_benefit_plans_write_restrict_update ON pay_benefit_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_benefit_plans_write_restrict_delete ON pay_benefit_plans;
CREATE POLICY pay_benefit_plans_write_restrict_delete ON pay_benefit_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_employee_benefits  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_employee_benefits_write_restrict_insert ON pay_employee_benefits;
CREATE POLICY pay_employee_benefits_write_restrict_insert ON pay_employee_benefits AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_employee_benefits_write_restrict_update ON pay_employee_benefits;
CREATE POLICY pay_employee_benefits_write_restrict_update ON pay_employee_benefits AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_employee_benefits_write_restrict_delete ON pay_employee_benefits;
CREATE POLICY pay_employee_benefits_write_restrict_delete ON pay_employee_benefits AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_final_settlements  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_final_settlements_write_restrict_insert ON pay_final_settlements;
CREATE POLICY pay_final_settlements_write_restrict_insert ON pay_final_settlements AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
DROP POLICY IF EXISTS pay_final_settlements_write_restrict_update ON pay_final_settlements;
CREATE POLICY pay_final_settlements_write_restrict_update ON pay_final_settlements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
DROP POLICY IF EXISTS pay_final_settlements_write_restrict_delete ON pay_final_settlements;
CREATE POLICY pay_final_settlements_write_restrict_delete ON pay_final_settlements AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.approve']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_formulas  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_formulas_write_restrict_insert ON pay_formulas;
CREATE POLICY pay_formulas_write_restrict_insert ON pay_formulas AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_formulas_write_restrict_update ON pay_formulas;
CREATE POLICY pay_formulas_write_restrict_update ON pay_formulas AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_formulas_write_restrict_delete ON pay_formulas;
CREATE POLICY pay_formulas_write_restrict_delete ON pay_formulas AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_gratuity_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_gratuity_rules_write_restrict_insert ON pay_gratuity_rules;
CREATE POLICY pay_gratuity_rules_write_restrict_insert ON pay_gratuity_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_gratuity_rules_write_restrict_update ON pay_gratuity_rules;
CREATE POLICY pay_gratuity_rules_write_restrict_update ON pay_gratuity_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_gratuity_rules_write_restrict_delete ON pay_gratuity_rules;
CREATE POLICY pay_gratuity_rules_write_restrict_delete ON pay_gratuity_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_groups  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_groups_write_restrict_insert ON pay_groups;
CREATE POLICY pay_groups_write_restrict_insert ON pay_groups AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_groups_write_restrict_update ON pay_groups;
CREATE POLICY pay_groups_write_restrict_update ON pay_groups AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_groups_write_restrict_delete ON pay_groups;
CREATE POLICY pay_groups_write_restrict_delete ON pay_groups AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_incentives  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_incentives_write_restrict_insert ON pay_incentives;
CREATE POLICY pay_incentives_write_restrict_insert ON pay_incentives AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_incentives_write_restrict_update ON pay_incentives;
CREATE POLICY pay_incentives_write_restrict_update ON pay_incentives AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_incentives_write_restrict_delete ON pay_incentives;
CREATE POLICY pay_incentives_write_restrict_delete ON pay_incentives AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_mobile_money  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_mobile_money_write_restrict_insert ON pay_mobile_money;
CREATE POLICY pay_mobile_money_write_restrict_insert ON pay_mobile_money AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.pay','payroll.bank']));
DROP POLICY IF EXISTS pay_mobile_money_write_restrict_update ON pay_mobile_money;
CREATE POLICY pay_mobile_money_write_restrict_update ON pay_mobile_money AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.pay','payroll.bank']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.pay','payroll.bank']));
DROP POLICY IF EXISTS pay_mobile_money_write_restrict_delete ON pay_mobile_money;
CREATE POLICY pay_mobile_money_write_restrict_delete ON pay_mobile_money AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.pay','payroll.bank']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_overtime_claims  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_overtime_claims_write_restrict_insert ON pay_overtime_claims;
CREATE POLICY pay_overtime_claims_write_restrict_insert ON pay_overtime_claims AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
DROP POLICY IF EXISTS pay_overtime_claims_write_restrict_update ON pay_overtime_claims;
CREATE POLICY pay_overtime_claims_write_restrict_update ON pay_overtime_claims AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
DROP POLICY IF EXISTS pay_overtime_claims_write_restrict_delete ON pay_overtime_claims;
CREATE POLICY pay_overtime_claims_write_restrict_delete ON pay_overtime_claims AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.self']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_pension_schemes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_pension_schemes_write_restrict_insert ON pay_pension_schemes;
CREATE POLICY pay_pension_schemes_write_restrict_insert ON pay_pension_schemes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_pension_schemes_write_restrict_update ON pay_pension_schemes;
CREATE POLICY pay_pension_schemes_write_restrict_update ON pay_pension_schemes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_pension_schemes_write_restrict_delete ON pay_pension_schemes;
CREATE POLICY pay_pension_schemes_write_restrict_delete ON pay_pension_schemes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_shift_premiums  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_shift_premiums_write_restrict_insert ON pay_shift_premiums;
CREATE POLICY pay_shift_premiums_write_restrict_insert ON pay_shift_premiums AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_shift_premiums_write_restrict_update ON pay_shift_premiums;
CREATE POLICY pay_shift_premiums_write_restrict_update ON pay_shift_premiums AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_shift_premiums_write_restrict_delete ON pay_shift_premiums;
CREATE POLICY pay_shift_premiums_write_restrict_delete ON pay_shift_premiums AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_simulations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_simulations_write_restrict_insert ON pay_simulations;
CREATE POLICY pay_simulations_write_restrict_insert ON pay_simulations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.process']));
DROP POLICY IF EXISTS pay_simulations_write_restrict_update ON pay_simulations;
CREATE POLICY pay_simulations_write_restrict_update ON pay_simulations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.process']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.process']));
DROP POLICY IF EXISTS pay_simulations_write_restrict_delete ON pay_simulations;
CREATE POLICY pay_simulations_write_restrict_delete ON pay_simulations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.process']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_bonuses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_bonuses_write_restrict_insert ON pay_bonuses;
CREATE POLICY pay_bonuses_write_restrict_insert ON pay_bonuses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_bonuses_write_restrict_update ON pay_bonuses;
CREATE POLICY pay_bonuses_write_restrict_update ON pay_bonuses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_bonuses_write_restrict_delete ON pay_bonuses;
CREATE POLICY pay_bonuses_write_restrict_delete ON pay_bonuses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_commissions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_commissions_write_restrict_insert ON pay_commissions;
CREATE POLICY pay_commissions_write_restrict_insert ON pay_commissions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_commissions_write_restrict_update ON pay_commissions;
CREATE POLICY pay_commissions_write_restrict_update ON pay_commissions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_commissions_write_restrict_delete ON pay_commissions;
CREATE POLICY pay_commissions_write_restrict_delete ON pay_commissions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_cost_allocations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_cost_allocations_write_restrict_insert ON pay_cost_allocations;
CREATE POLICY pay_cost_allocations_write_restrict_insert ON pay_cost_allocations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_cost_allocations_write_restrict_update ON pay_cost_allocations;
CREATE POLICY pay_cost_allocations_write_restrict_update ON pay_cost_allocations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
DROP POLICY IF EXISTS pay_cost_allocations_write_restrict_delete ON pay_cost_allocations;
CREATE POLICY pay_cost_allocations_write_restrict_delete ON pay_cost_allocations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin','payroll.costing']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_calendars  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_calendars_write_restrict_insert ON pay_calendars;
CREATE POLICY pay_calendars_write_restrict_insert ON pay_calendars AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_calendars_write_restrict_update ON pay_calendars;
CREATE POLICY pay_calendars_write_restrict_update ON pay_calendars AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_calendars_write_restrict_delete ON pay_calendars;
CREATE POLICY pay_calendars_write_restrict_delete ON pay_calendars AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- Payroll master data & support: pay_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_documents_write_restrict_insert ON pay_documents;
CREATE POLICY pay_documents_write_restrict_insert ON pay_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_documents_write_restrict_update ON pay_documents;
CREATE POLICY pay_documents_write_restrict_update ON pay_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
DROP POLICY IF EXISTS pay_documents_write_restrict_delete ON pay_documents;
CREATE POLICY pay_documents_write_restrict_delete ON pay_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.admin']));
-- ----------------------------------------------------------------------------
-- HR: leave_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS leave_requests_write_restrict_insert ON leave_requests;
CREATE POLICY leave_requests_write_restrict_insert ON leave_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
DROP POLICY IF EXISTS leave_requests_write_restrict_update ON leave_requests;
CREATE POLICY leave_requests_write_restrict_update ON leave_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
DROP POLICY IF EXISTS leave_requests_write_restrict_delete ON leave_requests;
CREATE POLICY leave_requests_write_restrict_delete ON leave_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
-- ----------------------------------------------------------------------------
-- HR: leave_balances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS leave_balances_write_restrict_insert ON leave_balances;
CREATE POLICY leave_balances_write_restrict_insert ON leave_balances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS leave_balances_write_restrict_update ON leave_balances;
CREATE POLICY leave_balances_write_restrict_update ON leave_balances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS leave_balances_write_restrict_delete ON leave_balances;
CREATE POLICY leave_balances_write_restrict_delete ON leave_balances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR: overtime_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS overtime_requests_write_restrict_insert ON overtime_requests;
CREATE POLICY overtime_requests_write_restrict_insert ON overtime_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
DROP POLICY IF EXISTS overtime_requests_write_restrict_update ON overtime_requests;
CREATE POLICY overtime_requests_write_restrict_update ON overtime_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
DROP POLICY IF EXISTS overtime_requests_write_restrict_delete ON overtime_requests;
CREATE POLICY overtime_requests_write_restrict_delete ON overtime_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.self']));
-- ----------------------------------------------------------------------------
-- HR: departments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS departments_write_restrict_insert ON departments;
CREATE POLICY departments_write_restrict_insert ON departments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
DROP POLICY IF EXISTS departments_write_restrict_update ON departments;
CREATE POLICY departments_write_restrict_update ON departments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
DROP POLICY IF EXISTS departments_write_restrict_delete ON departments;
CREATE POLICY departments_write_restrict_delete ON departments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
-- ----------------------------------------------------------------------------
-- HR: training_courses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS training_courses_write_restrict_insert ON training_courses;
CREATE POLICY training_courses_write_restrict_insert ON training_courses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_courses_write_restrict_update ON training_courses;
CREATE POLICY training_courses_write_restrict_update ON training_courses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_courses_write_restrict_delete ON training_courses;
CREATE POLICY training_courses_write_restrict_delete ON training_courses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
-- ----------------------------------------------------------------------------
-- HR: training_enrollments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS training_enrollments_write_restrict_insert ON training_enrollments;
CREATE POLICY training_enrollments_write_restrict_insert ON training_enrollments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_enrollments_write_restrict_update ON training_enrollments;
CREATE POLICY training_enrollments_write_restrict_update ON training_enrollments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_enrollments_write_restrict_delete ON training_enrollments;
CREATE POLICY training_enrollments_write_restrict_delete ON training_enrollments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
-- ----------------------------------------------------------------------------
-- HR: training_records  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS training_records_write_restrict_insert ON training_records;
CREATE POLICY training_records_write_restrict_insert ON training_records AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_records_write_restrict_update ON training_records;
CREATE POLICY training_records_write_restrict_update ON training_records AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
DROP POLICY IF EXISTS training_records_write_restrict_delete ON training_records;
CREATE POLICY training_records_write_restrict_delete ON training_records AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.training']));
-- ----------------------------------------------------------------------------
-- HR: performance_reviews  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS performance_reviews_write_restrict_insert ON performance_reviews;
CREATE POLICY performance_reviews_write_restrict_insert ON performance_reviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
DROP POLICY IF EXISTS performance_reviews_write_restrict_update ON performance_reviews;
CREATE POLICY performance_reviews_write_restrict_update ON performance_reviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
DROP POLICY IF EXISTS performance_reviews_write_restrict_delete ON performance_reviews;
CREATE POLICY performance_reviews_write_restrict_delete ON performance_reviews AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','hr.performance']));
-- ----------------------------------------------------------------------------
-- HR: safety_incidents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS safety_incidents_write_restrict_insert ON safety_incidents;
CREATE POLICY safety_incidents_write_restrict_insert ON safety_incidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS safety_incidents_write_restrict_update ON safety_incidents;
CREATE POLICY safety_incidents_write_restrict_update ON safety_incidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS safety_incidents_write_restrict_delete ON safety_incidents;
CREATE POLICY safety_incidents_write_restrict_delete ON safety_incidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR: safety_inductions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS safety_inductions_write_restrict_insert ON safety_inductions;
CREATE POLICY safety_inductions_write_restrict_insert ON safety_inductions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS safety_inductions_write_restrict_update ON safety_inductions;
CREATE POLICY safety_inductions_write_restrict_update ON safety_inductions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS safety_inductions_write_restrict_delete ON safety_inductions;
CREATE POLICY safety_inductions_write_restrict_delete ON safety_inductions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- HR: public_holidays  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS public_holidays_write_restrict_insert ON public_holidays;
CREATE POLICY public_holidays_write_restrict_insert ON public_holidays AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
DROP POLICY IF EXISTS public_holidays_write_restrict_update ON public_holidays;
CREATE POLICY public_holidays_write_restrict_update ON public_holidays AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
DROP POLICY IF EXISTS public_holidays_write_restrict_delete ON public_holidays;
CREATE POLICY public_holidays_write_restrict_delete ON public_holidays AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['settings.manage','hr.manage']));
-- ----------------------------------------------------------------------------
-- HR: ppe_issuances  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ppe_issuances_write_restrict_insert ON ppe_issuances;
CREATE POLICY ppe_issuances_write_restrict_insert ON ppe_issuances AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS ppe_issuances_write_restrict_update ON ppe_issuances;
CREATE POLICY ppe_issuances_write_restrict_update ON ppe_issuances AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
DROP POLICY IF EXISTS ppe_issuances_write_restrict_delete ON ppe_issuances;
CREATE POLICY ppe_issuances_write_restrict_delete ON ppe_issuances AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage']));
-- ----------------------------------------------------------------------------
-- CRM: crm_contacts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_contacts_write_restrict_insert ON crm_contacts;
CREATE POLICY crm_contacts_write_restrict_insert ON crm_contacts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_contacts_write_restrict_update ON crm_contacts;
CREATE POLICY crm_contacts_write_restrict_update ON crm_contacts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_contacts_write_restrict_delete ON crm_contacts;
CREATE POLICY crm_contacts_write_restrict_delete ON crm_contacts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_activities  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_activities_write_restrict_insert ON crm_activities;
CREATE POLICY crm_activities_write_restrict_insert ON crm_activities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_activities_write_restrict_update ON crm_activities;
CREATE POLICY crm_activities_write_restrict_update ON crm_activities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_activities_write_restrict_delete ON crm_activities;
CREATE POLICY crm_activities_write_restrict_delete ON crm_activities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_campaigns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_campaigns_write_restrict_insert ON crm_campaigns;
CREATE POLICY crm_campaigns_write_restrict_insert ON crm_campaigns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_campaigns_write_restrict_update ON crm_campaigns;
CREATE POLICY crm_campaigns_write_restrict_update ON crm_campaigns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_campaigns_write_restrict_delete ON crm_campaigns;
CREATE POLICY crm_campaigns_write_restrict_delete ON crm_campaigns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_contracts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_contracts_write_restrict_insert ON crm_contracts;
CREATE POLICY crm_contracts_write_restrict_insert ON crm_contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_contracts_write_restrict_update ON crm_contracts;
CREATE POLICY crm_contracts_write_restrict_update ON crm_contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_contracts_write_restrict_delete ON crm_contracts;
CREATE POLICY crm_contracts_write_restrict_delete ON crm_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_dealers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_dealers_write_restrict_insert ON crm_dealers;
CREATE POLICY crm_dealers_write_restrict_insert ON crm_dealers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_dealers_write_restrict_update ON crm_dealers;
CREATE POLICY crm_dealers_write_restrict_update ON crm_dealers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_dealers_write_restrict_delete ON crm_dealers;
CREATE POLICY crm_dealers_write_restrict_delete ON crm_dealers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_segments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_segments_write_restrict_insert ON crm_segments;
CREATE POLICY crm_segments_write_restrict_insert ON crm_segments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_segments_write_restrict_update ON crm_segments;
CREATE POLICY crm_segments_write_restrict_update ON crm_segments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_segments_write_restrict_delete ON crm_segments;
CREATE POLICY crm_segments_write_restrict_delete ON crm_segments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_consents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_consents_write_restrict_insert ON crm_consents;
CREATE POLICY crm_consents_write_restrict_insert ON crm_consents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_consents_write_restrict_update ON crm_consents;
CREATE POLICY crm_consents_write_restrict_update ON crm_consents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_consents_write_restrict_delete ON crm_consents;
CREATE POLICY crm_consents_write_restrict_delete ON crm_consents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_documents_write_restrict_insert ON crm_documents;
CREATE POLICY crm_documents_write_restrict_insert ON crm_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_documents_write_restrict_update ON crm_documents;
CREATE POLICY crm_documents_write_restrict_update ON crm_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_documents_write_restrict_delete ON crm_documents;
CREATE POLICY crm_documents_write_restrict_delete ON crm_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_notes_write_restrict_insert ON crm_notes;
CREATE POLICY crm_notes_write_restrict_insert ON crm_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_notes_write_restrict_update ON crm_notes;
CREATE POLICY crm_notes_write_restrict_update ON crm_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_notes_write_restrict_delete ON crm_notes;
CREATE POLICY crm_notes_write_restrict_delete ON crm_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_portal_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_portal_requests_write_restrict_insert ON crm_portal_requests;
CREATE POLICY crm_portal_requests_write_restrict_insert ON crm_portal_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.portal','crm.admin']));
DROP POLICY IF EXISTS crm_portal_requests_write_restrict_update ON crm_portal_requests;
CREATE POLICY crm_portal_requests_write_restrict_update ON crm_portal_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.portal','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.portal','crm.admin']));
DROP POLICY IF EXISTS crm_portal_requests_write_restrict_delete ON crm_portal_requests;
CREATE POLICY crm_portal_requests_write_restrict_delete ON crm_portal_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.portal','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_sales_targets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_sales_targets_write_restrict_insert ON crm_sales_targets;
CREATE POLICY crm_sales_targets_write_restrict_insert ON crm_sales_targets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_sales_targets_write_restrict_update ON crm_sales_targets;
CREATE POLICY crm_sales_targets_write_restrict_update ON crm_sales_targets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_sales_targets_write_restrict_delete ON crm_sales_targets;
CREATE POLICY crm_sales_targets_write_restrict_delete ON crm_sales_targets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_tenders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_tenders_write_restrict_insert ON crm_tenders;
CREATE POLICY crm_tenders_write_restrict_insert ON crm_tenders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_tenders_write_restrict_update ON crm_tenders;
CREATE POLICY crm_tenders_write_restrict_update ON crm_tenders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_tenders_write_restrict_delete ON crm_tenders;
CREATE POLICY crm_tenders_write_restrict_delete ON crm_tenders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_health_scores  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_health_scores_write_restrict_insert ON crm_health_scores;
CREATE POLICY crm_health_scores_write_restrict_insert ON crm_health_scores AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_health_scores_write_restrict_update ON crm_health_scores;
CREATE POLICY crm_health_scores_write_restrict_update ON crm_health_scores AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_health_scores_write_restrict_delete ON crm_health_scores;
CREATE POLICY crm_health_scores_write_restrict_delete ON crm_health_scores AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_loyalty_ledger  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_loyalty_ledger_write_restrict_insert ON crm_loyalty_ledger;
CREATE POLICY crm_loyalty_ledger_write_restrict_insert ON crm_loyalty_ledger AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_ledger_write_restrict_update ON crm_loyalty_ledger;
CREATE POLICY crm_loyalty_ledger_write_restrict_update ON crm_loyalty_ledger AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_ledger_write_restrict_delete ON crm_loyalty_ledger;
CREATE POLICY crm_loyalty_ledger_write_restrict_delete ON crm_loyalty_ledger AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_loyalty_programs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_loyalty_programs_write_restrict_insert ON crm_loyalty_programs;
CREATE POLICY crm_loyalty_programs_write_restrict_insert ON crm_loyalty_programs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_programs_write_restrict_update ON crm_loyalty_programs;
CREATE POLICY crm_loyalty_programs_write_restrict_update ON crm_loyalty_programs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_programs_write_restrict_delete ON crm_loyalty_programs;
CREATE POLICY crm_loyalty_programs_write_restrict_delete ON crm_loyalty_programs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_loyalty_rewards  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_loyalty_rewards_write_restrict_insert ON crm_loyalty_rewards;
CREATE POLICY crm_loyalty_rewards_write_restrict_insert ON crm_loyalty_rewards AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_rewards_write_restrict_update ON crm_loyalty_rewards;
CREATE POLICY crm_loyalty_rewards_write_restrict_update ON crm_loyalty_rewards AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_loyalty_rewards_write_restrict_delete ON crm_loyalty_rewards;
CREATE POLICY crm_loyalty_rewards_write_restrict_delete ON crm_loyalty_rewards AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_communications  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_communications_write_restrict_insert ON crm_communications;
CREATE POLICY crm_communications_write_restrict_insert ON crm_communications AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_communications_write_restrict_update ON crm_communications;
CREATE POLICY crm_communications_write_restrict_update ON crm_communications AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
DROP POLICY IF EXISTS crm_communications_write_restrict_delete ON crm_communications;
CREATE POLICY crm_communications_write_restrict_delete ON crm_communications AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.marketing','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_timeline  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_timeline_write_restrict_insert ON crm_timeline;
CREATE POLICY crm_timeline_write_restrict_insert ON crm_timeline AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_timeline_write_restrict_update ON crm_timeline;
CREATE POLICY crm_timeline_write_restrict_update ON crm_timeline AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_timeline_write_restrict_delete ON crm_timeline;
CREATE POLICY crm_timeline_write_restrict_delete ON crm_timeline AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- CRM: crm_insights  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS crm_insights_write_restrict_insert ON crm_insights;
CREATE POLICY crm_insights_write_restrict_insert ON crm_insights AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_insights_write_restrict_update ON crm_insights;
CREATE POLICY crm_insights_write_restrict_update ON crm_insights AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
DROP POLICY IF EXISTS crm_insights_write_restrict_delete ON crm_insights;
CREATE POLICY crm_insights_write_restrict_delete ON crm_insights AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_leads  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_leads_write_restrict_insert ON sales_leads;
CREATE POLICY sales_leads_write_restrict_insert ON sales_leads AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.leads','crm.admin','sales.manage','sales.pipeline','sales.admin']));
DROP POLICY IF EXISTS sales_leads_write_restrict_update ON sales_leads;
CREATE POLICY sales_leads_write_restrict_update ON sales_leads AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.leads','crm.admin','sales.manage','sales.pipeline','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.leads','crm.admin','sales.manage','sales.pipeline','sales.admin']));
DROP POLICY IF EXISTS sales_leads_write_restrict_delete ON sales_leads;
CREATE POLICY sales_leads_write_restrict_delete ON sales_leads AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.leads','crm.admin','sales.manage','sales.pipeline','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_opportunities  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_opportunities_write_restrict_insert ON sales_opportunities;
CREATE POLICY sales_opportunities_write_restrict_insert ON sales_opportunities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.opportunities','crm.admin','sales.manage','sales.pipeline','sales.admin']));
DROP POLICY IF EXISTS sales_opportunities_write_restrict_update ON sales_opportunities;
CREATE POLICY sales_opportunities_write_restrict_update ON sales_opportunities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.opportunities','crm.admin','sales.manage','sales.pipeline','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.opportunities','crm.admin','sales.manage','sales.pipeline','sales.admin']));
DROP POLICY IF EXISTS sales_opportunities_write_restrict_delete ON sales_opportunities;
CREATE POLICY sales_opportunities_write_restrict_delete ON sales_opportunities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['crm.manage','crm.opportunities','crm.admin','sales.manage','sales.pipeline','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: quotations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS quotations_write_restrict_insert ON quotations;
CREATE POLICY quotations_write_restrict_insert ON quotations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin']));
DROP POLICY IF EXISTS quotations_write_restrict_update ON quotations;
CREATE POLICY quotations_write_restrict_update ON quotations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin']));
DROP POLICY IF EXISTS quotations_write_restrict_delete ON quotations;
CREATE POLICY quotations_write_restrict_delete ON quotations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.quotes','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_returns  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_returns_write_restrict_insert ON sales_returns;
CREATE POLICY sales_returns_write_restrict_insert ON sales_returns AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.returns','sales.admin']));
DROP POLICY IF EXISTS sales_returns_write_restrict_update ON sales_returns;
CREATE POLICY sales_returns_write_restrict_update ON sales_returns AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.returns','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.returns','sales.admin']));
DROP POLICY IF EXISTS sales_returns_write_restrict_delete ON sales_returns;
CREATE POLICY sales_returns_write_restrict_delete ON sales_returns AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.returns','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_contracts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_contracts_write_restrict_insert ON sales_contracts;
CREATE POLICY sales_contracts_write_restrict_insert ON sales_contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
DROP POLICY IF EXISTS sales_contracts_write_restrict_update ON sales_contracts;
CREATE POLICY sales_contracts_write_restrict_update ON sales_contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
DROP POLICY IF EXISTS sales_contracts_write_restrict_delete ON sales_contracts;
CREATE POLICY sales_contracts_write_restrict_delete ON sales_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_contract_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_contract_lines_write_restrict_insert ON sales_contract_lines;
CREATE POLICY sales_contract_lines_write_restrict_insert ON sales_contract_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
DROP POLICY IF EXISTS sales_contract_lines_write_restrict_update ON sales_contract_lines;
CREATE POLICY sales_contract_lines_write_restrict_update ON sales_contract_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
DROP POLICY IF EXISTS sales_contract_lines_write_restrict_delete ON sales_contract_lines;
CREATE POLICY sales_contract_lines_write_restrict_delete ON sales_contract_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.contracts','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_order_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_order_approvals_write_restrict_insert ON sales_order_approvals;
CREATE POLICY sales_order_approvals_write_restrict_insert ON sales_order_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_order_approvals_write_restrict_update ON sales_order_approvals;
CREATE POLICY sales_order_approvals_write_restrict_update ON sales_order_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_order_approvals_write_restrict_delete ON sales_order_approvals;
CREATE POLICY sales_order_approvals_write_restrict_delete ON sales_order_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_price_lists  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_price_lists_write_restrict_insert ON sales_price_lists;
CREATE POLICY sales_price_lists_write_restrict_insert ON sales_price_lists AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_price_lists_write_restrict_update ON sales_price_lists;
CREATE POLICY sales_price_lists_write_restrict_update ON sales_price_lists AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_price_lists_write_restrict_delete ON sales_price_lists;
CREATE POLICY sales_price_lists_write_restrict_delete ON sales_price_lists AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_price_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_price_items_write_restrict_insert ON sales_price_items;
CREATE POLICY sales_price_items_write_restrict_insert ON sales_price_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_price_items_write_restrict_update ON sales_price_items;
CREATE POLICY sales_price_items_write_restrict_update ON sales_price_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_price_items_write_restrict_delete ON sales_price_items;
CREATE POLICY sales_price_items_write_restrict_delete ON sales_price_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_discount_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_discount_rules_write_restrict_insert ON sales_discount_rules;
CREATE POLICY sales_discount_rules_write_restrict_insert ON sales_discount_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_discount_rules_write_restrict_update ON sales_discount_rules;
CREATE POLICY sales_discount_rules_write_restrict_update ON sales_discount_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_discount_rules_write_restrict_delete ON sales_discount_rules;
CREATE POLICY sales_discount_rules_write_restrict_delete ON sales_discount_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_promotions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_promotions_write_restrict_insert ON sales_promotions;
CREATE POLICY sales_promotions_write_restrict_insert ON sales_promotions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_promotions_write_restrict_update ON sales_promotions;
CREATE POLICY sales_promotions_write_restrict_update ON sales_promotions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_promotions_write_restrict_delete ON sales_promotions;
CREATE POLICY sales_promotions_write_restrict_delete ON sales_promotions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_rebates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_rebates_write_restrict_insert ON sales_rebates;
CREATE POLICY sales_rebates_write_restrict_insert ON sales_rebates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_rebates_write_restrict_update ON sales_rebates;
CREATE POLICY sales_rebates_write_restrict_update ON sales_rebates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
DROP POLICY IF EXISTS sales_rebates_write_restrict_delete ON sales_rebates;
CREATE POLICY sales_rebates_write_restrict_delete ON sales_rebates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.pricing','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_forecasts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_forecasts_write_restrict_insert ON sales_forecasts;
CREATE POLICY sales_forecasts_write_restrict_insert ON sales_forecasts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.forecast','sales.admin']));
DROP POLICY IF EXISTS sales_forecasts_write_restrict_update ON sales_forecasts;
CREATE POLICY sales_forecasts_write_restrict_update ON sales_forecasts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.forecast','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.forecast','sales.admin']));
DROP POLICY IF EXISTS sales_forecasts_write_restrict_delete ON sales_forecasts;
CREATE POLICY sales_forecasts_write_restrict_delete ON sales_forecasts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.forecast','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_teams  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_teams_write_restrict_insert ON sales_teams;
CREATE POLICY sales_teams_write_restrict_insert ON sales_teams AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_teams_write_restrict_update ON sales_teams;
CREATE POLICY sales_teams_write_restrict_update ON sales_teams AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_teams_write_restrict_delete ON sales_teams;
CREATE POLICY sales_teams_write_restrict_delete ON sales_teams AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_territories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_territories_write_restrict_insert ON sales_territories;
CREATE POLICY sales_territories_write_restrict_insert ON sales_territories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_territories_write_restrict_update ON sales_territories;
CREATE POLICY sales_territories_write_restrict_update ON sales_territories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_territories_write_restrict_delete ON sales_territories;
CREATE POLICY sales_territories_write_restrict_delete ON sales_territories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_targets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_targets_write_restrict_insert ON sales_targets;
CREATE POLICY sales_targets_write_restrict_insert ON sales_targets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_targets_write_restrict_update ON sales_targets;
CREATE POLICY sales_targets_write_restrict_update ON sales_targets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_targets_write_restrict_delete ON sales_targets;
CREATE POLICY sales_targets_write_restrict_delete ON sales_targets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_channels  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_channels_write_restrict_insert ON sales_channels;
CREATE POLICY sales_channels_write_restrict_insert ON sales_channels AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_channels_write_restrict_update ON sales_channels;
CREATE POLICY sales_channels_write_restrict_update ON sales_channels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_channels_write_restrict_delete ON sales_channels;
CREATE POLICY sales_channels_write_restrict_delete ON sales_channels AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_commissions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_commissions_write_restrict_insert ON sales_commissions;
CREATE POLICY sales_commissions_write_restrict_insert ON sales_commissions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.commissions','sales.admin']));
DROP POLICY IF EXISTS sales_commissions_write_restrict_update ON sales_commissions;
CREATE POLICY sales_commissions_write_restrict_update ON sales_commissions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.commissions','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.commissions','sales.admin']));
DROP POLICY IF EXISTS sales_commissions_write_restrict_delete ON sales_commissions;
CREATE POLICY sales_commissions_write_restrict_delete ON sales_commissions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.commissions','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_visit_plans  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_visit_plans_write_restrict_insert ON sales_visit_plans;
CREATE POLICY sales_visit_plans_write_restrict_insert ON sales_visit_plans AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_visit_plans_write_restrict_update ON sales_visit_plans;
CREATE POLICY sales_visit_plans_write_restrict_update ON sales_visit_plans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_visit_plans_write_restrict_delete ON sales_visit_plans;
CREATE POLICY sales_visit_plans_write_restrict_delete ON sales_visit_plans AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_samples  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_samples_write_restrict_insert ON sales_samples;
CREATE POLICY sales_samples_write_restrict_insert ON sales_samples AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_samples_write_restrict_update ON sales_samples;
CREATE POLICY sales_samples_write_restrict_update ON sales_samples AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_samples_write_restrict_delete ON sales_samples;
CREATE POLICY sales_samples_write_restrict_delete ON sales_samples AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_settings  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_settings_write_restrict_insert ON sales_settings;
CREATE POLICY sales_settings_write_restrict_insert ON sales_settings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_settings_write_restrict_update ON sales_settings;
CREATE POLICY sales_settings_write_restrict_update ON sales_settings AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_settings_write_restrict_delete ON sales_settings;
CREATE POLICY sales_settings_write_restrict_delete ON sales_settings AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_documents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_documents_write_restrict_insert ON sales_documents;
CREATE POLICY sales_documents_write_restrict_insert ON sales_documents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_documents_write_restrict_update ON sales_documents;
CREATE POLICY sales_documents_write_restrict_update ON sales_documents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_documents_write_restrict_delete ON sales_documents;
CREATE POLICY sales_documents_write_restrict_delete ON sales_documents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Sales: sales_activities  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_activities_write_restrict_insert ON sales_activities;
CREATE POLICY sales_activities_write_restrict_insert ON sales_activities AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_activities_write_restrict_update ON sales_activities;
CREATE POLICY sales_activities_write_restrict_update ON sales_activities AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
DROP POLICY IF EXISTS sales_activities_write_restrict_delete ON sales_activities;
CREATE POLICY sales_activities_write_restrict_delete ON sales_activities AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin']));
-- ----------------------------------------------------------------------------
-- Procurement: purchase_requisitions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS purchase_requisitions_write_restrict_insert ON purchase_requisitions;
CREATE POLICY purchase_requisitions_write_restrict_insert ON purchase_requisitions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_requisitions_write_restrict_update ON purchase_requisitions;
CREATE POLICY purchase_requisitions_write_restrict_update ON purchase_requisitions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_requisitions_write_restrict_delete ON purchase_requisitions;
CREATE POLICY purchase_requisitions_write_restrict_delete ON purchase_requisitions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
-- ----------------------------------------------------------------------------
-- Procurement: rfqs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rfqs_write_restrict_insert ON rfqs;
CREATE POLICY rfqs_write_restrict_insert ON rfqs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS rfqs_write_restrict_update ON rfqs;
CREATE POLICY rfqs_write_restrict_update ON rfqs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS rfqs_write_restrict_delete ON rfqs;
CREATE POLICY rfqs_write_restrict_delete ON rfqs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
-- ----------------------------------------------------------------------------
-- Procurement: rfq_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rfq_lines_write_restrict_insert ON rfq_lines;
CREATE POLICY rfq_lines_write_restrict_insert ON rfq_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
DROP POLICY IF EXISTS rfq_lines_write_restrict_update ON rfq_lines;
CREATE POLICY rfq_lines_write_restrict_update ON rfq_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
DROP POLICY IF EXISTS rfq_lines_write_restrict_delete ON rfq_lines;
CREATE POLICY rfq_lines_write_restrict_delete ON rfq_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
-- ----------------------------------------------------------------------------
-- Procurement: supplier_quotations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS supplier_quotations_write_restrict_insert ON supplier_quotations;
CREATE POLICY supplier_quotations_write_restrict_insert ON supplier_quotations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS supplier_quotations_write_restrict_update ON supplier_quotations;
CREATE POLICY supplier_quotations_write_restrict_update ON supplier_quotations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS supplier_quotations_write_restrict_delete ON supplier_quotations;
CREATE POLICY supplier_quotations_write_restrict_delete ON supplier_quotations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
-- ----------------------------------------------------------------------------
-- Procurement: supplier_quotation_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS supplier_quotation_lines_write_restrict_insert ON supplier_quotation_lines;
CREATE POLICY supplier_quotation_lines_write_restrict_insert ON supplier_quotation_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
DROP POLICY IF EXISTS supplier_quotation_lines_write_restrict_update ON supplier_quotation_lines;
CREATE POLICY supplier_quotation_lines_write_restrict_update ON supplier_quotation_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
DROP POLICY IF EXISTS supplier_quotation_lines_write_restrict_delete ON supplier_quotation_lines;
CREATE POLICY supplier_quotation_lines_write_restrict_delete ON supplier_quotation_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage']));
-- ----------------------------------------------------------------------------
-- Procurement: procurement_contracts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS procurement_contracts_write_restrict_insert ON procurement_contracts;
CREATE POLICY procurement_contracts_write_restrict_insert ON procurement_contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS procurement_contracts_write_restrict_update ON procurement_contracts;
CREATE POLICY procurement_contracts_write_restrict_update ON procurement_contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS procurement_contracts_write_restrict_delete ON procurement_contracts;
CREATE POLICY procurement_contracts_write_restrict_delete ON procurement_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
-- ----------------------------------------------------------------------------
-- Procurement: inbound_shipments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inbound_shipments_write_restrict_insert ON inbound_shipments;
CREATE POLICY inbound_shipments_write_restrict_insert ON inbound_shipments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS inbound_shipments_write_restrict_update ON inbound_shipments;
CREATE POLICY inbound_shipments_write_restrict_update ON inbound_shipments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS inbound_shipments_write_restrict_delete ON inbound_shipments;
CREATE POLICY inbound_shipments_write_restrict_delete ON inbound_shipments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
-- ----------------------------------------------------------------------------
-- Procurement: inventory_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS inventory_approvals_write_restrict_insert ON inventory_approvals;
CREATE POLICY inventory_approvals_write_restrict_insert ON inventory_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','inventory.manage']));
DROP POLICY IF EXISTS inventory_approvals_write_restrict_update ON inventory_approvals;
CREATE POLICY inventory_approvals_write_restrict_update ON inventory_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','inventory.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','inventory.manage']));
DROP POLICY IF EXISTS inventory_approvals_write_restrict_delete ON inventory_approvals;
CREATE POLICY inventory_approvals_write_restrict_delete ON inventory_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','inventory.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_contracts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_contracts_write_restrict_insert ON bill_contracts;
CREATE POLICY bill_contracts_write_restrict_insert ON bill_contracts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
DROP POLICY IF EXISTS bill_contracts_write_restrict_update ON bill_contracts;
CREATE POLICY bill_contracts_write_restrict_update ON bill_contracts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
DROP POLICY IF EXISTS bill_contracts_write_restrict_delete ON bill_contracts;
CREATE POLICY bill_contracts_write_restrict_delete ON bill_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
-- ----------------------------------------------------------------------------
-- Billing: bill_contract_milestones  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_contract_milestones_write_restrict_insert ON bill_contract_milestones;
CREATE POLICY bill_contract_milestones_write_restrict_insert ON bill_contract_milestones AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
DROP POLICY IF EXISTS bill_contract_milestones_write_restrict_update ON bill_contract_milestones;
CREATE POLICY bill_contract_milestones_write_restrict_update ON bill_contract_milestones AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
DROP POLICY IF EXISTS bill_contract_milestones_write_restrict_delete ON bill_contract_milestones;
CREATE POLICY bill_contract_milestones_write_restrict_delete ON bill_contract_milestones AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.contracts']));
-- ----------------------------------------------------------------------------
-- Billing: bill_credit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_credit_notes_write_restrict_insert ON bill_credit_notes;
CREATE POLICY bill_credit_notes_write_restrict_insert ON bill_credit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_credit_notes_write_restrict_update ON bill_credit_notes;
CREATE POLICY bill_credit_notes_write_restrict_update ON bill_credit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_credit_notes_write_restrict_delete ON bill_credit_notes;
CREATE POLICY bill_credit_notes_write_restrict_delete ON bill_credit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
-- ----------------------------------------------------------------------------
-- Billing: bill_debit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_debit_notes_write_restrict_insert ON bill_debit_notes;
CREATE POLICY bill_debit_notes_write_restrict_insert ON bill_debit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_debit_notes_write_restrict_update ON bill_debit_notes;
CREATE POLICY bill_debit_notes_write_restrict_update ON bill_debit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_debit_notes_write_restrict_delete ON bill_debit_notes;
CREATE POLICY bill_debit_notes_write_restrict_delete ON bill_debit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
-- ----------------------------------------------------------------------------
-- Billing: bill_credit_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_credit_approvals_write_restrict_insert ON bill_credit_approvals;
CREATE POLICY bill_credit_approvals_write_restrict_insert ON bill_credit_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
DROP POLICY IF EXISTS bill_credit_approvals_write_restrict_update ON bill_credit_approvals;
CREATE POLICY bill_credit_approvals_write_restrict_update ON bill_credit_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
DROP POLICY IF EXISTS bill_credit_approvals_write_restrict_delete ON bill_credit_approvals;
CREATE POLICY bill_credit_approvals_write_restrict_delete ON bill_credit_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit','billing.approve']));
-- ----------------------------------------------------------------------------
-- Billing: bill_credit_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_credit_rules_write_restrict_insert ON bill_credit_rules;
CREATE POLICY bill_credit_rules_write_restrict_insert ON bill_credit_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_credit_rules_write_restrict_update ON bill_credit_rules;
CREATE POLICY bill_credit_rules_write_restrict_update ON bill_credit_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
DROP POLICY IF EXISTS bill_credit_rules_write_restrict_delete ON bill_credit_rules;
CREATE POLICY bill_credit_rules_write_restrict_delete ON bill_credit_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.credit']));
-- ----------------------------------------------------------------------------
-- Billing: bill_payment_terms  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_payment_terms_write_restrict_insert ON bill_payment_terms;
CREATE POLICY bill_payment_terms_write_restrict_insert ON bill_payment_terms AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_terms_write_restrict_update ON bill_payment_terms;
CREATE POLICY bill_payment_terms_write_restrict_update ON bill_payment_terms AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_terms_write_restrict_delete ON bill_payment_terms;
CREATE POLICY bill_payment_terms_write_restrict_delete ON bill_payment_terms AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_payment_gateways  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_payment_gateways_write_restrict_insert ON bill_payment_gateways;
CREATE POLICY bill_payment_gateways_write_restrict_insert ON bill_payment_gateways AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_gateways_write_restrict_update ON bill_payment_gateways;
CREATE POLICY bill_payment_gateways_write_restrict_update ON bill_payment_gateways AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_gateways_write_restrict_delete ON bill_payment_gateways;
CREATE POLICY bill_payment_gateways_write_restrict_delete ON bill_payment_gateways AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_payment_intents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_payment_intents_write_restrict_insert ON bill_payment_intents;
CREATE POLICY bill_payment_intents_write_restrict_insert ON bill_payment_intents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_intents_write_restrict_update ON bill_payment_intents;
CREATE POLICY bill_payment_intents_write_restrict_update ON bill_payment_intents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_payment_intents_write_restrict_delete ON bill_payment_intents;
CREATE POLICY bill_payment_intents_write_restrict_delete ON bill_payment_intents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_recurring_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_recurring_schedules_write_restrict_insert ON bill_recurring_schedules;
CREATE POLICY bill_recurring_schedules_write_restrict_insert ON bill_recurring_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring']));
DROP POLICY IF EXISTS bill_recurring_schedules_write_restrict_update ON bill_recurring_schedules;
CREATE POLICY bill_recurring_schedules_write_restrict_update ON bill_recurring_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring']));
DROP POLICY IF EXISTS bill_recurring_schedules_write_restrict_delete ON bill_recurring_schedules;
CREATE POLICY bill_recurring_schedules_write_restrict_delete ON bill_recurring_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring']));
-- ----------------------------------------------------------------------------
-- Billing: bill_reminders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_reminders_write_restrict_insert ON bill_reminders;
CREATE POLICY bill_reminders_write_restrict_insert ON bill_reminders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
DROP POLICY IF EXISTS bill_reminders_write_restrict_update ON bill_reminders;
CREATE POLICY bill_reminders_write_restrict_update ON bill_reminders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
DROP POLICY IF EXISTS bill_reminders_write_restrict_delete ON bill_reminders;
CREATE POLICY bill_reminders_write_restrict_delete ON bill_reminders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_dunning_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_dunning_rules_write_restrict_insert ON bill_dunning_rules;
CREATE POLICY bill_dunning_rules_write_restrict_insert ON bill_dunning_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
DROP POLICY IF EXISTS bill_dunning_rules_write_restrict_update ON bill_dunning_rules;
CREATE POLICY bill_dunning_rules_write_restrict_update ON bill_dunning_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
DROP POLICY IF EXISTS bill_dunning_rules_write_restrict_delete ON bill_dunning_rules;
CREATE POLICY bill_dunning_rules_write_restrict_delete ON bill_dunning_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.recurring','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_fraud_alerts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_fraud_alerts_write_restrict_insert ON bill_fraud_alerts;
CREATE POLICY bill_fraud_alerts_write_restrict_insert ON bill_fraud_alerts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_fraud_alerts_write_restrict_update ON bill_fraud_alerts;
CREATE POLICY bill_fraud_alerts_write_restrict_update ON bill_fraud_alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_fraud_alerts_write_restrict_delete ON bill_fraud_alerts;
CREATE POLICY bill_fraud_alerts_write_restrict_delete ON bill_fraud_alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_invoice_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_invoice_templates_write_restrict_insert ON bill_invoice_templates;
CREATE POLICY bill_invoice_templates_write_restrict_insert ON bill_invoice_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_invoice_templates_write_restrict_update ON bill_invoice_templates;
CREATE POLICY bill_invoice_templates_write_restrict_update ON bill_invoice_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_invoice_templates_write_restrict_delete ON bill_invoice_templates;
CREATE POLICY bill_invoice_templates_write_restrict_delete ON bill_invoice_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_invoice_versions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_invoice_versions_write_restrict_insert ON bill_invoice_versions;
CREATE POLICY bill_invoice_versions_write_restrict_insert ON bill_invoice_versions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_invoice_versions_write_restrict_update ON bill_invoice_versions;
CREATE POLICY bill_invoice_versions_write_restrict_update ON bill_invoice_versions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_invoice_versions_write_restrict_delete ON bill_invoice_versions;
CREATE POLICY bill_invoice_versions_write_restrict_delete ON bill_invoice_versions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_price_lists  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_price_lists_write_restrict_insert ON bill_price_lists;
CREATE POLICY bill_price_lists_write_restrict_insert ON bill_price_lists AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_price_lists_write_restrict_update ON bill_price_lists;
CREATE POLICY bill_price_lists_write_restrict_update ON bill_price_lists AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_price_lists_write_restrict_delete ON bill_price_lists;
CREATE POLICY bill_price_lists_write_restrict_delete ON bill_price_lists AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_price_list_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_price_list_items_write_restrict_insert ON bill_price_list_items;
CREATE POLICY bill_price_list_items_write_restrict_insert ON bill_price_list_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_price_list_items_write_restrict_update ON bill_price_list_items;
CREATE POLICY bill_price_list_items_write_restrict_update ON bill_price_list_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_price_list_items_write_restrict_delete ON bill_price_list_items;
CREATE POLICY bill_price_list_items_write_restrict_delete ON bill_price_list_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_tax_codes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_tax_codes_write_restrict_insert ON bill_tax_codes;
CREATE POLICY bill_tax_codes_write_restrict_insert ON bill_tax_codes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
DROP POLICY IF EXISTS bill_tax_codes_write_restrict_update ON bill_tax_codes;
CREATE POLICY bill_tax_codes_write_restrict_update ON bill_tax_codes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
DROP POLICY IF EXISTS bill_tax_codes_write_restrict_delete ON bill_tax_codes;
CREATE POLICY bill_tax_codes_write_restrict_delete ON bill_tax_codes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
-- ----------------------------------------------------------------------------
-- Billing: bill_tax_groups  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_tax_groups_write_restrict_insert ON bill_tax_groups;
CREATE POLICY bill_tax_groups_write_restrict_insert ON bill_tax_groups AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
DROP POLICY IF EXISTS bill_tax_groups_write_restrict_update ON bill_tax_groups;
CREATE POLICY bill_tax_groups_write_restrict_update ON bill_tax_groups AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
DROP POLICY IF EXISTS bill_tax_groups_write_restrict_delete ON bill_tax_groups;
CREATE POLICY bill_tax_groups_write_restrict_delete ON bill_tax_groups AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.tax']));
-- ----------------------------------------------------------------------------
-- Billing: bill_sequences  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_sequences_write_restrict_insert ON bill_sequences;
CREATE POLICY bill_sequences_write_restrict_insert ON bill_sequences AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_sequences_write_restrict_update ON bill_sequences;
CREATE POLICY bill_sequences_write_restrict_update ON bill_sequences AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_sequences_write_restrict_delete ON bill_sequences;
CREATE POLICY bill_sequences_write_restrict_delete ON bill_sequences AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_statement_requests  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_statement_requests_write_restrict_insert ON bill_statement_requests;
CREATE POLICY bill_statement_requests_write_restrict_insert ON bill_statement_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_statement_requests_write_restrict_update ON bill_statement_requests;
CREATE POLICY bill_statement_requests_write_restrict_update ON bill_statement_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_statement_requests_write_restrict_delete ON bill_statement_requests;
CREATE POLICY bill_statement_requests_write_restrict_delete ON bill_statement_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_approval_actions  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_approval_actions_write_restrict_insert ON bill_approval_actions;
CREATE POLICY bill_approval_actions_write_restrict_insert ON bill_approval_actions AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
DROP POLICY IF EXISTS bill_approval_actions_write_restrict_update ON bill_approval_actions;
CREATE POLICY bill_approval_actions_write_restrict_update ON bill_approval_actions AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
DROP POLICY IF EXISTS bill_approval_actions_write_restrict_delete ON bill_approval_actions;
CREATE POLICY bill_approval_actions_write_restrict_delete ON bill_approval_actions AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
-- ----------------------------------------------------------------------------
-- Billing: bill_approval_steps  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_approval_steps_write_restrict_insert ON bill_approval_steps;
CREATE POLICY bill_approval_steps_write_restrict_insert ON bill_approval_steps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
DROP POLICY IF EXISTS bill_approval_steps_write_restrict_update ON bill_approval_steps;
CREATE POLICY bill_approval_steps_write_restrict_update ON bill_approval_steps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
DROP POLICY IF EXISTS bill_approval_steps_write_restrict_delete ON bill_approval_steps;
CREATE POLICY bill_approval_steps_write_restrict_delete ON bill_approval_steps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.approve']));
-- ----------------------------------------------------------------------------
-- Billing: bill_revenue_entries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_revenue_entries_write_restrict_insert ON bill_revenue_entries;
CREATE POLICY bill_revenue_entries_write_restrict_insert ON bill_revenue_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_revenue_entries_write_restrict_update ON bill_revenue_entries;
CREATE POLICY bill_revenue_entries_write_restrict_update ON bill_revenue_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_revenue_entries_write_restrict_delete ON bill_revenue_entries;
CREATE POLICY bill_revenue_entries_write_restrict_delete ON bill_revenue_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_revenue_schedules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_revenue_schedules_write_restrict_insert ON bill_revenue_schedules;
CREATE POLICY bill_revenue_schedules_write_restrict_insert ON bill_revenue_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_revenue_schedules_write_restrict_update ON bill_revenue_schedules;
CREATE POLICY bill_revenue_schedules_write_restrict_update ON bill_revenue_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
DROP POLICY IF EXISTS bill_revenue_schedules_write_restrict_delete ON bill_revenue_schedules;
CREATE POLICY bill_revenue_schedules_write_restrict_delete ON bill_revenue_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage']));
-- ----------------------------------------------------------------------------
-- Billing: bill_reconciliation_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_reconciliation_batches_write_restrict_insert ON bill_reconciliation_batches;
CREATE POLICY bill_reconciliation_batches_write_restrict_insert ON bill_reconciliation_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_reconciliation_batches_write_restrict_update ON bill_reconciliation_batches;
CREATE POLICY bill_reconciliation_batches_write_restrict_update ON bill_reconciliation_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_reconciliation_batches_write_restrict_delete ON bill_reconciliation_batches;
CREATE POLICY bill_reconciliation_batches_write_restrict_delete ON bill_reconciliation_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_reconciliation_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_reconciliation_lines_write_restrict_insert ON bill_reconciliation_lines;
CREATE POLICY bill_reconciliation_lines_write_restrict_insert ON bill_reconciliation_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_reconciliation_lines_write_restrict_update ON bill_reconciliation_lines;
CREATE POLICY bill_reconciliation_lines_write_restrict_update ON bill_reconciliation_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
DROP POLICY IF EXISTS bill_reconciliation_lines_write_restrict_delete ON bill_reconciliation_lines;
CREATE POLICY bill_reconciliation_lines_write_restrict_delete ON bill_reconciliation_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.collect']));
-- ----------------------------------------------------------------------------
-- Billing: bill_portal_disputes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_portal_disputes_write_restrict_insert ON bill_portal_disputes;
CREATE POLICY bill_portal_disputes_write_restrict_insert ON bill_portal_disputes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
DROP POLICY IF EXISTS bill_portal_disputes_write_restrict_update ON bill_portal_disputes;
CREATE POLICY bill_portal_disputes_write_restrict_update ON bill_portal_disputes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
DROP POLICY IF EXISTS bill_portal_disputes_write_restrict_delete ON bill_portal_disputes;
CREATE POLICY bill_portal_disputes_write_restrict_delete ON bill_portal_disputes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
-- ----------------------------------------------------------------------------
-- Billing: bill_portal_users  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_portal_users_write_restrict_insert ON bill_portal_users;
CREATE POLICY bill_portal_users_write_restrict_insert ON bill_portal_users AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
DROP POLICY IF EXISTS bill_portal_users_write_restrict_update ON bill_portal_users;
CREATE POLICY bill_portal_users_write_restrict_update ON bill_portal_users AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
DROP POLICY IF EXISTS bill_portal_users_write_restrict_delete ON bill_portal_users;
CREATE POLICY bill_portal_users_write_restrict_delete ON bill_portal_users AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.portal']));
-- ----------------------------------------------------------------------------
-- Billing: bill_projects  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_projects_write_restrict_insert ON bill_projects;
CREATE POLICY bill_projects_write_restrict_insert ON bill_projects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
DROP POLICY IF EXISTS bill_projects_write_restrict_update ON bill_projects;
CREATE POLICY bill_projects_write_restrict_update ON bill_projects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
DROP POLICY IF EXISTS bill_projects_write_restrict_delete ON bill_projects;
CREATE POLICY bill_projects_write_restrict_delete ON bill_projects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
-- ----------------------------------------------------------------------------
-- Billing: bill_project_entries  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_project_entries_write_restrict_insert ON bill_project_entries;
CREATE POLICY bill_project_entries_write_restrict_insert ON bill_project_entries AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
DROP POLICY IF EXISTS bill_project_entries_write_restrict_update ON bill_project_entries;
CREATE POLICY bill_project_entries_write_restrict_update ON bill_project_entries AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
DROP POLICY IF EXISTS bill_project_entries_write_restrict_delete ON bill_project_entries;
CREATE POLICY bill_project_entries_write_restrict_delete ON bill_project_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.projects']));
-- ----------------------------------------------------------------------------
-- Billing: bill_delivery_links  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bill_delivery_links_write_restrict_insert ON bill_delivery_links;
CREATE POLICY bill_delivery_links_write_restrict_insert ON bill_delivery_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.mfg','billing.design']));
DROP POLICY IF EXISTS bill_delivery_links_write_restrict_update ON bill_delivery_links;
CREATE POLICY bill_delivery_links_write_restrict_update ON bill_delivery_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.mfg','billing.design']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.mfg','billing.design']));
DROP POLICY IF EXISTS bill_delivery_links_write_restrict_delete ON bill_delivery_links;
CREATE POLICY bill_delivery_links_write_restrict_delete ON bill_delivery_links AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['billing.manage','billing.mfg','billing.design']));
-- ----------------------------------------------------------------------------
-- Service Desk: support_tickets  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS support_tickets_write_restrict_insert ON support_tickets;
CREATE POLICY support_tickets_write_restrict_insert ON support_tickets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']));
DROP POLICY IF EXISTS support_tickets_write_restrict_update ON support_tickets;
CREATE POLICY support_tickets_write_restrict_update ON support_tickets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']));
DROP POLICY IF EXISTS support_tickets_write_restrict_delete ON support_tickets;
CREATE POLICY support_tickets_write_restrict_delete ON support_tickets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_agents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_agents_write_restrict_insert ON sd_agents;
CREATE POLICY sd_agents_write_restrict_insert ON sd_agents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_agents_write_restrict_update ON sd_agents;
CREATE POLICY sd_agents_write_restrict_update ON sd_agents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_agents_write_restrict_delete ON sd_agents;
CREATE POLICY sd_agents_write_restrict_delete ON sd_agents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_approvals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_approvals_write_restrict_insert ON sd_approvals;
CREATE POLICY sd_approvals_write_restrict_insert ON sd_approvals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.approve','sd.admin']));
DROP POLICY IF EXISTS sd_approvals_write_restrict_update ON sd_approvals;
CREATE POLICY sd_approvals_write_restrict_update ON sd_approvals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.approve','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.approve','sd.admin']));
DROP POLICY IF EXISTS sd_approvals_write_restrict_delete ON sd_approvals;
CREATE POLICY sd_approvals_write_restrict_delete ON sd_approvals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.approve','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_automations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_automations_write_restrict_insert ON sd_automations;
CREATE POLICY sd_automations_write_restrict_insert ON sd_automations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_automations_write_restrict_update ON sd_automations;
CREATE POLICY sd_automations_write_restrict_update ON sd_automations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_automations_write_restrict_delete ON sd_automations;
CREATE POLICY sd_automations_write_restrict_delete ON sd_automations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_calendars  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_calendars_write_restrict_insert ON sd_calendars;
CREATE POLICY sd_calendars_write_restrict_insert ON sd_calendars AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_calendars_write_restrict_update ON sd_calendars;
CREATE POLICY sd_calendars_write_restrict_update ON sd_calendars AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_calendars_write_restrict_delete ON sd_calendars;
CREATE POLICY sd_calendars_write_restrict_delete ON sd_calendars AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_categories  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_categories_write_restrict_insert ON sd_categories;
CREATE POLICY sd_categories_write_restrict_insert ON sd_categories AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_categories_write_restrict_update ON sd_categories;
CREATE POLICY sd_categories_write_restrict_update ON sd_categories AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_categories_write_restrict_delete ON sd_categories;
CREATE POLICY sd_categories_write_restrict_delete ON sd_categories AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_changes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_changes_write_restrict_insert ON sd_changes;
CREATE POLICY sd_changes_write_restrict_insert ON sd_changes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.change']));
DROP POLICY IF EXISTS sd_changes_write_restrict_update ON sd_changes;
CREATE POLICY sd_changes_write_restrict_update ON sd_changes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.change']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.change']));
DROP POLICY IF EXISTS sd_changes_write_restrict_delete ON sd_changes;
CREATE POLICY sd_changes_write_restrict_delete ON sd_changes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.change']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_channels  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_channels_write_restrict_insert ON sd_channels;
CREATE POLICY sd_channels_write_restrict_insert ON sd_channels AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_channels_write_restrict_update ON sd_channels;
CREATE POLICY sd_channels_write_restrict_update ON sd_channels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_channels_write_restrict_delete ON sd_channels;
CREATE POLICY sd_channels_write_restrict_delete ON sd_channels AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_cmdb_cis  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_cmdb_cis_write_restrict_insert ON sd_cmdb_cis;
CREATE POLICY sd_cmdb_cis_write_restrict_insert ON sd_cmdb_cis AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_cmdb_cis_write_restrict_update ON sd_cmdb_cis;
CREATE POLICY sd_cmdb_cis_write_restrict_update ON sd_cmdb_cis AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_cmdb_cis_write_restrict_delete ON sd_cmdb_cis;
CREATE POLICY sd_cmdb_cis_write_restrict_delete ON sd_cmdb_cis AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_cmdb_relations  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_cmdb_relations_write_restrict_insert ON sd_cmdb_relations;
CREATE POLICY sd_cmdb_relations_write_restrict_insert ON sd_cmdb_relations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_cmdb_relations_write_restrict_update ON sd_cmdb_relations;
CREATE POLICY sd_cmdb_relations_write_restrict_update ON sd_cmdb_relations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_cmdb_relations_write_restrict_delete ON sd_cmdb_relations;
CREATE POLICY sd_cmdb_relations_write_restrict_delete ON sd_cmdb_relations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_csat_responses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_csat_responses_write_restrict_insert ON sd_csat_responses;
CREATE POLICY sd_csat_responses_write_restrict_insert ON sd_csat_responses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_csat_responses_write_restrict_update ON sd_csat_responses;
CREATE POLICY sd_csat_responses_write_restrict_update ON sd_csat_responses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_csat_responses_write_restrict_delete ON sd_csat_responses;
CREATE POLICY sd_csat_responses_write_restrict_delete ON sd_csat_responses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_escalation_rules  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_escalation_rules_write_restrict_insert ON sd_escalation_rules;
CREATE POLICY sd_escalation_rules_write_restrict_insert ON sd_escalation_rules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_escalation_rules_write_restrict_update ON sd_escalation_rules;
CREATE POLICY sd_escalation_rules_write_restrict_update ON sd_escalation_rules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_escalation_rules_write_restrict_delete ON sd_escalation_rules;
CREATE POLICY sd_escalation_rules_write_restrict_delete ON sd_escalation_rules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_field_jobs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_field_jobs_write_restrict_insert ON sd_field_jobs;
CREATE POLICY sd_field_jobs_write_restrict_insert ON sd_field_jobs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.field']));
DROP POLICY IF EXISTS sd_field_jobs_write_restrict_update ON sd_field_jobs;
CREATE POLICY sd_field_jobs_write_restrict_update ON sd_field_jobs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.field']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.field']));
DROP POLICY IF EXISTS sd_field_jobs_write_restrict_delete ON sd_field_jobs;
CREATE POLICY sd_field_jobs_write_restrict_delete ON sd_field_jobs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.field']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_holidays  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_holidays_write_restrict_insert ON sd_holidays;
CREATE POLICY sd_holidays_write_restrict_insert ON sd_holidays AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_holidays_write_restrict_update ON sd_holidays;
CREATE POLICY sd_holidays_write_restrict_update ON sd_holidays AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_holidays_write_restrict_delete ON sd_holidays;
CREATE POLICY sd_holidays_write_restrict_delete ON sd_holidays AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_inbound_items  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_inbound_items_write_restrict_insert ON sd_inbound_items;
CREATE POLICY sd_inbound_items_write_restrict_insert ON sd_inbound_items AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_inbound_items_write_restrict_update ON sd_inbound_items;
CREATE POLICY sd_inbound_items_write_restrict_update ON sd_inbound_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_inbound_items_write_restrict_delete ON sd_inbound_items;
CREATE POLICY sd_inbound_items_write_restrict_delete ON sd_inbound_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_knowledge_articles  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_knowledge_articles_write_restrict_insert ON sd_knowledge_articles;
CREATE POLICY sd_knowledge_articles_write_restrict_insert ON sd_knowledge_articles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.knowledge']));
DROP POLICY IF EXISTS sd_knowledge_articles_write_restrict_update ON sd_knowledge_articles;
CREATE POLICY sd_knowledge_articles_write_restrict_update ON sd_knowledge_articles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.knowledge']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.knowledge']));
DROP POLICY IF EXISTS sd_knowledge_articles_write_restrict_delete ON sd_knowledge_articles;
CREATE POLICY sd_knowledge_articles_write_restrict_delete ON sd_knowledge_articles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.knowledge']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_major_incidents  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_major_incidents_write_restrict_insert ON sd_major_incidents;
CREATE POLICY sd_major_incidents_write_restrict_insert ON sd_major_incidents AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.major']));
DROP POLICY IF EXISTS sd_major_incidents_write_restrict_update ON sd_major_incidents;
CREATE POLICY sd_major_incidents_write_restrict_update ON sd_major_incidents AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.major']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.major']));
DROP POLICY IF EXISTS sd_major_incidents_write_restrict_delete ON sd_major_incidents;
CREATE POLICY sd_major_incidents_write_restrict_delete ON sd_major_incidents AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.major']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_nps_responses  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_nps_responses_write_restrict_insert ON sd_nps_responses;
CREATE POLICY sd_nps_responses_write_restrict_insert ON sd_nps_responses AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_nps_responses_write_restrict_update ON sd_nps_responses;
CREATE POLICY sd_nps_responses_write_restrict_update ON sd_nps_responses AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
DROP POLICY IF EXISTS sd_nps_responses_write_restrict_delete ON sd_nps_responses;
CREATE POLICY sd_nps_responses_write_restrict_delete ON sd_nps_responses AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.agent']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_problems  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_problems_write_restrict_insert ON sd_problems;
CREATE POLICY sd_problems_write_restrict_insert ON sd_problems AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_problems_write_restrict_update ON sd_problems;
CREATE POLICY sd_problems_write_restrict_update ON sd_problems AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_problems_write_restrict_delete ON sd_problems;
CREATE POLICY sd_problems_write_restrict_delete ON sd_problems AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_sla_policies  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_sla_policies_write_restrict_insert ON sd_sla_policies;
CREATE POLICY sd_sla_policies_write_restrict_insert ON sd_sla_policies AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_sla_policies_write_restrict_update ON sd_sla_policies;
CREATE POLICY sd_sla_policies_write_restrict_update ON sd_sla_policies AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
DROP POLICY IF EXISTS sd_sla_policies_write_restrict_delete ON sd_sla_policies;
CREATE POLICY sd_sla_policies_write_restrict_delete ON sd_sla_policies AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage','sd.admin']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_teams  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_teams_write_restrict_insert ON sd_teams;
CREATE POLICY sd_teams_write_restrict_insert ON sd_teams AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_teams_write_restrict_update ON sd_teams;
CREATE POLICY sd_teams_write_restrict_update ON sd_teams AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_teams_write_restrict_delete ON sd_teams;
CREATE POLICY sd_teams_write_restrict_delete ON sd_teams AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
-- ----------------------------------------------------------------------------
-- Service Desk: sd_ticket_templates  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sd_ticket_templates_write_restrict_insert ON sd_ticket_templates;
CREATE POLICY sd_ticket_templates_write_restrict_insert ON sd_ticket_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_ticket_templates_write_restrict_update ON sd_ticket_templates;
CREATE POLICY sd_ticket_templates_write_restrict_update ON sd_ticket_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
DROP POLICY IF EXISTS sd_ticket_templates_write_restrict_delete ON sd_ticket_templates;
CREATE POLICY sd_ticket_templates_write_restrict_delete ON sd_ticket_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sd.manage']));
