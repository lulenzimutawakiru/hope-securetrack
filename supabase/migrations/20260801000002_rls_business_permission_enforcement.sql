-- ============================================================================
-- RLS Business Permission Enforcement (Phase 2)
--
-- Closes the data-layer RBAC gap: previously any authenticated member of a
-- company could INSERT / UPDATE / DELETE business records directly through the
-- browser client (supabase.from(...)) because the permissive *_all policies were
-- gated only by company_id = user_company_id().
--
-- This migration adds RESTRICTIVE write policies (INSERT / UPDATE / DELETE) to
-- high-risk financial, payroll, sales/CRM, HR and procurement tables. Restrictive
-- policies AND with the existing permissive policies and the migration-71
-- tenant_isolation_restrict policy, so writes now require:
--   1. tenant + company scope (existing policies), AND
--   2. a matching module permission (new policies) OR super_administrator.
--
-- SELECT stays open to any company member (the 900+ page client UI reads
-- directly); only WRITE paths are hardened. All permission slugs were verified
-- against the live permissions catalog.
--
-- Also fixes: the migration-71 restrictive policy on roles made global role
-- templates (company_id IS NULL) invisible to authenticated users, breaking role
-- listing in Identity and the role_permissions read path. Global templates are
-- readable again; writes to global rows remain impossible (no permissive write
-- policy exists and WITH CHECK keeps requiring tenant_company_access).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles: restore read visibility of global role templates
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_restrict ON roles;
CREATE POLICY tenant_isolation_restrict ON roles AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (company_id IS NULL AND tenant_id IS NULL)
    OR public.tenant_company_access(tenant_id, company_id)
  )
  WITH CHECK (public.tenant_company_access(tenant_id, company_id));

-- ----------------------------------------------------------------------------
-- invoices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS invoices_write_restrict_insert ON invoices;
CREATE POLICY invoices_write_restrict_insert ON invoices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS invoices_write_restrict_update ON invoices;
CREATE POLICY invoices_write_restrict_update ON invoices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS invoices_write_restrict_delete ON invoices;
CREATE POLICY invoices_write_restrict_delete ON invoices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- invoice_payments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS invoice_payments_write_restrict_insert ON invoice_payments;
CREATE POLICY invoice_payments_write_restrict_insert ON invoice_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS invoice_payments_write_restrict_update ON invoice_payments;
CREATE POLICY invoice_payments_write_restrict_update ON invoice_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS invoice_payments_write_restrict_delete ON invoice_payments;
CREATE POLICY invoice_payments_write_restrict_delete ON invoice_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- gl_journals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS gl_journals_write_restrict_insert ON gl_journals;
CREATE POLICY gl_journals_write_restrict_insert ON gl_journals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS gl_journals_write_restrict_update ON gl_journals;
CREATE POLICY gl_journals_write_restrict_update ON gl_journals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS gl_journals_write_restrict_delete ON gl_journals;
CREATE POLICY gl_journals_write_restrict_delete ON gl_journals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- gl_journal_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS gl_journal_lines_write_restrict_insert ON gl_journal_lines;
CREATE POLICY gl_journal_lines_write_restrict_insert ON gl_journal_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS gl_journal_lines_write_restrict_update ON gl_journal_lines;
CREATE POLICY gl_journal_lines_write_restrict_update ON gl_journal_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS gl_journal_lines_write_restrict_delete ON gl_journal_lines;
CREATE POLICY gl_journal_lines_write_restrict_delete ON gl_journal_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- ar_receipts  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ar_receipts_write_restrict_insert ON ar_receipts;
CREATE POLICY ar_receipts_write_restrict_insert ON ar_receipts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ar_receipts_write_restrict_update ON ar_receipts;
CREATE POLICY ar_receipts_write_restrict_update ON ar_receipts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ar_receipts_write_restrict_delete ON ar_receipts;
CREATE POLICY ar_receipts_write_restrict_delete ON ar_receipts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- ar_credit_notes  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ar_credit_notes_write_restrict_insert ON ar_credit_notes;
CREATE POLICY ar_credit_notes_write_restrict_insert ON ar_credit_notes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ar_credit_notes_write_restrict_update ON ar_credit_notes;
CREATE POLICY ar_credit_notes_write_restrict_update ON ar_credit_notes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ar_credit_notes_write_restrict_delete ON ar_credit_notes;
CREATE POLICY ar_credit_notes_write_restrict_delete ON ar_credit_notes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- ap_invoices  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ap_invoices_write_restrict_insert ON ap_invoices;
CREATE POLICY ap_invoices_write_restrict_insert ON ap_invoices AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ap_invoices_write_restrict_update ON ap_invoices;
CREATE POLICY ap_invoices_write_restrict_update ON ap_invoices AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ap_invoices_write_restrict_delete ON ap_invoices;
CREATE POLICY ap_invoices_write_restrict_delete ON ap_invoices AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- ap_payments  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ap_payments_write_restrict_insert ON ap_payments;
CREATE POLICY ap_payments_write_restrict_insert ON ap_payments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ap_payments_write_restrict_update ON ap_payments;
CREATE POLICY ap_payments_write_restrict_update ON ap_payments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS ap_payments_write_restrict_delete ON ap_payments;
CREATE POLICY ap_payments_write_restrict_delete ON ap_payments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- fin_auto_journals  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS fin_auto_journals_write_restrict_insert ON fin_auto_journals;
CREATE POLICY fin_auto_journals_write_restrict_insert ON fin_auto_journals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS fin_auto_journals_write_restrict_update ON fin_auto_journals;
CREATE POLICY fin_auto_journals_write_restrict_update ON fin_auto_journals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));
DROP POLICY IF EXISTS fin_auto_journals_write_restrict_delete ON fin_auto_journals;
CREATE POLICY fin_auto_journals_write_restrict_delete ON fin_auto_journals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage']));

-- ----------------------------------------------------------------------------
-- payroll_runs  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_runs_write_restrict_insert ON payroll_runs;
CREATE POLICY payroll_runs_write_restrict_insert ON payroll_runs AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS payroll_runs_write_restrict_update ON payroll_runs;
CREATE POLICY payroll_runs_write_restrict_update ON payroll_runs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS payroll_runs_write_restrict_delete ON payroll_runs;
CREATE POLICY payroll_runs_write_restrict_delete ON payroll_runs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));

-- ----------------------------------------------------------------------------
-- payroll_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_lines_write_restrict_insert ON payroll_lines;
CREATE POLICY payroll_lines_write_restrict_insert ON payroll_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS payroll_lines_write_restrict_update ON payroll_lines;
CREATE POLICY payroll_lines_write_restrict_update ON payroll_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS payroll_lines_write_restrict_delete ON payroll_lines;
CREATE POLICY payroll_lines_write_restrict_delete ON payroll_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));

-- ----------------------------------------------------------------------------
-- pay_payslips  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_payslips_write_restrict_insert ON pay_payslips;
CREATE POLICY pay_payslips_write_restrict_insert ON pay_payslips AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS pay_payslips_write_restrict_update ON pay_payslips;
CREATE POLICY pay_payslips_write_restrict_update ON pay_payslips AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS pay_payslips_write_restrict_delete ON pay_payslips;
CREATE POLICY pay_payslips_write_restrict_delete ON pay_payslips AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));

-- ----------------------------------------------------------------------------
-- pay_payment_batches  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS pay_payment_batches_write_restrict_insert ON pay_payment_batches;
CREATE POLICY pay_payment_batches_write_restrict_insert ON pay_payment_batches AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS pay_payment_batches_write_restrict_update ON pay_payment_batches;
CREATE POLICY pay_payment_batches_write_restrict_update ON pay_payment_batches AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));
DROP POLICY IF EXISTS pay_payment_batches_write_restrict_delete ON pay_payment_batches;
CREATE POLICY pay_payment_batches_write_restrict_delete ON pay_payment_batches AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['payroll.manage','payroll.process','payroll.approve','payroll.pay','payroll.admin']));

-- ----------------------------------------------------------------------------
-- sales_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_orders_write_restrict_insert ON sales_orders;
CREATE POLICY sales_orders_write_restrict_insert ON sales_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));
DROP POLICY IF EXISTS sales_orders_write_restrict_update ON sales_orders;
CREATE POLICY sales_orders_write_restrict_update ON sales_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));
DROP POLICY IF EXISTS sales_orders_write_restrict_delete ON sales_orders;
CREATE POLICY sales_orders_write_restrict_delete ON sales_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));

-- ----------------------------------------------------------------------------
-- customers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS customers_write_restrict_insert ON customers;
CREATE POLICY customers_write_restrict_insert ON customers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));
DROP POLICY IF EXISTS customers_write_restrict_update ON customers;
CREATE POLICY customers_write_restrict_update ON customers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));
DROP POLICY IF EXISTS customers_write_restrict_delete ON customers;
CREATE POLICY customers_write_restrict_delete ON customers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin']));

-- ----------------------------------------------------------------------------
-- employees  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS employees_write_restrict_insert ON employees;
CREATE POLICY employees_write_restrict_insert ON employees AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','users.manage']));
DROP POLICY IF EXISTS employees_write_restrict_update ON employees;
CREATE POLICY employees_write_restrict_update ON employees AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','users.manage']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','users.manage']));
DROP POLICY IF EXISTS employees_write_restrict_delete ON employees;
CREATE POLICY employees_write_restrict_delete ON employees AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['hr.manage','users.manage']));

-- ----------------------------------------------------------------------------
-- purchase_orders  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS purchase_orders_write_restrict_insert ON purchase_orders;
CREATE POLICY purchase_orders_write_restrict_insert ON purchase_orders AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_orders_write_restrict_update ON purchase_orders;
CREATE POLICY purchase_orders_write_restrict_update ON purchase_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_orders_write_restrict_delete ON purchase_orders;
CREATE POLICY purchase_orders_write_restrict_delete ON purchase_orders AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));

-- ----------------------------------------------------------------------------
-- purchase_order_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS purchase_order_lines_write_restrict_insert ON purchase_order_lines;
CREATE POLICY purchase_order_lines_write_restrict_insert ON purchase_order_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_order_lines_write_restrict_update ON purchase_order_lines;
CREATE POLICY purchase_order_lines_write_restrict_update ON purchase_order_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));
DROP POLICY IF EXISTS purchase_order_lines_write_restrict_delete ON purchase_order_lines;
CREATE POLICY purchase_order_lines_write_restrict_delete ON purchase_order_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve']));

-- ----------------------------------------------------------------------------
-- suppliers  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS suppliers_write_restrict_insert ON suppliers;
CREATE POLICY suppliers_write_restrict_insert ON suppliers AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','finance.manage','finance.admin']));
DROP POLICY IF EXISTS suppliers_write_restrict_update ON suppliers;
CREATE POLICY suppliers_write_restrict_update ON suppliers AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','finance.manage','finance.admin']))
  WITH CHECK (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','finance.manage','finance.admin']));
DROP POLICY IF EXISTS suppliers_write_restrict_delete ON suppliers;
CREATE POLICY suppliers_write_restrict_delete ON suppliers AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_any_permission(ARRAY['procurement.manage','procurement.approve','finance.manage','finance.admin']));

-- ----------------------------------------------------------------------------
-- invoice_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS invoice_lines_write_restrict_insert ON invoice_lines;
CREATE POLICY invoice_lines_write_restrict_insert ON invoice_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage'])));
DROP POLICY IF EXISTS invoice_lines_write_restrict_update ON invoice_lines;
CREATE POLICY invoice_lines_write_restrict_update ON invoice_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage'])))
  WITH CHECK ((invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage'])));
DROP POLICY IF EXISTS invoice_lines_write_restrict_delete ON invoice_lines;
CREATE POLICY invoice_lines_write_restrict_delete ON invoice_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((invoice_id IN (SELECT id FROM invoices WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['finance.manage','finance.post','finance.approve','finance.admin','finance.cfo','invoices.manage'])));

-- ----------------------------------------------------------------------------
-- sales_order_lines  (write gate)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_order_lines_write_restrict_insert ON sales_order_lines;
CREATE POLICY sales_order_lines_write_restrict_insert ON sales_order_lines AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin'])));
DROP POLICY IF EXISTS sales_order_lines_write_restrict_update ON sales_order_lines;
CREATE POLICY sales_order_lines_write_restrict_update ON sales_order_lines AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin'])))
  WITH CHECK ((order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin'])));
DROP POLICY IF EXISTS sales_order_lines_write_restrict_delete ON sales_order_lines;
CREATE POLICY sales_order_lines_write_restrict_delete ON sales_order_lines AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((order_id IN (SELECT id FROM sales_orders WHERE company_id = public.user_company_id())) AND (public.is_super_admin() OR public.has_any_permission(ARRAY['sales.manage','sales.admin','crm.manage','crm.admin'])));

