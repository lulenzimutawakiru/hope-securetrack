-- Hope SecureTrack — Enterprise Payroll complete extension
-- Calendars · periods · grades · commissions · incentives · costing · formulas · mobile money

-- Soft-delete on key pay tables
ALTER TABLE pay_employee_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_components ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_salary_structures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_loans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_benefit_plans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE pay_bonuses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- CALENDARS & PERIODS
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calendar_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  frequency VARCHAR(20) DEFAULT 'monthly',
  country_code VARCHAR(5) DEFAULT 'UG',
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, calendar_code)
);

CREATE TABLE IF NOT EXISTS pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_code VARCHAR(50) NOT NULL,
  calendar_code VARCHAR(50),
  name VARCHAR(150) NOT NULL,
  period_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  period_month INTEGER,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  -- open|processing|closed|locked
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_code)
);

-- ============================================================
-- COMPENSATION STRUCTURE
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_salary_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grade_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  min_salary DECIMAL(18,2) DEFAULT 0,
  mid_salary DECIMAL(18,2) DEFAULT 0,
  max_salary DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, grade_code)
);

CREATE TABLE IF NOT EXISTS pay_salary_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  band_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  grade_code VARCHAR(50),
  step_count INTEGER DEFAULT 5,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, band_code)
);

CREATE TABLE IF NOT EXISTS pay_salary_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scale_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  grade_code VARCHAR(50),
  step_no INTEGER DEFAULT 1,
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, scale_code)
);

-- ============================================================
-- COMMISSIONS · INCENTIVES · SHIFT PREMIUMS
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  commission_code VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150),
  employee_number VARCHAR(50),
  period_label VARCHAR(40),
  basis_amount DECIMAL(18,2) DEFAULT 0,
  rate_pct DECIMAL(8,4) DEFAULT 0,
  commission_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  source_module VARCHAR(40) DEFAULT 'sales',
  status VARCHAR(30) DEFAULT 'accrued',
  -- accrued|approved|paid|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, commission_code)
);

CREATE TABLE IF NOT EXISTS pay_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incentive_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  incentive_type VARCHAR(40) DEFAULT 'production',
  -- production|attendance|quality|safety|custom
  employee_name VARCHAR(150),
  period_label VARCHAR(40),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  production_batch VARCHAR(80),
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, incentive_code)
);

CREATE TABLE IF NOT EXISTS pay_shift_premiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  premium_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  shift_name VARCHAR(80),
  rate_pct DECIMAL(8,4) DEFAULT 0,
  fixed_amount DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, premium_code)
);

-- ============================================================
-- FORMULA ENGINE · SIMULATION · CORRECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  formula_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  component_code VARCHAR(50),
  expression TEXT NOT NULL,
  description TEXT,
  version_no INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, formula_code)
);

CREATE TABLE IF NOT EXISTS pay_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  simulation_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  period_code VARCHAR(50),
  gross_total DECIMAL(18,2) DEFAULT 0,
  net_total DECIMAL(18,2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  result_json JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, simulation_code)
);

CREATE TABLE IF NOT EXISTS pay_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  correction_code VARCHAR(50) NOT NULL,
  run_number VARCHAR(50),
  employee_name VARCHAR(150),
  correction_type VARCHAR(40) DEFAULT 'adjustment',
  -- adjustment|reversal|retro|off_cycle
  amount DECIMAL(18,2) DEFAULT 0,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, correction_code)
);

CREATE TABLE IF NOT EXISTS pay_final_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  settlement_code VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150),
  employee_number VARCHAR(50),
  last_working_date DATE,
  leave_encashment DECIMAL(18,2) DEFAULT 0,
  gratuity_amount DECIMAL(18,2) DEFAULT 0,
  loan_balance DECIMAL(18,2) DEFAULT 0,
  net_settlement DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, settlement_code)
);

-- ============================================================
-- COSTING · BANK · MOBILE MONEY · COMPLIANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  allocation_code VARCHAR(50) NOT NULL,
  run_number VARCHAR(50),
  cost_center VARCHAR(80),
  department VARCHAR(150),
  project_code VARCHAR(80),
  production_line VARCHAR(80),
  batch_number VARCHAR(80),
  labour_cost DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'posted',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, allocation_code)
);

CREATE TABLE IF NOT EXISTS pay_mobile_money (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  txn_code VARCHAR(50) NOT NULL,
  provider VARCHAR(40) DEFAULT 'mtn',
  -- mtn|airtel|other
  employee_name VARCHAR(150),
  phone VARCHAR(40),
  amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  period_label VARCHAR(40),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending|sent|failed|reconciled
  external_ref VARCHAR(100),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, txn_code)
);

CREATE TABLE IF NOT EXISTS pay_bank_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_code VARCHAR(50) NOT NULL,
  run_number VARCHAR(50),
  bank_name VARCHAR(100),
  format VARCHAR(40) DEFAULT 'csv',
  record_count INTEGER DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  file_url TEXT,
  status VARCHAR(30) DEFAULT 'generated',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, file_code)
);

CREATE TABLE IF NOT EXISTS pay_pension_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scheme_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  employee_pct DECIMAL(8,4) DEFAULT 0,
  employer_pct DECIMAL(8,4) DEFAULT 0,
  provider_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, scheme_code)
);

CREATE TABLE IF NOT EXISTS pay_gratuity_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  years_of_service_min INTEGER DEFAULT 0,
  months_per_year DECIMAL(6,2) DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS pay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS pay_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(40) DEFAULT 'payslip',
  -- payslip|bank_file|tax_return|nssf|policy|other
  related_number VARCHAR(80),
  file_url TEXT,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_code)
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pay_calendars','pay_periods','pay_salary_grades','pay_salary_bands','pay_salary_scales',
    'pay_commissions','pay_incentives','pay_shift_premiums','pay_formulas','pay_simulations',
    'pay_corrections','pay_final_settlements','pay_cost_allocations','pay_mobile_money',
    'pay_bank_files','pay_pension_schemes','pay_gratuity_rules','pay_settings','pay_documents'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id())',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Extra permissions
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Payroll Admin', 'payroll.admin', 'payroll', 'Payroll settings and master data'),
  ('Payroll Costing', 'payroll.costing', 'payroll', 'Labour cost allocation'),
  ('Payroll Bank', 'payroll.bank', 'payroll', 'Bank and mobile money payments')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug)
  AND NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('payroll.admin','payroll.costing','payroll.bank')
  AND r.slug IN ('super_administrator','managing_director','finance_manager','hr_manager','auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN RETURN; END IF;

  INSERT INTO pay_calendars (company_id, calendar_code, name, frequency, country_code, currency, status)
  VALUES (cid, 'CAL-MONTHLY', 'Monthly Payroll Uganda', 'monthly', 'UG', 'UGX', 'active')
  ON CONFLICT (company_id, calendar_code) DO NOTHING;

  INSERT INTO pay_periods (company_id, period_code, calendar_code, name, period_year, period_month, start_date, end_date, pay_date, status)
  VALUES (
    cid, 'PER-' || TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'CAL-MONTHLY',
    TO_CHAR(CURRENT_DATE, 'Mon YYYY') || ' Payroll',
    EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
    DATE_TRUNC('month', CURRENT_DATE)::date,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
    'open'
  )
  ON CONFLICT (company_id, period_code) DO NOTHING;

  INSERT INTO pay_salary_grades (company_id, grade_code, name, min_salary, mid_salary, max_salary, currency, status) VALUES
    (cid, 'G1', 'Operator', 800000, 1200000, 1800000, 'UGX', 'active'),
    (cid, 'G2', 'Specialist', 1500000, 2200000, 3200000, 'UGX', 'active'),
    (cid, 'G3', 'Professional', 2500000, 4000000, 6000000, 'UGX', 'active'),
    (cid, 'G4', 'Manager', 5000000, 8000000, 12000000, 'UGX', 'active')
  ON CONFLICT (company_id, grade_code) DO NOTHING;

  INSERT INTO pay_shift_premiums (company_id, premium_code, name, shift_name, rate_pct, status) VALUES
    (cid, 'SP-NIGHT', 'Night shift premium', 'Night', 15, 'active'),
    (cid, 'SP-WEEKEND', 'Weekend premium', 'Weekend', 25, 'active')
  ON CONFLICT (company_id, premium_code) DO NOTHING;

  INSERT INTO pay_pension_schemes (company_id, scheme_code, name, employee_pct, employer_pct, provider_name, status)
  VALUES (cid, 'PEN-NSSF', 'NSSF Uganda', 5, 10, 'NSSF Uganda', 'active')
  ON CONFLICT (company_id, scheme_code) DO NOTHING;

  INSERT INTO pay_formulas (company_id, formula_code, name, component_code, expression, description, status) VALUES
    (cid, 'F-BASIC', 'Basic salary', 'BASIC', 'basic_salary * proration', 'Prorated basic', 'active'),
    (cid, 'F-OT15', 'Overtime 1.5x', 'OT', 'ot_hours * hourly_rate * 1.5', 'Weekday OT', 'active'),
    (cid, 'F-HOUSING', 'Housing 20%', 'HOUSING', 'basic_salary * 0.20', 'Housing allowance', 'active')
  ON CONFLICT (company_id, formula_code) DO NOTHING;

  INSERT INTO pay_settings (company_id, setting_key, setting_value, category, description) VALUES
    (cid, 'default_currency', 'UGX', 'general', 'Default payroll currency'),
    (cid, 'default_country', 'UG', 'tax', 'Default tax country'),
    (cid, 'period_days', '26', 'calc', 'Working days per month'),
    (cid, 'hours_per_month', '176', 'calc', 'Standard hours'),
    (cid, 'auto_post_gl', 'true', 'accounting', 'Post payroll journals to finance'),
    (cid, 'payslip_qr', 'true', 'payslip', 'Embed QR on payslips')
  ON CONFLICT (company_id, setting_key) DO NOTHING;
END $$;
