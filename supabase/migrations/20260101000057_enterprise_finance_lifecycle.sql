-- Hope SecureTrack ERP — Finance Lifecycle Extension
-- Inventory valuation · Assets lifecycle · Leases · Payroll GL · Revenue ·
-- Project accounting · Expenses · Close · Posting engine · Compliance

-- ============================================================
-- INVENTORY VALUATION
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_inventory_valuation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  valuation_code VARCHAR(50) NOT NULL,
  method VARCHAR(40) DEFAULT 'weighted_average',
  -- fifo|weighted_average|standard|specific
  period_label VARCHAR(40),
  item_code VARCHAR(80),
  item_name VARCHAR(255),
  quantity DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,6) DEFAULT 0,
  total_value DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, valuation_code)
);

CREATE TABLE IF NOT EXISTS fin_stock_revaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reval_number VARCHAR(50) NOT NULL,
  item_name VARCHAR(255),
  old_unit_cost DECIMAL(18,6) DEFAULT 0,
  new_unit_cost DECIMAL(18,6) DEFAULT 0,
  quantity DECIMAL(18,4) DEFAULT 0,
  reval_amount DECIMAL(18,2) DEFAULT 0,
  reval_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reval_number)
);

CREATE TABLE IF NOT EXISTS fin_inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  adjustment_type VARCHAR(40) DEFAULT 'count',
  -- count|write_off|write_on|damage|theft
  quantity DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,6) DEFAULT 0,
  amount DECIMAL(18,2) DEFAULT 0,
  adjustment_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS fin_production_profitability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  analysis_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  production_order_ref VARCHAR(100),
  revenue DECIMAL(18,2) DEFAULT 0,
  material_cost DECIMAL(18,2) DEFAULT 0,
  labor_cost DECIMAL(18,2) DEFAULT 0,
  machine_cost DECIMAL(18,2) DEFAULT 0,
  packaging_cost DECIMAL(18,2) DEFAULT 0,
  factory_overhead DECIMAL(18,2) DEFAULT 0,
  scrap_cost DECIMAL(18,2) DEFAULT 0,
  total_cost DECIMAL(18,2) DEFAULT 0,
  gross_profit DECIMAL(18,2) DEFAULT 0,
  margin_pct DECIMAL(8,2) DEFAULT 0,
  cost_per_ream DECIMAL(18,4) DEFAULT 0,
  cost_per_box DECIMAL(18,4) DEFAULT 0,
  cost_per_ton DECIMAL(18,4) DEFAULT 0,
  period_label VARCHAR(40),
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, analysis_code)
);

-- ============================================================
-- FIXED ASSETS LIFECYCLE EXTRAS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_asset_capitalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cap_number VARCHAR(50) NOT NULL,
  asset_code VARCHAR(50),
  asset_name VARCHAR(255) NOT NULL,
  amount DECIMAL(18,2) DEFAULT 0,
  cap_date DATE DEFAULT CURRENT_DATE,
  source_ref VARCHAR(100),
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cap_number)
);

CREATE TABLE IF NOT EXISTS fin_asset_revaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reval_number VARCHAR(50) NOT NULL,
  asset_code VARCHAR(50),
  old_value DECIMAL(18,2) DEFAULT 0,
  new_value DECIMAL(18,2) DEFAULT 0,
  reval_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reval_number)
);

CREATE TABLE IF NOT EXISTS fin_asset_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(50) NOT NULL,
  asset_code VARCHAR(50),
  from_location VARCHAR(150),
  to_location VARCHAR(150),
  from_cost_center VARCHAR(80),
  to_cost_center VARCHAR(80),
  transfer_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'completed',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS fin_asset_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  disposal_number VARCHAR(50) NOT NULL,
  asset_code VARCHAR(50),
  disposal_date DATE DEFAULT CURRENT_DATE,
  disposal_type VARCHAR(40) DEFAULT 'sale',
  -- sale|scrap|donation|write_off
  proceeds DECIMAL(18,2) DEFAULT 0,
  book_value DECIMAL(18,2) DEFAULT 0,
  gain_loss DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, disposal_number)
);

CREATE TABLE IF NOT EXISTS fin_asset_impairments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  impairment_number VARCHAR(50) NOT NULL,
  asset_code VARCHAR(50),
  impairment_date DATE DEFAULT CURRENT_DATE,
  carrying_amount DECIMAL(18,2) DEFAULT 0,
  recoverable_amount DECIMAL(18,2) DEFAULT 0,
  impairment_loss DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, impairment_number)
);

CREATE TABLE IF NOT EXISTS fin_cip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cip_number VARCHAR(50) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  cumulative_cost DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  -- open|capitalized|cancelled
  expected_completion DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cip_number)
);

CREATE TABLE IF NOT EXISTS fin_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lease_number VARCHAR(50) NOT NULL,
  lessor_name VARCHAR(200),
  asset_description VARCHAR(255),
  lease_type VARCHAR(40) DEFAULT 'operating',
  -- operating|finance|ifrs16
  commencement_date DATE,
  end_date DATE,
  monthly_payment DECIMAL(18,2) DEFAULT 0,
  liability_balance DECIMAL(18,2) DEFAULT 0,
  rou_asset_value DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, lease_number)
);

-- ============================================================
-- PAYROLL ACCOUNTING
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_payroll_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  journal_number VARCHAR(50) NOT NULL,
  period_label VARCHAR(40) NOT NULL,
  gross_pay DECIMAL(18,2) DEFAULT 0,
  paye DECIMAL(18,2) DEFAULT 0,
  nssf_employee DECIMAL(18,2) DEFAULT 0,
  nssf_employer DECIMAL(18,2) DEFAULT 0,
  pension DECIMAL(18,2) DEFAULT 0,
  loans_deducted DECIMAL(18,2) DEFAULT 0,
  overtime DECIMAL(18,2) DEFAULT 0,
  benefits DECIMAL(18,2) DEFAULT 0,
  leave_liability DECIMAL(18,2) DEFAULT 0,
  net_pay DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  gl_journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, journal_number)
);

-- ============================================================
-- TAX EXTENSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_tax_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_code VARCHAR(50) NOT NULL,
  tax_type VARCHAR(40) NOT NULL,
  -- vat|wht|paye|corporate|excise|import|nssf
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'upcoming',
  -- upcoming|filed|overdue|paid
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, event_code)
);

CREATE TABLE IF NOT EXISTS fin_excise_duty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  duty_number VARCHAR(50) NOT NULL,
  product_name VARCHAR(255),
  taxable_amount DECIMAL(18,2) DEFAULT 0,
  rate_pct DECIMAL(8,4) DEFAULT 0,
  duty_amount DECIMAL(18,2) DEFAULT 0,
  period_label VARCHAR(40),
  status VARCHAR(30) DEFAULT 'draft',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, duty_number)
);

CREATE TABLE IF NOT EXISTS fin_import_duty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(200),
  hs_code VARCHAR(40),
  cif_value DECIMAL(18,2) DEFAULT 0,
  duty_amount DECIMAL(18,2) DEFAULT 0,
  vat_amount DECIMAL(18,2) DEFAULT 0,
  entry_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'posted',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, entry_number)
);

CREATE TABLE IF NOT EXISTS fin_corporate_tax (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assessment_code VARCHAR(50) NOT NULL,
  tax_year INTEGER NOT NULL,
  taxable_profit DECIMAL(18,2) DEFAULT 0,
  tax_rate_pct DECIMAL(8,4) DEFAULT 30,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, assessment_code)
);

-- ============================================================
-- REVENUE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_deferred_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deferral_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  description TEXT,
  total_amount DECIMAL(18,2) DEFAULT 0,
  recognized_amount DECIMAL(18,2) DEFAULT 0,
  remaining_amount DECIMAL(18,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, deferral_code)
);

CREATE TABLE IF NOT EXISTS fin_subscription_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  product_name VARCHAR(200),
  mrr DECIMAL(18,2) DEFAULT 0,
  billing_cycle VARCHAR(30) DEFAULT 'monthly',
  start_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, subscription_code)
);

CREATE TABLE IF NOT EXISTS fin_revenue_recognition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recognition_code VARCHAR(50) NOT NULL,
  source_type VARCHAR(40) DEFAULT 'invoice',
  -- invoice|subscription|milestone|contract|export|government
  source_ref VARCHAR(100),
  amount DECIMAL(18,2) DEFAULT 0,
  recognition_date DATE DEFAULT CURRENT_DATE,
  method VARCHAR(40) DEFAULT 'point_in_time',
  -- point_in_time|over_time|percent_complete
  status VARCHAR(30) DEFAULT 'recognized',
  journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, recognition_code)
);

CREATE TABLE IF NOT EXISTS fin_government_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  agency_name VARCHAR(200) NOT NULL,
  contract_value DECIMAL(18,2) DEFAULT 0,
  billed_to_date DECIMAL(18,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, contract_number)
);

CREATE TABLE IF NOT EXISTS fin_export_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  export_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  country VARCHAR(80),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  export_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'invoiced',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, export_number)
);

-- ============================================================
-- PROJECT ACCOUNTING
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cost_number VARCHAR(50) NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  cost_type VARCHAR(40) DEFAULT 'labor',
  -- labor|materials|expenses|overhead|subcontractor
  amount DECIMAL(18,2) DEFAULT 0,
  cost_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  status VARCHAR(30) DEFAULT 'posted',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cost_number)
);

CREATE TABLE IF NOT EXISTS fin_project_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  billing_number VARCHAR(50) NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  billing_type VARCHAR(40) DEFAULT 'milestone',
  -- time|expense|milestone|fixed
  amount DECIMAL(18,2) DEFAULT 0,
  billing_date DATE DEFAULT CURRENT_DATE,
  customer_name VARCHAR(200),
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, billing_number)
);

CREATE TABLE IF NOT EXISTS fin_project_profitability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  analysis_code VARCHAR(50) NOT NULL,
  project_code VARCHAR(50) NOT NULL,
  project_name VARCHAR(255),
  revenue DECIMAL(18,2) DEFAULT 0,
  cost DECIMAL(18,2) DEFAULT 0,
  profit DECIMAL(18,2) DEFAULT 0,
  margin_pct DECIMAL(8,2) DEFAULT 0,
  period_label VARCHAR(40),
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, analysis_code)
);

-- ============================================================
-- EXPENSE MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_number VARCHAR(50) NOT NULL,
  claimant_name VARCHAR(200) NOT NULL,
  claim_date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(40) DEFAULT 'travel',
  -- travel|fuel|accommodation|meals|mileage|entertainment|other
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  receipt_url TEXT,
  status VARCHAR(30) DEFAULT 'submitted',
  -- draft|submitted|approved|rejected|paid|posted
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  project_code VARCHAR(50),
  cost_center VARCHAR(80),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, claim_number)
);

-- ============================================================
-- FINANCIAL CLOSE
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_close_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checklist_code VARCHAR(50) NOT NULL,
  close_type VARCHAR(40) DEFAULT 'month_end',
  -- month_end|year_end|quarter
  period_label VARCHAR(40) NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(150),
  is_done BOOLEAN DEFAULT false,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, checklist_code)
);

CREATE TABLE IF NOT EXISTS fin_close_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(50) NOT NULL,
  period_label VARCHAR(40),
  description TEXT NOT NULL,
  amount DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS fin_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recon_number VARCHAR(50) NOT NULL,
  recon_type VARCHAR(40) DEFAULT 'gl',
  -- gl|bank|ar|ap|intercompany|inventory
  period_label VARCHAR(40),
  balance_system DECIMAL(18,2) DEFAULT 0,
  balance_external DECIMAL(18,2) DEFAULT 0,
  difference DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'in_progress',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, recon_number)
);

-- ============================================================
-- CONSOLIDATION / FX
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_currency_translation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  translation_code VARCHAR(50) NOT NULL,
  entity_name VARCHAR(150),
  from_currency VARCHAR(10) DEFAULT 'USD',
  to_currency VARCHAR(10) DEFAULT 'UGX',
  rate DECIMAL(18,8) DEFAULT 1,
  period_label VARCHAR(40),
  translation_gain_loss DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'posted',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, translation_code)
);

CREATE TABLE IF NOT EXISTS fin_group_consolidation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  consolidation_code VARCHAR(50) NOT NULL,
  period_label VARCHAR(40) NOT NULL,
  group_revenue DECIMAL(18,2) DEFAULT 0,
  group_expenses DECIMAL(18,2) DEFAULT 0,
  group_net_profit DECIMAL(18,2) DEFAULT 0,
  eliminations_total DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, consolidation_code)
);

-- ============================================================
-- COMPLIANCE / CONTROLS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_internal_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  control_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  control_type VARCHAR(40) DEFAULT 'preventive',
  -- preventive|detective|corrective
  process_area VARCHAR(80),
  owner_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'active',
  last_tested DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, control_code)
);

CREATE TABLE IF NOT EXISTS fin_sod_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  conflict_a VARCHAR(100) NOT NULL,
  conflict_b VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'high',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS fin_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(80) DEFAULT 'accounting',
  version_label VARCHAR(40) DEFAULT '1.0',
  effective_date DATE,
  file_url TEXT,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, policy_code)
);

CREATE TABLE IF NOT EXISTS fin_risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  risk_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(80) DEFAULT 'financial',
  probability VARCHAR(20) DEFAULT 'medium',
  impact VARCHAR(20) DEFAULT 'medium',
  mitigation TEXT,
  owner_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, risk_code)
);

-- ============================================================
-- ACCOUNTING ENGINE — POSTING RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_posting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  -- sales_invoice|customer_payment|purchase_invoice|goods_receipt|production_complete|
  -- material_issue|payroll_post|asset_purchase|asset_depreciation|dispatch|expense_claim
  debit_account_code VARCHAR(30),
  credit_account_code VARCHAR(30),
  tax_account_code VARCHAR(30),
  ledger_book VARCHAR(40) DEFAULT 'primary',
  -- primary|ifrs|tax|management
  accounting_basis VARCHAR(20) DEFAULT 'accrual',
  -- accrual|cash
  is_active BOOLEAN DEFAULT true,
  auto_post BOOLEAN DEFAULT true,
  description TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS fin_auto_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  auto_number VARCHAR(50) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  source_module VARCHAR(50),
  source_ref VARCHAR(100),
  rule_code VARCHAR(50),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'posted',
  -- draft|posted|reversed|failed
  gl_journal_id UUID REFERENCES gl_journals(id),
  payload JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, auto_number)
);

CREATE INDEX IF NOT EXISTS idx_fin_auto_journals_event ON fin_auto_journals(company_id, event_type, created_at DESC);

-- ============================================================
-- KPI SNAPSHOTS ENHANCEMENT
-- ============================================================
ALTER TABLE fin_kpi_snapshots
  ADD COLUMN IF NOT EXISTS revenue_today DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expenses_today DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_ream DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_box DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_ton DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_position DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_invoices DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS factory_profit DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_profit DECIMAL(18,2) DEFAULT 0;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fin_inventory_valuation','fin_stock_revaluations','fin_inventory_adjustments',
    'fin_production_profitability','fin_asset_capitalizations','fin_asset_revaluations',
    'fin_asset_transfers','fin_asset_disposals','fin_asset_impairments','fin_cip','fin_leases',
    'fin_payroll_journals','fin_tax_calendar','fin_excise_duty','fin_import_duty','fin_corporate_tax',
    'fin_deferred_revenue','fin_subscription_revenue','fin_revenue_recognition',
    'fin_government_contracts','fin_export_revenue','fin_project_costs','fin_project_billing',
    'fin_project_profitability','fin_expense_claims','fin_close_checklists','fin_close_adjustments',
    'fin_reconciliations','fin_currency_translation','fin_group_consolidation',
    'fin_internal_controls','fin_sod_rules','fin_policies','fin_risk_register',
    'fin_posting_rules','fin_auto_journals'
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

  INSERT INTO fin_posting_rules (company_id, rule_code, name, event_type, debit_account_code, credit_account_code, tax_account_code, description, auto_post) VALUES
    (cid, 'PR-SINV', 'Sales Invoice', 'sales_invoice', '1200', '4000', '2100', 'DR AR / CR Revenue / CR Tax', true),
    (cid, 'PR-CPAY', 'Customer Payment', 'customer_payment', '1100', '1200', NULL, 'DR Bank / CR AR', true),
    (cid, 'PR-PINV', 'Purchase Invoice', 'purchase_invoice', '5000', '2000', '1300', 'DR Expense / CR AP / DR Input Tax', true),
    (cid, 'PR-GRN', 'Goods Receipt', 'goods_receipt', '1400', '2010', NULL, 'DR Inventory / CR GRNI', true),
    (cid, 'PR-PROD', 'Production Complete', 'production_complete', '1410', '1450', NULL, 'DR FG / CR WIP', true),
    (cid, 'PR-ISSUE', 'Material Issue', 'material_issue', '1450', '1400', NULL, 'DR WIP / CR Inventory', true),
    (cid, 'PR-PAY', 'Payroll Posting', 'payroll_post', '6100', '2200', NULL, 'DR Payroll Expense / CR Payroll Liability', true),
    (cid, 'PR-ASSET', 'Asset Purchase', 'asset_purchase', '1500', '2000', NULL, 'DR Fixed Assets / CR AP', true),
    (cid, 'PR-DEPR', 'Asset Depreciation', 'asset_depreciation', '6200', '1510', NULL, 'DR Deprec Exp / CR Accum Deprec', true),
    (cid, 'PR-DISP', 'Dispatch COGS', 'dispatch', '5000', '1410', NULL, 'DR COGS / CR FG Inventory', true),
    (cid, 'PR-EXP', 'Expense Claim', 'expense_claim', '6300', '2000', NULL, 'DR Expense / CR AP/Payable', true)
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO fin_sod_rules (company_id, rule_code, title, conflict_a, conflict_b, severity, status) VALUES
    (cid, 'SOD-01', 'Create vs Approve AP Invoice', 'ap_invoice_create', 'ap_invoice_approve', 'high', 'active'),
    (cid, 'SOD-02', 'Create vs Approve Payment', 'payment_create', 'payment_approve', 'critical', 'active'),
    (cid, 'SOD-03', 'Journal Create vs Post', 'journal_create', 'journal_post', 'high', 'active')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO fin_close_checklists (company_id, checklist_code, close_type, period_label, task_name, owner_name, sort_order, status) VALUES
    (cid, 'CL-ME-01', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Post all subledger journals', 'GL Accountant', 1, 'open'),
    (cid, 'CL-ME-02', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Bank reconciliations complete', 'Treasury', 2, 'open'),
    (cid, 'CL-ME-03', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'AR/AP aging review', 'Controller', 3, 'open'),
    (cid, 'CL-ME-04', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Depreciation run', 'Fixed Assets', 4, 'open'),
    (cid, 'CL-ME-05', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Inventory valuation', 'Cost Accountant', 5, 'open'),
    (cid, 'CL-ME-06', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Tax provisions', 'Tax Lead', 6, 'open'),
    (cid, 'CL-ME-07', 'month_end', to_char(CURRENT_DATE, 'YYYY-MM'), 'Management review & lock period', 'CFO', 7, 'open')
  ON CONFLICT (company_id, checklist_code) DO NOTHING;

  INSERT INTO fin_tax_calendar (company_id, event_code, tax_type, title, due_date, status) VALUES
    (cid, 'TAX-VAT-M', 'vat', 'Monthly VAT return', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '14 days')::date, 'upcoming'),
    (cid, 'TAX-PAYE-M', 'paye', 'Monthly PAYE filing', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '14 days')::date, 'upcoming'),
    (cid, 'TAX-WHT-M', 'wht', 'Monthly WHT return', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '14 days')::date, 'upcoming')
  ON CONFLICT (company_id, event_code) DO NOTHING;

  INSERT INTO fin_internal_controls (company_id, control_code, title, control_type, process_area, owner_name, status) VALUES
    (cid, 'IC-01', 'Three-way match on AP', 'preventive', 'accounts_payable', 'AP Manager', 'active'),
    (cid, 'IC-02', 'Bank recon dual review', 'detective', 'treasury', 'Treasury Lead', 'active'),
    (cid, 'IC-03', 'Period lock after close', 'preventive', 'general_ledger', 'Controller', 'active')
  ON CONFLICT (company_id, control_code) DO NOTHING;

END $$;
