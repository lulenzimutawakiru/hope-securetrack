-- Hope Design Group — Enterprise Payroll Management Platform
-- Profiles · structures · tax · loans · benefits · processing · payslips · GL · AI

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Payroll', 'payroll.view', 'payroll', 'View payroll runs and reports'),
  ('Manage Payroll', 'payroll.manage', 'payroll', 'Configure and process payroll'),
  ('Process Payroll', 'payroll.process', 'payroll', 'Run payroll calculations'),
  ('Approve Payroll', 'payroll.approve', 'payroll', 'Approve payroll runs'),
  ('Pay Payroll', 'payroll.pay', 'payroll', 'Release payments and bank files'),
  ('Payroll Self-Service', 'payroll.self', 'payroll', 'Employee payslips and advances'),
  ('Payroll AI', 'payroll.ai', 'payroll', 'AI payroll assistant'),
  ('Payroll Tax', 'payroll.tax', 'payroll', 'Tax configuration and filings')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'payroll.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'auditor','hr_manager','finance_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Broad self-service for staff roles if present
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug = 'payroll.self'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager','hr_manager',
    'production_manager','production_supervisor','production_operator',
    'warehouse_manager','sales_manager','sales_executive','customer_service','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND payroll_run_status ENUM
-- ============================================================
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'calculated';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'locked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Fallback for PG versions without IF NOT EXISTS on enum
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE 'calculated';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE 'rejected';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE payroll_run_status ADD VALUE 'locked';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- EXTEND EXISTING payroll_runs / payroll_lines
-- ============================================================
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT 'UG',
  ADD COLUMN IF NOT EXISTS currency VARCHAR(5) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS pay_group VARCHAR(50) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS employer_cost DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS posted_to_gl BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gl_journal_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS housing DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS communication DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentives DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deduction DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_deduction DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employee DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pension_employer DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxable_pay DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_worked DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_days DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hours DECIMAL(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS component_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40) DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payslip_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'calculated';

-- ============================================================
-- TAX BRACKETS & STATUTORY RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code VARCHAR(5) NOT NULL DEFAULT 'UG',
  tax_type VARCHAR(40) NOT NULL DEFAULT 'paye',
  -- paye | withholding | social | other
  bracket_name VARCHAR(100) NOT NULL,
  min_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  max_amount DECIMAL(18,2),
  rate_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
  fixed_amount DECIMAL(14,2) DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pay_statutory_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code VARCHAR(5) NOT NULL DEFAULT 'UG',
  code VARCHAR(40) NOT NULL,
  -- nssf_employee | nssf_employer | nhif | lst | etc
  name VARCHAR(150) NOT NULL,
  rate_pct DECIMAL(8,4) DEFAULT 0,
  fixed_amount DECIMAL(14,2) DEFAULT 0,
  cap_amount DECIMAL(18,2),
  base_type VARCHAR(40) DEFAULT 'gross',
  -- gross | basic | taxable
  employer_portion BOOLEAN DEFAULT false,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, country_code, code, effective_from)
);

-- ============================================================
-- PAY COMPONENTS · STRUCTURES · GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  component_type VARCHAR(30) NOT NULL DEFAULT 'earning',
  -- earning | deduction | employer | tax
  category VARCHAR(40) DEFAULT 'allowance',
  -- basic | allowance | bonus | overtime | statutory | loan | benefit | other
  is_taxable BOOLEAN DEFAULT true,
  is_statutory BOOLEAN DEFAULT false,
  formula TEXT,
  default_amount DECIMAL(14,2) DEFAULT 0,
  default_pct DECIMAL(8,4),
  gl_account_code VARCHAR(40),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, component_code)
);

CREATE TABLE IF NOT EXISTS pay_salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50),
  country_code VARCHAR(5) DEFAULT 'UG',
  currency VARCHAR(5) DEFAULT 'UGX',
  basic_amount DECIMAL(14,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, structure_code)
);

CREATE TABLE IF NOT EXISTS pay_structure_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES pay_salary_structures(id) ON DELETE CASCADE,
  component_id UUID REFERENCES pay_components(id) ON DELETE SET NULL,
  component_code VARCHAR(40) NOT NULL,
  amount DECIMAL(14,2) DEFAULT 0,
  pct_of_basic DECIMAL(8,4),
  is_percentage BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pay_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  frequency VARCHAR(20) DEFAULT 'monthly',
  -- monthly | weekly | biweekly | daily
  country_code VARCHAR(5) DEFAULT 'UG',
  currency VARCHAR(5) DEFAULT 'UGX',
  pay_day INTEGER DEFAULT 28,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, group_code)
);

-- ============================================================
-- EMPLOYEE PAYROLL PROFILE
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_group_id UUID REFERENCES pay_groups(id) ON DELETE SET NULL,
  structure_id UUID REFERENCES pay_salary_structures(id) ON DELETE SET NULL,
  country_code VARCHAR(5) DEFAULT 'UG',
  currency VARCHAR(5) DEFAULT 'UGX',
  basic_salary DECIMAL(14,2) DEFAULT 0,
  salary_grade VARCHAR(50),
  cost_center VARCHAR(80),
  payment_method VARCHAR(40) DEFAULT 'bank_transfer',
  bank_name VARCHAR(150),
  bank_account VARCHAR(100),
  bank_branch VARCHAR(100),
  tin_number VARCHAR(80),
  nssf_number VARCHAR(80),
  national_id VARCHAR(80),
  tax_exempt BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, employee_id)
);

CREATE TABLE IF NOT EXISTS pay_employee_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  component_id UUID REFERENCES pay_components(id) ON DELETE SET NULL,
  component_code VARCHAR(40) NOT NULL,
  amount DECIMAL(14,2) DEFAULT 0,
  pct_value DECIMAL(8,4),
  is_recurring BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OVERTIME · BONUSES · LOANS · ADVANCES · BENEFITS
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_overtime_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  claim_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  ot_type VARCHAR(40) DEFAULT 'weekday',
  -- weekday | weekend | holiday | night
  rate_multiplier DECIMAL(6,3) DEFAULT 1.5,
  hourly_rate DECIMAL(14,2) DEFAULT 0,
  amount DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | paid | cancelled
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, claim_number)
);

CREATE TABLE IF NOT EXISTS pay_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bonus_number VARCHAR(50) NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  department VARCHAR(100),
  bonus_type VARCHAR(40) DEFAULT 'performance',
  -- performance | production | sales | department | holiday | other
  name VARCHAR(150) NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  period_label VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, bonus_number)
);

CREATE TABLE IF NOT EXISTS pay_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  loan_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  loan_type VARCHAR(40) DEFAULT 'salary_advance',
  -- salary_advance | emergency | equipment | other
  principal DECIMAL(14,2) NOT NULL,
  interest_rate_pct DECIMAL(8,4) DEFAULT 0,
  total_payable DECIMAL(14,2) NOT NULL,
  installment_amount DECIMAL(14,2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1,
  paid_installments INTEGER DEFAULT 0,
  outstanding DECIMAL(14,2) NOT NULL,
  start_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | active | completed | rejected | cancelled
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, loan_number)
);

CREATE TABLE IF NOT EXISTS pay_loan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES pay_loans(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE,
  amount DECIMAL(14,2) NOT NULL,
  paid_amount DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | deducted | paid | waived | overdue
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pay_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  advance_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount DECIMAL(14,2) NOT NULL,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | deducted | cancelled
  request_date DATE DEFAULT CURRENT_DATE,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, advance_number)
);

CREATE TABLE IF NOT EXISTS pay_benefit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  benefit_type VARCHAR(40) DEFAULT 'medical',
  -- medical | life | pension | transport | housing | education | other
  employee_contribution DECIMAL(14,2) DEFAULT 0,
  employer_contribution DECIMAL(14,2) DEFAULT 0,
  contribution_pct_employee DECIMAL(8,4) DEFAULT 0,
  contribution_pct_employer DECIMAL(8,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

CREATE TABLE IF NOT EXISTS pay_employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pay_benefit_plans(id) ON DELETE CASCADE,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  employee_amount DECIMAL(14,2) DEFAULT 0,
  employer_amount DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVALS · PAYMENTS · PAYSLIPS · RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS pay_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  stage VARCHAR(40) NOT NULL DEFAULT 'payroll_officer',
  -- payroll_officer | hr_manager | finance_manager | director | payment_release
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected
  reviewer_id UUID REFERENCES user_profiles(id),
  comments TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pay_payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  bank_name VARCHAR(150),
  payment_date DATE,
  total_amount DECIMAL(18,2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | generated | submitted | confirmed | failed
  file_content TEXT,
  file_format VARCHAR(40) DEFAULT 'csv',
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

CREATE TABLE IF NOT EXISTS pay_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_line_id UUID REFERENCES payroll_lines(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payslip_number VARCHAR(50) NOT NULL,
  period_label VARCHAR(50),
  html_body TEXT,
  verification_code VARCHAR(40),
  is_published BOOLEAN DEFAULT false,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, payslip_number)
);

CREATE TABLE IF NOT EXISTS pay_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  country_code VARCHAR(5) DEFAULT 'UG',
  scope VARCHAR(40) DEFAULT 'company',
  -- company | department | country
  scope_value VARCHAR(100),
  formula TEXT NOT NULL,
  description TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS pay_gl_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mapping_key VARCHAR(60) NOT NULL,
  -- salary_expense | paye_payable | nssf_payable | bank | employer_nssf
  account_code VARCHAR(40) NOT NULL,
  account_name VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, mapping_key)
);

CREATE TABLE IF NOT EXISTS pay_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  entity_type VARCHAR(40),
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pay_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(40),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_profiles_emp ON pay_employee_profiles(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pay_ot_status ON pay_overtime_claims(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pay_loans_emp ON pay_loans(employee_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pay_payslips_emp ON pay_payslips(employee_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pay_tax_brackets','pay_statutory_rates','pay_components','pay_salary_structures',
    'pay_structure_lines','pay_groups','pay_employee_profiles','pay_employee_components',
    'pay_overtime_claims','pay_bonuses','pay_loans','pay_loan_schedules','pay_advances',
    'pay_benefit_plans','pay_employee_benefits','pay_approvals','pay_payment_batches',
    'pay_payslips','pay_rules','pay_gl_mappings','pay_ai_insights','pay_audit'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
         company_id = public.user_company_id() OR public.is_super_admin()
       ) WITH CHECK (
         company_id = public.user_company_id() OR public.is_super_admin()
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

-- ============================================================
-- SEED — Uganda + sample Kenya rules, HDG components
-- ============================================================
DO $$
DECLARE
  cid UUID;
  sid UUID;
  gid UUID;
  emp RECORD;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  -- Uganda PAYE brackets (simplified monthly progressive, illustrative)
  INSERT INTO pay_tax_brackets (company_id, country_code, tax_type, bracket_name, min_amount, max_amount, rate_pct, fixed_amount, sort_order)
  SELECT cid, 'UG', 'paye', v.n, v.min_a, v.max_a, v.rate, v.fixed, v.ord
  FROM (VALUES
    ('0 – 235,000', 0::numeric, 235000::numeric, 0::numeric, 0::numeric, 1),
    ('235,001 – 335,000', 235000, 335000, 10, 0, 2),
    ('335,001 – 410,000', 335000, 410000, 20, 10000, 3),
    ('410,001 – 10,000,000', 410000, 10000000, 30, 25000, 4),
    ('Above 10,000,000', 10000000, NULL, 40, 2920000, 5)
  ) AS v(n, min_a, max_a, rate, fixed, ord)
  WHERE NOT EXISTS (SELECT 1 FROM pay_tax_brackets b WHERE b.company_id = cid AND b.country_code = 'UG' AND b.bracket_name = v.n);

  -- Kenya sample brackets (illustrative)
  INSERT INTO pay_tax_brackets (company_id, country_code, tax_type, bracket_name, min_amount, max_amount, rate_pct, fixed_amount, sort_order)
  SELECT cid, 'KE', 'paye', v.n, v.min_a, v.max_a, v.rate, v.fixed, v.ord
  FROM (VALUES
    ('0 – 24,000', 0::numeric, 24000::numeric, 10::numeric, 0::numeric, 1),
    ('24,001 – 32,333', 24000, 32333, 25, 2400, 2),
    ('Above 32,333', 32333, NULL, 30, 4483.25, 3)
  ) AS v(n, min_a, max_a, rate, fixed, ord)
  WHERE NOT EXISTS (SELECT 1 FROM pay_tax_brackets b WHERE b.company_id = cid AND b.country_code = 'KE' AND b.bracket_name = v.n);

  INSERT INTO pay_statutory_rates (company_id, country_code, code, name, rate_pct, employer_portion, base_type)
  VALUES
    (cid, 'UG', 'nssf_employee', 'NSSF Employee 5%', 5, false, 'gross'),
    (cid, 'UG', 'nssf_employer', 'NSSF Employer 10%', 10, true, 'gross'),
    (cid, 'KE', 'nssf_employee', 'Kenya NSSF Employee', 6, false, 'gross'),
    (cid, 'KE', 'nhif', 'NHIF (illustrative fixed base)', 0, false, 'gross')
  ON CONFLICT DO NOTHING;

  INSERT INTO pay_components (company_id, component_code, name, component_type, category, is_taxable, is_statutory, sort_order)
  VALUES
    (cid, 'BASIC', 'Basic Salary', 'earning', 'basic', true, false, 1),
    (cid, 'HOUSING', 'Housing Allowance', 'earning', 'allowance', true, false, 2),
    (cid, 'TRANSPORT', 'Transport Allowance', 'earning', 'allowance', true, false, 3),
    (cid, 'MEDICAL', 'Medical Allowance', 'earning', 'allowance', true, false, 4),
    (cid, 'COMM', 'Communication Allowance', 'earning', 'allowance', true, false, 5),
    (cid, 'OT', 'Overtime', 'earning', 'overtime', true, false, 6),
    (cid, 'BONUS', 'Performance Bonus', 'earning', 'bonus', true, false, 7),
    (cid, 'COMMISSION', 'Sales Commission', 'earning', 'bonus', true, false, 8),
    (cid, 'PAYE', 'PAYE Income Tax', 'tax', 'statutory', false, true, 20),
    (cid, 'NSSF_EE', 'NSSF Employee', 'deduction', 'statutory', false, true, 21),
    (cid, 'NSSF_ER', 'NSSF Employer', 'employer', 'statutory', false, true, 22),
    (cid, 'LOAN', 'Loan Repayment', 'deduction', 'loan', false, false, 30),
    (cid, 'ADVANCE', 'Salary Advance Recovery', 'deduction', 'loan', false, false, 31),
    (cid, 'INSURANCE', 'Insurance Premium', 'deduction', 'benefit', false, false, 32)
  ON CONFLICT (company_id, component_code) DO NOTHING;

  INSERT INTO pay_groups (company_id, group_code, name, frequency, country_code, currency, pay_day)
  VALUES
    (cid, 'MONTHLY-UG', 'Monthly Uganda Staff', 'monthly', 'UG', 'UGX', 28),
    (cid, 'WEEKLY-OPS', 'Weekly Operations', 'weekly', 'UG', 'UGX', 5)
  ON CONFLICT (company_id, group_code) DO NOTHING;

  SELECT id INTO gid FROM pay_groups WHERE company_id = cid AND group_code = 'MONTHLY-UG';

  INSERT INTO pay_salary_structures (company_id, structure_code, name, grade, country_code, currency, basic_amount, description)
  VALUES
    (cid, 'STR-OPS', 'Operations Grade', 'OPS', 'UG', 'UGX', 800000, 'Production & warehouse'),
    (cid, 'STR-PROF', 'Professional Grade', 'PRO', 'UG', 'UGX', 1500000, 'Supervisors & specialists'),
    (cid, 'STR-MGMT', 'Management Grade', 'MGT', 'UG', 'UGX', 3500000, 'Managers')
  ON CONFLICT (company_id, structure_code) DO NOTHING;

  SELECT id INTO sid FROM pay_salary_structures WHERE company_id = cid AND structure_code = 'STR-PROF';

  IF sid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pay_structure_lines WHERE structure_id = sid) THEN
    INSERT INTO pay_structure_lines (company_id, structure_id, component_code, amount, is_percentage, pct_of_basic, sort_order)
    VALUES
      (cid, sid, 'BASIC', 1500000, false, NULL, 1),
      (cid, sid, 'HOUSING', 0, true, 20, 2),
      (cid, sid, 'TRANSPORT', 150000, false, NULL, 3),
      (cid, sid, 'MEDICAL', 100000, false, NULL, 4),
      (cid, sid, 'COMM', 50000, false, NULL, 5);
  END IF;

  INSERT INTO pay_benefit_plans (company_id, plan_code, name, benefit_type, employee_contribution, employer_contribution)
  VALUES
    (cid, 'MED-CORE', 'Core Medical Insurance', 'medical', 25000, 75000),
    (cid, 'LIFE-GRP', 'Group Life Cover', 'life', 0, 30000),
    (cid, 'PEN-VOL', 'Voluntary Pension Top-up', 'pension', 50000, 50000)
  ON CONFLICT (company_id, plan_code) DO NOTHING;

  INSERT INTO pay_rules (company_id, rule_code, name, country_code, formula, description)
  VALUES
    (cid, 'NET-PAY', 'Standard Net Pay', 'UG',
     'gross - statutory - employee_deductions',
     'Net Pay = Gross Earnings - Statutory Deductions - Employee Deductions'),
    (cid, 'OT-WD', 'Weekday OT 1.5x', 'UG',
     'hours * hourly_rate * 1.5',
     'Weekday overtime multiplier'),
    (cid, 'OT-WE', 'Weekend OT 2.0x', 'UG',
     'hours * hourly_rate * 2.0',
     'Weekend overtime multiplier')
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO pay_gl_mappings (company_id, mapping_key, account_code, account_name)
  VALUES
    (cid, 'salary_expense', '5100', 'Salaries & Wages Expense'),
    (cid, 'paye_payable', '2200', 'PAYE Payable'),
    (cid, 'nssf_payable', '2210', 'NSSF Payable'),
    (cid, 'bank', '1100', 'Payroll Bank Account'),
    (cid, 'employer_nssf', '5110', 'Employer NSSF Expense')
  ON CONFLICT (company_id, mapping_key) DO NOTHING;

  -- Sync profiles from active employees
  FOR emp IN
    SELECT id, salary, grade, nssf_number, tin_number, department
    FROM employees WHERE company_id = cid AND status = 'active'
  LOOP
    INSERT INTO pay_employee_profiles (
      company_id, employee_id, pay_group_id, structure_id, basic_salary,
      salary_grade, country_code, currency, nssf_number, tin_number, is_active
    ) VALUES (
      cid, emp.id, gid, sid, COALESCE(emp.salary, 0),
      emp.grade, 'UG', 'UGX', emp.nssf_number, emp.tin_number, true
    )
    ON CONFLICT (company_id, employee_id) DO UPDATE SET
      basic_salary = EXCLUDED.basic_salary,
      updated_at = NOW();
  END LOOP;

END $$;
