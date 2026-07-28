-- Hope Design Group Ltd — Enterprise Finance & Accounting
-- COA · GL · AR/AP · Cash & Bank · Fixed Assets · Budget · Tax · Cost centres · Periods

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE account_type AS ENUM (
  'asset','liability','equity','revenue','cost_of_sales',
  'operating_expense','admin_expense','manufacturing_overhead',
  'financial_income','financial_expense','tax','memorandum'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE journal_status AS ENUM (
  'draft','pending_approval','posted','reversed','void'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE journal_type AS ENUM (
  'sales','purchase','cash','bank','payroll','inventory',
  'manufacturing','depreciation','adjustment','closing',
  'intercompany','general'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE fiscal_period_status AS ENUM (
  'open','soft_close','closed','locked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ap_invoice_status AS ENUM (
  'draft','pending_approval','approved','partially_paid','paid','void','disputed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE asset_status AS ENUM (
  'draft','active','under_maintenance','idle','disposed','retired'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE depreciation_method AS ENUM (
  'straight_line','reducing_balance','units_of_production','custom'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE budget_status AS ENUM (
  'draft','submitted','approved','locked','revised','closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE bank_txn_type AS ENUM (
  'deposit','withdrawal','transfer','fee','interest','mobile_money','cheque','adjustment'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- COST / PROFIT CENTRES
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  center_type VARCHAR(30) DEFAULT 'cost', -- cost | profit | both
  department VARCHAR(100),
  branch_code VARCHAR(50),
  manager_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES chart_of_accounts(id),
  level INTEGER DEFAULT 1,
  is_header BOOLEAN DEFAULT false,
  is_postable BOOLEAN DEFAULT true,
  currency VARCHAR(10) DEFAULT 'UGX',
  cost_center_id UUID REFERENCES cost_centers(id),
  reporting_group VARCHAR(100),
  normal_balance VARCHAR(10) DEFAULT 'debit', -- debit | credit
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(company_id, account_type);

-- ============================================================
-- FISCAL YEARS & PERIODS
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  status fiscal_period_status DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL,
  name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status fiscal_period_status DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES user_profiles(id),
  UNIQUE(fiscal_year_id, period_number)
);

-- ============================================================
-- CURRENCIES & FX RATES
-- ============================================================
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10),
  decimal_places INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_currency VARCHAR(10) NOT NULL REFERENCES currencies(code),
  to_currency VARCHAR(10) NOT NULL REFERENCES currencies(code),
  rate DECIMAL(18,8) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, from_currency, to_currency, rate_date)
);

-- ============================================================
-- TAX CODES (Uganda-ready)
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  tax_type VARCHAR(30) NOT NULL, -- vat | wht | paye | lst | nssf | stamp | other
  rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  is_recoverable BOOLEAN DEFAULT true,
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- GENERAL LEDGER JOURNALS
-- ============================================================
CREATE TABLE IF NOT EXISTS gl_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  journal_number VARCHAR(50) NOT NULL,
  journal_type journal_type DEFAULT 'general',
  journal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fiscal_period_id UUID REFERENCES fiscal_periods(id),
  currency VARCHAR(10) DEFAULT 'UGX',
  exchange_rate DECIMAL(18,8) DEFAULT 1,
  description TEXT,
  reference VARCHAR(100),
  source_module VARCHAR(50),
  source_document_id UUID,
  status journal_status DEFAULT 'draft',
  total_debit DECIMAL(18,2) DEFAULT 0,
  total_credit DECIMAL(18,2) DEFAULT 0,
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  reversed_journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, journal_number)
);

CREATE TABLE IF NOT EXISTS gl_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES gl_journals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL DEFAULT 1,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  description TEXT,
  debit DECIMAL(18,2) DEFAULT 0,
  credit DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  amount_base DECIMAL(18,2) DEFAULT 0,
  project_code VARCHAR(50),
  branch_code VARCHAR(50),
  customer_id UUID REFERENCES customers(id),
  supplier_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gl_journals_date ON gl_journals(company_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_gl_journals_status ON gl_journals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_gl_lines_account ON gl_journal_lines(account_id);

-- ============================================================
-- SUPPLIERS & ACCOUNTS PAYABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  tin_vat VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  currency VARCHAR(10) DEFAULT 'UGX',
  bank_name VARCHAR(150),
  bank_account VARCHAR(100),
  mobile_money VARCHAR(50),
  wht_applicable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS ap_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  supplier_invoice_ref VARCHAR(100),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  wht_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  amount_paid DECIMAL(18,2) DEFAULT 0,
  status ap_invoice_status DEFAULT 'draft',
  description TEXT,
  three_way_matched BOOLEAN DEFAULT false,
  gl_journal_id UUID REFERENCES gl_journals(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS ap_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  ap_invoice_id UUID REFERENCES ap_invoices(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  reference VARCHAR(100),
  bank_account_id UUID,
  status VARCHAR(30) DEFAULT 'posted',
  gl_journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, payment_number)
);

-- ============================================================
-- AR RECEIPTS (extends existing invoices)
-- ============================================================
CREATE TABLE IF NOT EXISTS ar_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  reference VARCHAR(100),
  bank_account_id UUID,
  unallocated DECIMAL(18,2) DEFAULT 0,
  gl_journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS ar_credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_note_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  credit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  reason TEXT,
  status VARCHAR(30) DEFAULT 'issued',
  gl_journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, credit_note_number)
);

-- ============================================================
-- CASH & BANK
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  bank_name VARCHAR(150),
  account_number VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'UGX',
  account_type VARCHAR(30) DEFAULT 'current', -- current | savings | mobile_money | petty_cash | cash
  gl_account_id UUID REFERENCES chart_of_accounts(id),
  opening_balance DECIMAL(18,2) DEFAULT 0,
  current_balance DECIMAL(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  branch VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, account_code)
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  txn_type bank_txn_type DEFAULT 'deposit',
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  reference VARCHAR(100),
  counterparty VARCHAR(255),
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMPTZ,
  gl_journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  statement_date DATE NOT NULL,
  statement_balance DECIMAL(18,2) NOT NULL,
  book_balance DECIMAL(18,2) NOT NULL,
  difference DECIMAL(18,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'in_progress',
  notes TEXT,
  completed_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK from ap_payments / ar_receipts bank_account_id
DO $$ BEGIN
  ALTER TABLE ap_payments
    ADD CONSTRAINT ap_payments_bank_fk
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ar_receipts
    ADD CONSTRAINT ar_receipts_bank_fk
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- FIXED ASSETS & DEPRECIATION
-- ============================================================
CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_code VARCHAR(50) NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  barcode VARCHAR(100),
  location VARCHAR(150),
  custodian_id UUID REFERENCES user_profiles(id),
  supplier_id UUID REFERENCES suppliers(id),
  purchase_date DATE,
  acquisition_cost DECIMAL(18,2) DEFAULT 0,
  residual_value DECIMAL(18,2) DEFAULT 0,
  useful_life_months INTEGER DEFAULT 60,
  depreciation_method depreciation_method DEFAULT 'straight_line',
  accumulated_depreciation DECIMAL(18,2) DEFAULT 0,
  book_value DECIMAL(18,2) DEFAULT 0,
  status asset_status DEFAULT 'draft',
  warranty_expiry DATE,
  insurance_policy VARCHAR(100),
  insurance_expiry DATE,
  gl_asset_account_id UUID REFERENCES chart_of_accounts(id),
  gl_depr_account_id UUID REFERENCES chart_of_accounts(id),
  gl_accum_account_id UUID REFERENCES chart_of_accounts(id),
  disposal_date DATE,
  disposal_amount DECIMAL(18,2),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, asset_code)
);

CREATE TABLE IF NOT EXISTS depreciation_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_id UUID REFERENCES fiscal_periods(id),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(18,2) NOT NULL,
  method depreciation_method,
  gl_journal_id UUID REFERENCES gl_journals(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  budget_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  budget_type VARCHAR(50) DEFAULT 'operational',
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  currency VARCHAR(10) DEFAULT 'UGX',
  total_amount DECIMAL(18,2) DEFAULT 0,
  status budget_status DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, budget_code, version)
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES chart_of_accounts(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  period_id UUID REFERENCES fiscal_periods(id),
  description TEXT,
  amount DECIMAL(18,2) DEFAULT 0,
  committed DECIMAL(18,2) DEFAULT 0,
  actual DECIMAL(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TREASURY (loans / facilities — lightweight)
-- ============================================================
CREATE TABLE IF NOT EXISTS treasury_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facility_code VARCHAR(50) NOT NULL,
  facility_type VARCHAR(50) DEFAULT 'loan', -- loan | overdraft | investment | facility
  counterparty VARCHAR(255),
  principal DECIMAL(18,2) DEFAULT 0,
  outstanding DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  interest_rate DECIMAL(8,4) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, facility_code)
);

-- ============================================================
-- FINANCE AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT,
  metric_value DECIMAL(18,4),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: currencies
-- ============================================================
INSERT INTO currencies (code, name, symbol) VALUES
  ('UGX', 'Ugandan Shilling', 'USh'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('KES', 'Kenyan Shilling', 'KSh'),
  ('GBP', 'British Pound', '£')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED: cost centres
-- ============================================================
INSERT INTO cost_centers (company_id, code, name, center_type, department) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'CC-PROD', 'Production', 'cost', 'Manufacturing'),
  ('a0000000-0000-4000-8000-000000000001', 'CC-WH', 'Warehouse', 'cost', 'Warehouse'),
  ('a0000000-0000-4000-8000-000000000001', 'CC-SALES', 'Sales', 'profit', 'Sales'),
  ('a0000000-0000-4000-8000-000000000001', 'CC-ADMIN', 'Administration', 'cost', 'Admin'),
  ('a0000000-0000-4000-8000-000000000001', 'CC-FIN', 'Finance', 'cost', 'Finance')
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================================
-- SEED: Chart of Accounts (Hope Design standard)
-- ============================================================
INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, is_header, is_postable, normal_balance, reporting_group, level) VALUES
  ('a0000000-0000-4000-8000-000000000001', '1000', 'ASSETS', 'asset', true, false, 'debit', 'Balance Sheet', 1),
  ('a0000000-0000-4000-8000-000000000001', '1100', 'Current Assets', 'asset', true, false, 'debit', 'Balance Sheet', 2),
  ('a0000000-0000-4000-8000-000000000001', '1110', 'Cash on Hand', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1120', 'Bank - Current Account', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1130', 'Mobile Money', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1140', 'Accounts Receivable', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1150', 'Inventory - Raw Materials', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1160', 'Inventory - WIP', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1170', 'Inventory - Finished Goods', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1200', 'Non-Current Assets', 'asset', true, false, 'debit', 'Balance Sheet', 2),
  ('a0000000-0000-4000-8000-000000000001', '1210', 'Plant & Machinery', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1220', 'Motor Vehicles', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1230', 'Furniture & Equipment', 'asset', false, true, 'debit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '1240', 'Accumulated Depreciation', 'asset', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2000', 'LIABILITIES', 'liability', true, false, 'credit', 'Balance Sheet', 1),
  ('a0000000-0000-4000-8000-000000000001', '2110', 'Accounts Payable', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2120', 'VAT Payable', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2130', 'WHT Payable', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2140', 'PAYE Payable', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2150', 'NSSF Payable', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2160', 'Accrued Expenses', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '2200', 'Bank Loans', 'liability', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '3000', 'EQUITY', 'equity', true, false, 'credit', 'Balance Sheet', 1),
  ('a0000000-0000-4000-8000-000000000001', '3100', 'Share Capital', 'equity', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '3200', 'Retained Earnings', 'equity', false, true, 'credit', 'Balance Sheet', 3),
  ('a0000000-0000-4000-8000-000000000001', '4000', 'REVENUE', 'revenue', true, false, 'credit', 'P&L', 1),
  ('a0000000-0000-4000-8000-000000000001', '4100', 'Sales - Security Printing', 'revenue', false, true, 'credit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '4200', 'Sales - Paper Products', 'revenue', false, true, 'credit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '4300', 'Sales - Engineering Services', 'revenue', false, true, 'credit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '4400', 'Other Income', 'financial_income', false, true, 'credit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '5000', 'COST OF SALES', 'cost_of_sales', true, false, 'debit', 'P&L', 1),
  ('a0000000-0000-4000-8000-000000000001', '5100', 'Raw Materials Consumed', 'cost_of_sales', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '5200', 'Direct Labour', 'cost_of_sales', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '5300', 'Manufacturing Overhead', 'manufacturing_overhead', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6000', 'OPERATING EXPENSES', 'operating_expense', true, false, 'debit', 'P&L', 1),
  ('a0000000-0000-4000-8000-000000000001', '6100', 'Salaries & Wages', 'operating_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6200', 'Rent & Utilities', 'operating_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6300', 'Transport & Logistics', 'operating_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6400', 'Marketing & Sales', 'operating_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6500', 'Depreciation Expense', 'operating_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6600', 'Admin Expenses', 'admin_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6700', 'Bank Charges & Interest', 'financial_expense', false, true, 'debit', 'P&L', 3),
  ('a0000000-0000-4000-8000-000000000001', '6800', 'Tax Expense', 'tax', false, true, 'debit', 'P&L', 3)
ON CONFLICT (company_id, account_code) DO NOTHING;

-- ============================================================
-- SEED: fiscal year FY2026
-- ============================================================
INSERT INTO fiscal_years (id, company_id, name, start_date, end_date, is_current, status)
VALUES (
  'f0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'FY2026',
  '2026-01-01',
  '2026-12-31',
  true,
  'open'
) ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO fiscal_periods (company_id, fiscal_year_id, period_number, name, start_date, end_date, status)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  m,
  to_char(make_date(2026, m, 1), 'Mon YYYY'),
  make_date(2026, m, 1),
  (make_date(2026, m, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date,
  CASE WHEN m < 7 THEN 'closed'::fiscal_period_status ELSE 'open'::fiscal_period_status END
FROM generate_series(1, 12) AS m
ON CONFLICT (fiscal_year_id, period_number) DO NOTHING;

-- ============================================================
-- SEED: tax codes (Uganda)
-- ============================================================
INSERT INTO tax_codes (company_id, code, name, tax_type, rate, is_recoverable) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'VAT18', 'VAT Standard 18%', 'vat', 18.0000, true),
  ('a0000000-0000-4000-8000-000000000001', 'VAT0', 'VAT Zero-rated', 'vat', 0.0000, true),
  ('a0000000-0000-4000-8000-000000000001', 'WHT6', 'Withholding Tax 6%', 'wht', 6.0000, false),
  ('a0000000-0000-4000-8000-000000000001', 'WHT15', 'Withholding Tax 15%', 'wht', 15.0000, false),
  ('a0000000-0000-4000-8000-000000000001', 'NSSF10', 'NSSF Employee 5% + Employer 10%', 'nssf', 15.0000, false),
  ('a0000000-0000-4000-8000-000000000001', 'PAYE', 'PAYE (progressive)', 'paye', 0.0000, false),
  ('a0000000-0000-4000-8000-000000000001', 'LST', 'Local Service Tax', 'lst', 0.0000, false)
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================================
-- SEED: bank accounts
-- ============================================================
INSERT INTO bank_accounts (company_id, account_code, account_name, bank_name, account_number, currency, account_type, current_balance)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'BNK-MAIN',
  'Stanbic Current UGX',
  'Stanbic Bank Uganda',
  '90300XXXXXX',
  'UGX',
  'current',
  125000000
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = 'BNK-MAIN'
);

INSERT INTO bank_accounts (company_id, account_code, account_name, bank_name, currency, account_type, current_balance)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'MM-MTN',
  'MTN Mobile Money',
  'MTN Uganda',
  'UGX',
  'mobile_money',
  8500000
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = 'MM-MTN'
);

INSERT INTO bank_accounts (company_id, account_code, account_name, currency, account_type, current_balance)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'CASH-PETTY',
  'Petty Cash',
  'UGX',
  'petty_cash',
  500000
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = 'CASH-PETTY'
);

-- Link GL accounts for bank
UPDATE bank_accounts ba
SET gl_account_id = coa.id
FROM chart_of_accounts coa
WHERE ba.company_id = coa.company_id
  AND ba.account_code = 'BNK-MAIN'
  AND coa.account_code = '1120'
  AND ba.gl_account_id IS NULL;

UPDATE bank_accounts ba
SET gl_account_id = coa.id
FROM chart_of_accounts coa
WHERE ba.company_id = coa.company_id
  AND ba.account_code = 'MM-MTN'
  AND coa.account_code = '1130'
  AND ba.gl_account_id IS NULL;

UPDATE bank_accounts ba
SET gl_account_id = coa.id
FROM chart_of_accounts coa
WHERE ba.company_id = coa.company_id
  AND ba.account_code = 'CASH-PETTY'
  AND coa.account_code = '1110'
  AND ba.gl_account_id IS NULL;

-- ============================================================
-- SEED: sample supplier + AP
-- ============================================================
INSERT INTO suppliers (company_id, code, name, tin_vat, payment_terms_days, currency)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'SUP-PULP01',
  'East Africa Pulp Supplies Ltd',
  '1000123456',
  30,
  'UGX'
) ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================================
-- SEED: sample journal (balanced)
-- ============================================================
DO $$
DECLARE
  v_j UUID;
  v_ar UUID;
  v_rev UUID;
  v_vat UUID;
BEGIN
  SELECT id INTO v_ar FROM chart_of_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = '1140';
  SELECT id INTO v_rev FROM chart_of_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = '4200';
  SELECT id INTO v_vat FROM chart_of_accounts WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND account_code = '2120';

  IF v_ar IS NULL OR EXISTS (SELECT 1 FROM gl_journals WHERE journal_number = 'JV-2026-0001') THEN
    RETURN;
  END IF;

  INSERT INTO gl_journals (
    company_id, journal_number, journal_type, journal_date, description,
    reference, source_module, status, total_debit, total_credit, posted_at
  ) VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'JV-2026-0001',
    'sales',
    CURRENT_DATE,
    'Sample sales invoice posting — Premium A4',
    'INV-SAMPLE',
    'sales',
    'posted',
    1180000,
    1180000,
    NOW()
  ) RETURNING id INTO v_j;

  INSERT INTO gl_journal_lines (journal_id, company_id, line_number, account_id, description, debit, credit, amount_base) VALUES
    (v_j, 'a0000000-0000-4000-8000-000000000001', 1, v_ar, 'AR — customer invoice', 1180000, 0, 1180000),
    (v_j, 'a0000000-0000-4000-8000-000000000001', 2, v_rev, 'Sales — paper products', 0, 1000000, 1000000),
    (v_j, 'a0000000-0000-4000-8000-000000000001', 3, v_vat, 'VAT 18%', 0, 180000, 180000);
END $$;

-- ============================================================
-- SEED: finance insights
-- ============================================================
INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'cost_variance',
    'high',
    'Production costs for Premium A4 increased 11%',
    'Gross margin is projected to decrease by 3% unless selling prices or procurement costs are adjusted. Review pulp supplier contracts and energy overhead allocation.',
    11.0
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'cash_forecast',
    'medium',
    'Working capital tightening next 30 days',
    'Large AP invoices due mid-month and delayed AR collections may compress cash. Prioritise collection on overdue invoices > 45 days and stagger supplier payments.',
    NULL
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'duplicate_payment_risk',
    'medium',
    'Review AP for potential duplicate payments',
    'Two supplier invoices share similar amounts and references. Run three-way match before releasing payment batch.',
    NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Finance', 'finance.view', 'finance', 'View finance dashboards and reports'),
  ('Manage Finance', 'finance.manage', 'finance', 'Create journals, AP, budgets, assets'),
  ('Post Journals', 'finance.post', 'finance', 'Post and reverse GL journals'),
  ('Approve Finance', 'finance.approve', 'finance', 'Approve journals, payments, budgets'),
  ('Bank & Treasury', 'finance.bank', 'finance', 'Bank accounts, reconciliation, treasury'),
  ('Tax Management', 'finance.tax', 'finance', 'Tax codes, returns, WHT/VAT'),
  ('Close Periods', 'finance.close', 'finance', 'Period and year-end close')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'finance.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_centers_all ON cost_centers FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY coa_all ON chart_of_accounts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fiscal_years_all ON fiscal_years FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fiscal_periods_all ON fiscal_periods FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY exchange_rates_all ON exchange_rates FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY tax_codes_all ON tax_codes FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY gl_journals_all ON gl_journals FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY gl_journal_lines_all ON gl_journal_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY suppliers_all ON suppliers FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY ap_invoices_all ON ap_invoices FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY ap_payments_all ON ap_payments FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY ar_receipts_all ON ar_receipts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY ar_credit_notes_all ON ar_credit_notes FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bank_accounts_all ON bank_accounts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bank_transactions_all ON bank_transactions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bank_reconciliations_all ON bank_reconciliations FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fixed_assets_all ON fixed_assets FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY depreciation_entries_all ON depreciation_entries FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY budgets_all ON budgets FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY budget_lines_all ON budget_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY treasury_facilities_all ON treasury_facilities FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY finance_insights_all ON finance_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- currencies is global reference — readable by authenticated
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY currencies_select ON currencies FOR SELECT TO authenticated USING (true);

-- ============================================================
-- HELPER: post journal (balance check)
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_gl_journal(p_journal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_company UUID;
  v_debit DECIMAL(18,2);
  v_credit DECIMAL(18,2);
  v_status journal_status;
BEGIN
  SELECT company_id, status, total_debit, total_credit
  INTO v_company, v_status, v_debit, v_credit
  FROM gl_journals WHERE id = p_journal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal not found';
  END IF;
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Journal already posted';
  END IF;

  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
  INTO v_debit, v_credit
  FROM gl_journal_lines WHERE journal_id = p_journal_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Journal not balanced: debit % credit %', v_debit, v_credit;
  END IF;
  IF v_debit = 0 THEN
    RAISE EXCEPTION 'Journal has no lines';
  END IF;

  UPDATE gl_journals SET
    status = 'posted',
    total_debit = v_debit,
    total_credit = v_credit,
    posted_at = NOW(),
    posted_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_journal_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.post_gl_journal(UUID) TO authenticated, service_role;
