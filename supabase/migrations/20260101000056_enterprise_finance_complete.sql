-- Hope SecureTrack ERP — Complete Enterprise Finance Platform
-- Fills gaps: dimensions, templates, AR/AP extras, treasury, budgets, costing, tax, FP&A

-- Soft-delete extensions on core tables
ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS profit_center_code VARCHAR(50);
ALTER TABLE cost_centers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE tax_codes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ap_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ap_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ar_receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ar_credit_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_category VARCHAR(60) DEFAULT 'operational';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);
ALTER TABLE fin_business_units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_petty_cash ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_approvals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_approvals ADD COLUMN IF NOT EXISTS approval_number VARCHAR(50);
ALTER TABLE fin_approvals ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE fin_cost_rolls ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_cost_rolls ADD COLUMN IF NOT EXISTS costing_method VARCHAR(40) DEFAULT 'actual';
ALTER TABLE fin_wip ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_intercompany_txns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_cash_forecasts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fin_tax_returns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Account groups
CREATE TABLE IF NOT EXISTS fin_account_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(40) DEFAULT 'asset',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Financial dimensions
CREATE TABLE IF NOT EXISTS fin_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  dimension_type VARCHAR(40) DEFAULT 'custom',
  -- branch|department|project|product|customer|supplier|custom
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fin_dimension_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  dimension_id UUID REFERENCES fin_dimensions(id) ON DELETE CASCADE,
  dimension_code VARCHAR(50),
  value_code VARCHAR(50) NOT NULL,
  value_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, dimension_code, value_code)
);

-- Profit centers (alias view of cost centers type profit)
CREATE TABLE IF NOT EXISTS fin_profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  manager_name VARCHAR(150),
  branch_name VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Journal templates & recurring & batches
CREATE TABLE IF NOT EXISTS fin_journal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  journal_type VARCHAR(40) DEFAULT 'general',
  description TEXT,
  lines_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

CREATE TABLE IF NOT EXISTS fin_recurring_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  template_code VARCHAR(50),
  frequency VARCHAR(30) DEFAULT 'monthly',
  -- daily|weekly|monthly|quarterly|yearly
  next_run_date DATE,
  last_run_date DATE,
  amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_code)
);

CREATE TABLE IF NOT EXISTS fin_posting_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL,
  batch_date DATE DEFAULT CURRENT_DATE,
  journal_count INTEGER DEFAULT 0,
  total_debit DECIMAL(18,2) DEFAULT 0,
  total_credit DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  -- open|posted|cancelled
  posted_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

-- AR extras
CREATE TABLE IF NOT EXISTS fin_ar_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  debit_note_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  invoice_ref VARCHAR(80),
  debit_date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  reason TEXT,
  status VARCHAR(30) DEFAULT 'issued',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, debit_note_number)
);

CREATE TABLE IF NOT EXISTS fin_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  invoice_ref VARCHAR(80),
  total_amount DECIMAL(18,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  start_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_number)
);

CREATE TABLE IF NOT EXISTS fin_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  collection_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  amount_due DECIMAL(18,2) DEFAULT 0,
  amount_collected DECIMAL(18,2) DEFAULT 0,
  collector_name VARCHAR(150),
  collection_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, collection_number)
);

CREATE TABLE IF NOT EXISTS fin_customer_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  statement_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  period_from DATE,
  period_to DATE,
  opening_balance DECIMAL(18,2) DEFAULT 0,
  closing_balance DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'issued',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, statement_number)
);

CREATE TABLE IF NOT EXISTS fin_recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(18,2) DEFAULT 0,
  frequency VARCHAR(30) DEFAULT 'monthly',
  next_invoice_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, schedule_code)
);

-- AP extras
CREATE TABLE IF NOT EXISTS fin_ap_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_note_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  invoice_ref VARCHAR(80),
  credit_date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  reason TEXT,
  status VARCHAR(30) DEFAULT 'issued',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, credit_note_number)
);

CREATE TABLE IF NOT EXISTS fin_ap_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  debit_note_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  invoice_ref VARCHAR(80),
  debit_date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  reason TEXT,
  status VARCHAR(30) DEFAULT 'issued',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, debit_note_number)
);

CREATE TABLE IF NOT EXISTS fin_payment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_number VARCHAR(50) NOT NULL,
  run_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(40) DEFAULT 'eft',
  total_amount DECIMAL(18,2) DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|approved|processed|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, run_number)
);

CREATE TABLE IF NOT EXISTS fin_supplier_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  statement_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  period_from DATE,
  period_to DATE,
  opening_balance DECIMAL(18,2) DEFAULT 0,
  closing_balance DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'received',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, statement_number)
);

CREATE TABLE IF NOT EXISTS fin_supplier_recon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recon_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  recon_date DATE DEFAULT CURRENT_DATE,
  book_balance DECIMAL(18,2) DEFAULT 0,
  statement_balance DECIMAL(18,2) DEFAULT 0,
  difference DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'in_progress',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, recon_number)
);

-- Treasury extended
CREATE TABLE IF NOT EXISTS fin_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  swift_code VARCHAR(20),
  country VARCHAR(80) DEFAULT 'Uganda',
  contact_phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, bank_code)
);

CREATE TABLE IF NOT EXISTS fin_bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  statement_number VARCHAR(50) NOT NULL,
  bank_account_code VARCHAR(50),
  statement_date DATE DEFAULT CURRENT_DATE,
  opening_balance DECIMAL(18,2) DEFAULT 0,
  closing_balance DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'imported',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, statement_number)
);

CREATE TABLE IF NOT EXISTS fin_electronic_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL,
  channel VARCHAR(40) DEFAULT 'eft',
  -- swift|rtgs|ach|eft|mobile_money|cheque
  beneficiary VARCHAR(200),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  payment_date DATE DEFAULT CURRENT_DATE,
  reference VARCHAR(100),
  status VARCHAR(30) DEFAULT 'pending',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, payment_number)
);

CREATE TABLE IF NOT EXISTS fin_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  investment_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  investment_type VARCHAR(40) DEFAULT 'fixed_deposit',
  principal DECIMAL(18,2) DEFAULT 0,
  interest_rate DECIMAL(8,4) DEFAULT 0,
  start_date DATE,
  maturity_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, investment_code)
);

CREATE TABLE IF NOT EXISTS fin_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  loan_code VARCHAR(50) NOT NULL,
  lender_name VARCHAR(200) NOT NULL,
  principal DECIMAL(18,2) DEFAULT 0,
  outstanding DECIMAL(18,2) DEFAULT 0,
  interest_rate DECIMAL(8,4) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, loan_code)
);

CREATE TABLE IF NOT EXISTS fin_letters_of_credit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lc_number VARCHAR(50) NOT NULL,
  beneficiary VARCHAR(200),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  issue_date DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lc_number)
);

CREATE TABLE IF NOT EXISTS fin_guarantees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  guarantee_number VARCHAR(50) NOT NULL,
  beneficiary VARCHAR(200),
  amount DECIMAL(18,2) DEFAULT 0,
  guarantee_type VARCHAR(40) DEFAULT 'performance',
  issue_date DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, guarantee_number)
);

CREATE TABLE IF NOT EXISTS fin_liquidity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  cash_available DECIMAL(18,2) DEFAULT 0,
  undrawn_facilities DECIMAL(18,2) DEFAULT 0,
  short_term_debt DECIMAL(18,2) DEFAULT 0,
  liquidity_ratio DECIMAL(10,4) DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget templates & revisions & variance
CREATE TABLE IF NOT EXISTS fin_budget_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  budget_type VARCHAR(40) DEFAULT 'operational',
  lines_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

CREATE TABLE IF NOT EXISTS fin_budget_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  revision_number VARCHAR(50) NOT NULL,
  budget_code VARCHAR(50),
  revision_date DATE DEFAULT CURRENT_DATE,
  previous_amount DECIMAL(18,2) DEFAULT 0,
  new_amount DECIMAL(18,2) DEFAULT 0,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, revision_number)
);

CREATE TABLE IF NOT EXISTS fin_budget_variance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  variance_code VARCHAR(50) NOT NULL,
  budget_code VARCHAR(50),
  period_label VARCHAR(40),
  budget_amount DECIMAL(18,2) DEFAULT 0,
  actual_amount DECIMAL(18,2) DEFAULT 0,
  variance_amount DECIMAL(18,2) DEFAULT 0,
  variance_pct DECIMAL(8,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, variance_code)
);

-- Forecasting
CREATE TABLE IF NOT EXISTS fin_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  forecast_code VARCHAR(50) NOT NULL,
  forecast_type VARCHAR(40) DEFAULT 'revenue',
  -- revenue|expense|cash|production|payroll|inventory|tax
  period_label VARCHAR(40),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  source VARCHAR(40) DEFAULT 'manual',
  -- manual|ai|system
  confidence_pct DECIMAL(5,2) DEFAULT 70,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, forecast_code)
);

-- Costing methods registry
CREATE TABLE IF NOT EXISTS fin_costing_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  method_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  -- standard|actual|batch|job|abc|process
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, method_code)
);

CREATE TABLE IF NOT EXISTS fin_standard_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cost_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  material_cost DECIMAL(18,2) DEFAULT 0,
  labor_cost DECIMAL(18,2) DEFAULT 0,
  overhead_cost DECIMAL(18,2) DEFAULT 0,
  total_standard DECIMAL(18,2) DEFAULT 0,
  effective_from DATE,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cost_code)
);

CREATE TABLE IF NOT EXISTS fin_cost_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  variance_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255),
  variance_type VARCHAR(40) DEFAULT 'material',
  -- material|labor|overhead|volume|price
  standard_amount DECIMAL(18,2) DEFAULT 0,
  actual_amount DECIMAL(18,2) DEFAULT 0,
  variance_amount DECIMAL(18,2) DEFAULT 0,
  period_label VARCHAR(40),
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, variance_code)
);

-- Tax advanced
CREATE TABLE IF NOT EXISTS fin_tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  country VARCHAR(80) DEFAULT 'Uganda',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS fin_withholding_tax (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wht_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  invoice_ref VARCHAR(80),
  gross_amount DECIMAL(18,2) DEFAULT 0,
  rate_pct DECIMAL(8,4) DEFAULT 6,
  wht_amount DECIMAL(18,2) DEFAULT 0,
  txn_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'posted',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, wht_number)
);

-- Notifications / settings
CREATE TABLE IF NOT EXISTS fin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  category VARCHAR(60) DEFAULT 'general',
  is_read BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB DEFAULT 'null'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS fin_period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lock_code VARCHAR(50) NOT NULL,
  period_name VARCHAR(80) NOT NULL,
  module_scope VARCHAR(40) DEFAULT 'all',
  -- all|gl|ar|ap|bank|assets
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  locked_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'locked',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lock_code)
);

-- Trial balance snapshots
CREATE TABLE IF NOT EXISTS fin_trial_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_code VARCHAR(50) NOT NULL,
  period_label VARCHAR(40),
  account_code VARCHAR(30),
  account_name VARCHAR(255),
  debit DECIMAL(18,2) DEFAULT 0,
  credit DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_tb_company ON fin_trial_balance(company_id, snapshot_code);

-- ============================================================
-- PERMISSIONS (extras)
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Finance FP&A', 'finance.fpa', 'finance', 'Budgeting forecasting analytics'),
  ('Finance Tax Manage', 'finance.tax.manage', 'finance', 'Tax returns and WHT'),
  ('Finance Multi-book', 'finance.multibook', 'finance', 'Multi-book multi-currency')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'finance.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fin_account_groups','fin_dimensions','fin_dimension_values','fin_profit_centers',
    'fin_journal_templates','fin_recurring_journals','fin_posting_batches',
    'fin_ar_debit_notes','fin_payment_plans','fin_collections','fin_customer_statements',
    'fin_recurring_invoices','fin_ap_credit_notes','fin_ap_debit_notes','fin_payment_runs',
    'fin_supplier_statements','fin_supplier_recon','fin_banks','fin_bank_statements',
    'fin_electronic_payments','fin_investments','fin_loans','fin_letters_of_credit',
    'fin_guarantees','fin_liquidity','fin_budget_templates','fin_budget_revisions',
    'fin_budget_variance','fin_forecasts','fin_costing_methods','fin_standard_costs',
    'fin_cost_variances','fin_tax_jurisdictions','fin_withholding_tax','fin_notifications',
    'fin_settings','fin_period_locks','fin_trial_balance'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
        t || '_all', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO fin_account_groups (company_id, code, name, account_type) VALUES
    (cid, 'CA', 'Current Assets', 'asset'),
    (cid, 'NCA', 'Non-Current Assets', 'asset'),
    (cid, 'CL', 'Current Liabilities', 'liability'),
    (cid, 'EQ', 'Equity', 'equity'),
    (cid, 'REV', 'Revenue', 'revenue'),
    (cid, 'COGS', 'Cost of Sales', 'cost_of_sales'),
    (cid, 'OPEX', 'Operating Expenses', 'operating_expense')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fin_dimensions (company_id, code, name, dimension_type) VALUES
    (cid, 'BRANCH', 'Branch', 'branch'),
    (cid, 'DEPT', 'Department', 'department'),
    (cid, 'PROJECT', 'Project', 'project'),
    (cid, 'PRODUCT', 'Product Line', 'product')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fin_profit_centers (company_id, code, name, manager_name) VALUES
    (cid, 'PC-PRINT', 'Secure Print PC', 'Ops Director'),
    (cid, 'PC-SALES', 'Sales PC', 'Sales Manager')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fin_banks (company_id, bank_code, name, swift_code, country) VALUES
    (cid, 'STANBIC', 'Stanbic Bank Uganda', 'SBICUGKX', 'Uganda'),
    (cid, 'CENTENARY', 'Centenary Bank', 'CERBUGKA', 'Uganda')
  ON CONFLICT (company_id, bank_code) DO NOTHING;

  INSERT INTO fin_costing_methods (company_id, method_code, name, is_default, status) VALUES
    (cid, 'STD', 'Standard Costing', false, 'active'),
    (cid, 'ACT', 'Actual Costing', true, 'active'),
    (cid, 'BATCH', 'Batch Costing', false, 'active'),
    (cid, 'JOB', 'Job Costing', false, 'active'),
    (cid, 'ABC', 'Activity Based Costing', false, 'active'),
    (cid, 'PROC', 'Process Costing', false, 'active')
  ON CONFLICT (company_id, method_code) DO NOTHING;

  INSERT INTO fin_budget_templates (company_id, template_code, name, budget_type, status) VALUES
    (cid, 'TPL-OPEX', 'Annual OPEX Template', 'operational', 'active'),
    (cid, 'TPL-CAPEX', 'Capital Budget Template', 'capital', 'active'),
    (cid, 'TPL-PROD', 'Production Budget Template', 'production', 'active')
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO fin_tax_jurisdictions (company_id, code, name, country) VALUES
    (cid, 'UG-URA', 'Uganda Revenue Authority', 'Uganda')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO fin_settings (company_id, setting_key, setting_value, description) VALUES
    (cid, 'base_currency', '"UGX"', 'Base reporting currency'),
    (cid, 'fiscal_year_start_month', '7', 'Fiscal year start month (July)'),
    (cid, 'require_journal_approval', 'true', 'Journals need approval before post'),
    (cid, 'multi_book', 'false', 'Enable multi-book accounting'),
    (cid, 'default_wht_rate', '6', 'Default WHT %')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO fin_journal_templates (company_id, template_code, name, journal_type, description, status) VALUES
    (cid, 'JT-DEPR', 'Monthly Depreciation', 'depreciation', 'Standard FA depreciation JE', 'active'),
    (cid, 'JT-ACCR', 'Month-end Accruals', 'adjustment', 'Accrual template', 'active')
  ON CONFLICT (company_id, template_code) DO NOTHING;

END $$;
