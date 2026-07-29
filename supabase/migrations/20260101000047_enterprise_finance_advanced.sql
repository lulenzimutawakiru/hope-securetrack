-- Hope SecureTrack ERP — Enterprise Finance Advanced
-- Manufacturing costing · Paper cost rollups · CFO KPIs · Cash · Approvals
-- Consolidation · AI · Mobile money · Intercompany · Audit
-- Extends 00010 / 00016 / billing

-- ============================================================
-- COA ENHANCEMENTS
-- ============================================================
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS multi_currency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_group VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- JOURNAL ENHANCEMENTS
-- ============================================================
ALTER TABLE gl_journals
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(100),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS source_module VARCHAR(50),
  ADD COLUMN IF NOT EXISTS source_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS digital_signature TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- BUSINESS UNITS / BRANCHES (finance dim)
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  unit_type VARCHAR(40) DEFAULT 'branch', -- branch|bu|division
  parent_id UUID REFERENCES fin_business_units(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- INTERCOMPANY & CONSOLIDATION
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_intercompany_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  txn_number VARCHAR(50) NOT NULL,
  from_entity VARCHAR(150) NOT NULL,
  to_entity VARCHAR(150) NOT NULL,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  journal_id UUID REFERENCES gl_journals(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, txn_number)
);

CREATE TABLE IF NOT EXISTS fin_elimination_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  description TEXT NOT NULL,
  debit_account VARCHAR(30),
  credit_account VARCHAR(30),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CASH MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_cash_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_balance DECIMAL(18,2) DEFAULT 0,
  cash_balance DECIMAL(18,2) DEFAULT 0,
  mobile_money_balance DECIMAL(18,2) DEFAULT 0,
  petty_cash DECIMAL(18,2) DEFAULT 0,
  total_cash DECIMAL(18,2) GENERATED ALWAYS AS (
    COALESCE(bank_balance,0) + COALESCE(cash_balance,0) + COALESCE(mobile_money_balance,0) + COALESCE(petty_cash,0)
  ) STORED,
  currency VARCHAR(10) DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, position_date, currency)
);

CREATE TABLE IF NOT EXISTS fin_cash_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location VARCHAR(150) DEFAULT 'Main Vault',
  system_balance DECIMAL(18,2) DEFAULT 0,
  counted_balance DECIMAL(18,2) DEFAULT 0,
  variance DECIMAL(18,2) GENERATED ALWAYS AS (COALESCE(counted_balance,0) - COALESCE(system_balance,0)) STORED,
  counted_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fin_petty_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_number VARCHAR(50) NOT NULL,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payee VARCHAR(255),
  purpose TEXT,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'posted',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, voucher_number)
);

-- ============================================================
-- MOBILE MONEY & PAYMENT GATEWAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_mobile_money_txns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL, -- mtn_momo|airtel_money|other
  direction VARCHAR(20) DEFAULT 'in', -- in|out
  phone VARCHAR(50),
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  reference VARCHAR(100),
  external_ref VARCHAR(150),
  status VARCHAR(30) DEFAULT 'completed',
  linked_receipt_id UUID,
  linked_payment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MANUFACTURING / PAPER COSTING
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_cost_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  roll_number VARCHAR(50) NOT NULL,
  production_order_ref VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  product_line VARCHAR(100), -- security_print|bond|packaging|export|gov
  batch_qty DECIMAL(18,4) DEFAULT 0,
  unit_label VARCHAR(40) DEFAULT 'batch', -- sheet|ream|box|pallet|ton|batch|order
  direct_materials DECIMAL(18,2) DEFAULT 0,
  direct_labor DECIMAL(18,2) DEFAULT 0,
  factory_overhead DECIMAL(18,2) DEFAULT 0,
  machine_cost DECIMAL(18,2) DEFAULT 0,
  utility_cost DECIMAL(18,2) DEFAULT 0,
  packaging_cost DECIMAL(18,2) DEFAULT 0,
  transport_cost DECIMAL(18,2) DEFAULT 0,
  scrap_cost DECIMAL(18,2) DEFAULT 0,
  total_cost DECIMAL(18,2) GENERATED ALWAYS AS (
    COALESCE(direct_materials,0) + COALESCE(direct_labor,0) + COALESCE(factory_overhead,0)
    + COALESCE(machine_cost,0) + COALESCE(utility_cost,0) + COALESCE(packaging_cost,0)
    + COALESCE(transport_cost,0) + COALESCE(scrap_cost,0)
  ) STORED,
  currency VARCHAR(10) DEFAULT 'UGX',
  cost_per_sheet DECIMAL(18,6) DEFAULT 0,
  cost_per_ream DECIMAL(18,4) DEFAULT 0,
  cost_per_box DECIMAL(18,4) DEFAULT 0,
  cost_per_pallet DECIMAL(18,4) DEFAULT 0,
  cost_per_ton DECIMAL(18,4) DEFAULT 0,
  cost_per_batch DECIMAL(18,4) DEFAULT 0,
  cost_per_order DECIMAL(18,4) DEFAULT 0,
  standard_cost DECIMAL(18,2) DEFAULT 0,
  variance_amount DECIMAL(18,2) DEFAULT 0,
  wip_value DECIMAL(18,2) DEFAULT 0,
  fg_value DECIMAL(18,2) DEFAULT 0,
  period_year INTEGER,
  period_month INTEGER,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, roll_number)
);

CREATE TABLE IF NOT EXISTS fin_wip (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_ref VARCHAR(100) NOT NULL,
  product_name VARCHAR(255),
  opening_wip DECIMAL(18,2) DEFAULT 0,
  materials_added DECIMAL(18,2) DEFAULT 0,
  labor_added DECIMAL(18,2) DEFAULT 0,
  overhead_added DECIMAL(18,2) DEFAULT 0,
  transferred_to_fg DECIMAL(18,2) DEFAULT 0,
  closing_wip DECIMAL(18,2) DEFAULT 0,
  period_year INTEGER,
  period_month INTEGER,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CFO KPI SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_position DECIMAL(18,2) DEFAULT 0,
  bank_balances DECIMAL(18,2) DEFAULT 0,
  ar_balance DECIMAL(18,2) DEFAULT 0,
  ap_balance DECIMAL(18,2) DEFAULT 0,
  inventory_value DECIMAL(18,2) DEFAULT 0,
  revenue_mtd DECIMAL(18,2) DEFAULT 0,
  expenses_mtd DECIMAL(18,2) DEFAULT 0,
  gross_profit DECIMAL(18,2) DEFAULT 0,
  net_profit DECIMAL(18,2) DEFAULT 0,
  ebitda DECIMAL(18,2) DEFAULT 0,
  gross_margin_pct DECIMAL(8,2) DEFAULT 0,
  net_margin_pct DECIMAL(8,2) DEFAULT 0,
  operating_margin_pct DECIMAL(8,2) DEFAULT 0,
  current_ratio DECIMAL(10,4) DEFAULT 0,
  quick_ratio DECIMAL(10,4) DEFAULT 0,
  debt_to_equity DECIMAL(10,4) DEFAULT 0,
  roa DECIMAL(10,4) DEFAULT 0,
  roe DECIMAL(10,4) DEFAULT 0,
  working_capital DECIMAL(18,2) DEFAULT 0,
  cash_conversion_days INTEGER DEFAULT 0,
  tax_payable DECIMAL(18,2) DEFAULT 0,
  payroll_cost_mtd DECIMAL(18,2) DEFAULT 0,
  production_cost_mtd DECIMAL(18,2) DEFAULT 0,
  budget_utilization_pct DECIMAL(8,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, snapshot_date)
);

-- ============================================================
-- APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- journal|payment|ap_invoice|credit_limit|budget|po|asset|payroll|expense
  entity_id UUID,
  entity_ref VARCHAR(100),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  requested_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'pending', -- pending|approved|rejected
  level_required INTEGER DEFAULT 1,
  level_current INTEGER DEFAULT 0,
  approver_id UUID REFERENCES user_profiles(id),
  decided_at TIMESTAMPTZ,
  comments TEXT,
  digital_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_approvals_status ON fin_approvals(company_id, status);

-- ============================================================
-- CASH FLOW FORECAST
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_cash_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  inflow DECIMAL(18,2) DEFAULT 0,
  outflow DECIMAL(18,2) DEFAULT 0,
  net_flow DECIMAL(18,2) GENERATED ALWAYS AS (COALESCE(inflow,0) - COALESCE(outflow,0)) STORED,
  projected_balance DECIMAL(18,2) DEFAULT 0,
  source VARCHAR(40) DEFAULT 'ai', -- ai|manual|system
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TAX RETURNS / FILING
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_tax_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  return_type VARCHAR(40) NOT NULL, -- vat|wht|paye|corporate|nssf
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'draft', -- draft|filed|paid
  due_date DATE,
  filed_at TIMESTAMPTZ,
  reference VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI INSIGHTS EXT
-- ============================================================
ALTER TABLE finance_insights
  ADD COLUMN IF NOT EXISTS score DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entity_ref VARCHAR(100);

-- ============================================================
-- AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS fin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_audit ON fin_audit_log(company_id, created_at DESC);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('Finance AI', 'finance.ai', 'finance', 'AI financial intelligence'),
  ('Finance CFO', 'finance.cfo', 'finance', 'CFO executive dashboards'),
  ('Finance Costing', 'finance.costing', 'finance', 'Manufacturing & paper costing'),
  ('Finance Treasury', 'finance.treasury', 'finance', 'Treasury & cash management'),
  ('Finance Consolidate', 'finance.consolidate', 'finance', 'Multi-company consolidation'),
  ('Finance Admin', 'finance.admin', 'finance', 'Finance administration')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'finance.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE fin_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_intercompany_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_elimination_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_cash_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_petty_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_mobile_money_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_cost_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_wip ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_cash_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_tax_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY fin_bu_all ON fin_business_units FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_ic_all ON fin_intercompany_txns FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_elim_all ON fin_elimination_entries FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_cash_pos_all ON fin_cash_positions FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_cash_counts_all ON fin_cash_counts FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_petty_all ON fin_petty_cash FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_momo_all ON fin_mobile_money_txns FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_cost_rolls_all ON fin_cost_rolls FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_wip_all ON fin_wip FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_kpi_all ON fin_kpi_snapshots FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_approvals_all ON fin_approvals FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_cf_all ON fin_cash_forecasts FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_tax_ret_all ON fin_tax_returns FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fin_audit_all ON fin_audit_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED — Hope Design Group
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  -- Business units
  INSERT INTO fin_business_units (company_id, code, name, unit_type) VALUES
    (cid, 'HQ', 'Hope Design HQ Kampala', 'branch'),
    (cid, 'MFG', 'Manufacturing Division', 'bu'),
    (cid, 'SEC', 'Security Printing BU', 'bu'),
    (cid, 'DIST', 'Distribution Central', 'branch')
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Cash position
  INSERT INTO fin_cash_positions (
    company_id, position_date, bank_balance, cash_balance, mobile_money_balance, petty_cash, currency, notes
  ) VALUES (
    cid, CURRENT_DATE, 1850000000, 45000000, 28000000, 3500000, 'UGX', 'Opening daily cash position'
  ) ON CONFLICT (company_id, position_date, currency) DO UPDATE SET
    bank_balance = 1850000000,
    cash_balance = 45000000,
    mobile_money_balance = 28000000,
    petty_cash = 3500000;

  -- KPI snapshot
  INSERT INTO fin_kpi_snapshots (
    company_id, snapshot_date, cash_position, bank_balances, ar_balance, ap_balance,
    inventory_value, revenue_mtd, expenses_mtd, gross_profit, net_profit, ebitda,
    gross_margin_pct, net_margin_pct, operating_margin_pct, current_ratio, quick_ratio,
    debt_to_equity, roa, roe, working_capital, cash_conversion_days, tax_payable,
    payroll_cost_mtd, production_cost_mtd, budget_utilization_pct, currency
  ) VALUES (
    cid, CURRENT_DATE, 1926500000, 1850000000, 920000000, 640000000,
    1450000000, 2100000000, 1480000000, 780000000, 420000000, 510000000,
    37.1, 20.0, 24.3, 1.85, 1.12,
    0.42, 0.085, 0.142, 1280000000, 62, 185000000,
    310000000, 890000000, 72.5, 'UGX'
  ) ON CONFLICT (company_id, snapshot_date) DO UPDATE SET
    cash_position = EXCLUDED.cash_position,
    ebitda = EXCLUDED.ebitda,
    net_profit = EXCLUDED.net_profit,
    gross_margin_pct = EXCLUDED.gross_margin_pct;

  -- Paper manufacturing cost rolls
  IF NOT EXISTS (SELECT 1 FROM fin_cost_rolls WHERE company_id = cid AND roll_number = 'COST-SEC-2026-041' LIMIT 1) THEN
    INSERT INTO fin_cost_rolls (
      company_id, roll_number, production_order_ref, product_name, product_line, batch_qty, unit_label,
      direct_materials, direct_labor, factory_overhead, machine_cost, utility_cost, packaging_cost,
      transport_cost, scrap_cost, cost_per_sheet, cost_per_ream, cost_per_box, cost_per_pallet,
      cost_per_ton, cost_per_batch, cost_per_order, standard_cost, variance_amount, wip_value, fg_value,
      period_year, period_month
    ) VALUES
      (cid, 'COST-SEC-2026-041', 'PO-MFG-2026-118', 'Security A4 paper batch', 'security_print', 5000, 'ream',
       185000000, 42000000, 38000000, 22000000, 15000000, 12000000, 8000000, 4500000,
       52.4, 26200, 131000, 2620000, 4200000, 326500000, 326500000, 310000000, 16500000, 45000000, 281500000,
       EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int),
      (cid, 'COST-BOND-2026-022', 'PO-MFG-2026-122', 'Premium bond reams', 'bond', 8000, 'ream',
       98000000, 28000000, 22000000, 14000000, 9000000, 11000000, 5000000, 2000000,
       28.1, 14050, 70250, 1405000, 2100000, 189000000, 189000000, 195000000, -6000000, 20000000, 169000000,
       EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int),
      (cid, 'COST-GOV-2026-009', 'PO-MFG-2026-130', 'MoES exam booklet run', 'gov', 12000, 'order',
       420000000, 95000000, 78000000, 55000000, 32000000, 28000000, 18000000, 12000000,
       61.2, 30600, 153000, 3060000, 5100000, 738000000, 738000000, 700000000, 38000000, 120000000, 618000000,
       EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int);
  END IF;

  -- WIP
  IF NOT EXISTS (SELECT 1 FROM fin_wip WHERE company_id = cid AND production_order_ref = 'PO-MFG-2026-118' LIMIT 1) THEN
    INSERT INTO fin_wip (
      company_id, production_order_ref, product_name, opening_wip, materials_added, labor_added,
      overhead_added, transferred_to_fg, closing_wip, period_year, period_month, status
    ) VALUES (
      cid, 'PO-MFG-2026-118', 'Security A4 paper batch', 12000000, 185000000, 42000000, 75000000, 269000000, 45000000,
      EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 'open'
    );
  END IF;

  -- Cash forecast (7 days)
  IF NOT EXISTS (SELECT 1 FROM fin_cash_forecasts WHERE company_id = cid AND forecast_date = CURRENT_DATE LIMIT 1) THEN
    INSERT INTO fin_cash_forecasts (company_id, forecast_date, inflow, outflow, projected_balance, source, notes) VALUES
      (cid, CURRENT_DATE, 120000000, 85000000, 1961500000, 'ai', 'Collections + MoMo inflows'),
      (cid, CURRENT_DATE + 1, 95000000, 110000000, 1946500000, 'ai', 'Supplier payment batch scheduled'),
      (cid, CURRENT_DATE + 2, 150000000, 70000000, 2026500000, 'ai', 'Government AR expected'),
      (cid, CURRENT_DATE + 3, 60000000, 95000000, 1991500000, 'ai', 'Payroll mid-cycle advances'),
      (cid, CURRENT_DATE + 7, 200000000, 140000000, 2051500000, 'ai', 'Weekly net positive');
  END IF;

  -- Approvals pending
  IF NOT EXISTS (SELECT 1 FROM fin_approvals WHERE company_id = cid AND entity_ref = 'AP-PAY-2026-088' LIMIT 1) THEN
    INSERT INTO fin_approvals (company_id, entity_type, entity_ref, amount, currency, status, level_required, comments) VALUES
      (cid, 'payment', 'AP-PAY-2026-088', 185000000, 'UGX', 'pending', 2, 'EAPP pulp payment — dual approval required'),
      (cid, 'journal', 'JRN-ADJ-2026-014', 12500000, 'UGX', 'pending', 1, 'Month-end accrual adjustment'),
      (cid, 'budget', 'BUD-CAPEX-Q3', 450000000, 'UGX', 'pending', 2, 'Security press CAPEX revision');
  END IF;

  -- Tax returns
  IF NOT EXISTS (SELECT 1 FROM fin_tax_returns WHERE company_id = cid AND return_type = 'vat'
    AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
    AND period_month = EXTRACT(MONTH FROM CURRENT_DATE)::int LIMIT 1) THEN
    INSERT INTO fin_tax_returns (company_id, return_type, period_year, period_month, tax_amount, status, due_date) VALUES
      (cid, 'vat', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 142000000, 'draft',
       (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month + 14 days')::date),
      (cid, 'wht', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 28500000, 'draft',
       (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month + 14 days')::date),
      (cid, 'paye', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 68000000, 'draft',
       (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month + 14 days')::date);
  END IF;

  -- Mobile money sample
  IF NOT EXISTS (SELECT 1 FROM fin_mobile_money_txns WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO fin_mobile_money_txns (company_id, provider, direction, phone, amount, reference, status) VALUES
      (cid, 'mtn_momo', 'in', '+256772100200', 4500000, 'MOMO-IN-001', 'completed'),
      (cid, 'airtel_money', 'out', '+256700334455', 1200000, 'AIRTEL-OUT-014', 'completed');
  END IF;

  -- Insights
  INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'cash_forecast', 'medium',
    'Cash dip expected mid-week',
    'Supplier batch + payroll advances reduce projected balance by ~2%. Delay non-critical AP 48h or accelerate MoES collection.',
    72, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM finance_insights WHERE company_id = cid AND title LIKE 'Cash dip%' LIMIT 1);

  INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'cost_variance', 'high',
    'Security paper batch over standard cost',
    'COST-SEC-2026-041 variance +UGX 16.5M (materials + scrap). Review pulp yield and machine hours.',
    84, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM finance_insights WHERE company_id = cid AND title LIKE 'Security paper batch%' LIMIT 1);

  INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'collections', 'medium',
    'AR concentration risk — top 3 customers',
    'Top institutional customers represent majority of AR. Prioritize MoES and Makerere collections this week.',
    68, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM finance_insights WHERE company_id = cid AND title LIKE 'AR concentration%' LIMIT 1);

  INSERT INTO finance_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'fraud_risk', 'low',
    'Duplicate payment check clean',
    'No duplicate AP payment fingerprints detected in last 30 days. Continue dual-approval controls.',
    40, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM finance_insights WHERE company_id = cid AND title LIKE 'Duplicate payment%' LIMIT 1);

END $$;
