-- Hope Design Group Ltd — Enterprise Human Resource / Human Capital Management
-- Lifecycle · Recruitment · Leave · Payroll · Performance · Training · Exit · ESS

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE applicant_stage AS ENUM (
  'applied','shortlisted','interview','assessment','offer','accepted','hired','rejected','withdrawn'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE performance_rating AS ENUM (
  'outstanding','exceeds','meets','needs_improvement','unsatisfactory'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE exit_type AS ENUM (
  'resignation','retirement','contract_expiry','termination','redundancy'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payroll_run_status AS ENUM (
  'draft','processing','approved','paid','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND EMPLOYEES (HCM fields)
-- ============================================================
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) DEFAULT 'Ugandan',
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS tin_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mobile_money VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payroll_group VARCHAR(50) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS confirmation_date DATE,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS position_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS leave_balance_days DECIMAL(6,2) DEFAULT 21,
  ADD COLUMN IF NOT EXISTS sick_leave_balance DECIMAL(6,2) DEFAULT 14;

-- ============================================================
-- JOB REQUISITIONS & APPLICANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS job_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  branch_name VARCHAR(100),
  positions INTEGER DEFAULT 1,
  employment_type VARCHAR(50) DEFAULT 'permanent',
  grade VARCHAR(50),
  description TEXT,
  requirements TEXT,
  status VARCHAR(30) DEFAULT 'open', -- draft | open | on_hold | filled | cancelled
  requested_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  target_hire_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, requisition_number)
);

CREATE TABLE IF NOT EXISTS job_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_id UUID REFERENCES job_requisitions(id) ON DELETE SET NULL,
  applicant_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  stage applicant_stage DEFAULT 'applied',
  source VARCHAR(100),
  current_employer VARCHAR(255),
  expected_salary DECIMAL(14,2),
  notes TEXT,
  interview_date TIMESTAMPTZ,
  offer_amount DECIMAL(14,2),
  hired_employee_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, applicant_number)
);

-- ============================================================
-- LEAVE BALANCES & PUBLIC HOLIDAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  entitled DECIMAL(6,2) DEFAULT 0,
  taken DECIMAL(6,2) DEFAULT 0,
  balance DECIMAL(6,2) GENERATED ALWAYS AS (entitled - taken) STORED,
  UNIQUE(employee_id, leave_type, year)
);

CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, holiday_date)
);

-- ============================================================
-- PAYROLL
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_number VARCHAR(50) NOT NULL,
  period_label VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE,
  status payroll_run_status DEFAULT 'draft',
  employee_count INTEGER DEFAULT 0,
  gross_total DECIMAL(18,2) DEFAULT 0,
  deductions_total DECIMAL(18,2) DEFAULT 0,
  net_total DECIMAL(18,2) DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, run_number)
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  basic_salary DECIMAL(14,2) DEFAULT 0,
  allowances DECIMAL(14,2) DEFAULT 0,
  overtime DECIMAL(14,2) DEFAULT 0,
  bonuses DECIMAL(14,2) DEFAULT 0,
  gross_pay DECIMAL(14,2) DEFAULT 0,
  paye DECIMAL(14,2) DEFAULT 0,
  nssf_employee DECIMAL(14,2) DEFAULT 0,
  nssf_employer DECIMAL(14,2) DEFAULT 0,
  lst DECIMAL(14,2) DEFAULT 0,
  other_deductions DECIMAL(14,2) DEFAULT 0,
  net_pay DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERFORMANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  reviewer_id UUID REFERENCES user_profiles(id),
  period_label VARCHAR(50),
  review_type VARCHAR(50) DEFAULT 'annual', -- annual | probation | mid_year | 360
  rating performance_rating,
  score DECIMAL(5,2),
  strengths TEXT,
  improvements TEXT,
  goals TEXT,
  status VARCHAR(30) DEFAULT 'draft', -- draft | submitted | acknowledged | closed
  review_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, review_number)
);

CREATE TABLE IF NOT EXISTS employee_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_value DECIMAL(14,2),
  actual_value DECIMAL(14,2),
  unit VARCHAR(50),
  weight_pct DECIMAL(5,2) DEFAULT 100,
  status VARCHAR(30) DEFAULT 'active',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRAINING
-- ============================================================
CREATE TABLE IF NOT EXISTS training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  course_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  provider VARCHAR(150),
  duration_hours DECIMAL(8,2) DEFAULT 8,
  is_mandatory BOOLEAN DEFAULT false,
  cost DECIMAL(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, course_code)
);

CREATE TABLE IF NOT EXISTS training_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'enrolled', -- enrolled | in_progress | completed | cancelled
  score DECIMAL(5,2),
  certificate_url TEXT,
  notes TEXT
);

-- ============================================================
-- DISCIPLINE / GRIEVANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  case_number VARCHAR(50) NOT NULL,
  case_type VARCHAR(50) NOT NULL, -- warning | investigation | hearing | grievance | appeal
  employee_id UUID REFERENCES employees(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open',
  outcome TEXT,
  opened_at DATE DEFAULT CURRENT_DATE,
  closed_at DATE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, case_number)
);

-- ============================================================
-- ASSET ASSIGNMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL, -- laptop | phone | vehicle | uniform | ppe | access_card | tool
  asset_tag VARCHAR(100),
  description VARCHAR(255) NOT NULL,
  issued_date DATE DEFAULT CURRENT_DATE,
  return_date DATE,
  condition_out VARCHAR(50) DEFAULT 'good',
  condition_in VARCHAR(50),
  status VARCHAR(30) DEFAULT 'issued', -- issued | returned | lost | damaged
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXIT MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_exits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  exit_number VARCHAR(50) NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  exit_type exit_type NOT NULL,
  notice_date DATE,
  last_working_day DATE,
  reason TEXT,
  exit_interview_notes TEXT,
  assets_cleared BOOLEAN DEFAULT false,
  payroll_cleared BOOLEAN DEFAULT false,
  access_revoked BOOLEAN DEFAULT false,
  final_settlement DECIMAL(14,2),
  status VARCHAR(30) DEFAULT 'initiated', -- initiated | in_progress | completed
  processed_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, exit_number)
);

-- ============================================================
-- HR INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS hr_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT,
  department VARCHAR(100),
  metric_value DECIMAL(18,4),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public_holidays (company_id, holiday_date, name, is_recurring) VALUES
  ('a0000000-0000-4000-8000-000000000001', '2026-01-01', 'New Year''s Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-01-26', 'NRM Liberation Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-03-08', 'International Women''s Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-05-01', 'Labour Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-06-03', 'Martyrs'' Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-06-09', 'Heroes'' Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-10-09', 'Independence Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-12-25', 'Christmas Day', true),
  ('a0000000-0000-4000-8000-000000000001', '2026-12-26', 'Boxing Day', true)
ON CONFLICT (company_id, holiday_date) DO NOTHING;

-- Sample employees if none
INSERT INTO employees (
  company_id, employee_number, first_name, last_name, email, phone,
  department, job_title, employment_type, status, hire_date, salary, currency,
  grade, branch_name, leave_balance_days, nssf_number, tin_number, nationality
)
SELECT * FROM (VALUES
  (
    'a0000000-0000-4000-8000-000000000001'::uuid, 'EMP-001', 'James', 'Okello',
    'james.okello@hopedesign.ug', '+256700100001', 'Production', 'Machine Operator',
    'permanent', 'active'::employment_status, '2022-03-15'::date, 850000::decimal, 'UGX',
    'G4', 'Main Factory', 18::decimal, 'NSSF-100001', 'TIN-200001', 'Ugandan'
  ),
  (
    'a0000000-0000-4000-8000-000000000001'::uuid, 'EMP-002', 'Grace', 'Namutebi',
    'grace.namutebi@hopedesign.ug', '+256700100002', 'Human Resources', 'HR Officer',
    'permanent', 'active'::employment_status, '2021-06-01'::date, 1500000::decimal, 'UGX',
    'G6', 'Head Office', 21::decimal, 'NSSF-100002', 'TIN-200002', 'Ugandan'
  ),
  (
    'a0000000-0000-4000-8000-000000000001'::uuid, 'EMP-003', 'Peter', 'Ssemakula',
    'peter.ssemakula@hopedesign.ug', '+256700100003', 'Warehouse', 'Warehouse Officer',
    'permanent', 'active'::employment_status, '2023-01-10'::date, 950000::decimal, 'UGX',
    'G4', 'Main Factory', 15::decimal, 'NSSF-100003', 'TIN-200003', 'Ugandan'
  ),
  (
    'a0000000-0000-4000-8000-000000000001'::uuid, 'EMP-004', 'Amina', 'Nakato',
    'amina.nakato@hopedesign.ug', '+256700100004', 'Sales', 'Sales Representative',
    'permanent', 'active'::employment_status, '2022-09-01'::date, 1200000::decimal, 'UGX',
    'G5', 'Head Office', 12::decimal, 'NSSF-100004', 'TIN-200004', 'Ugandan'
  ),
  (
    'a0000000-0000-4000-8000-000000000001'::uuid, 'EMP-005', 'David', 'Muwonge',
    'david.muwonge@hopedesign.ug', '+256700100005', 'Quality Assurance', 'QC Inspector',
    'permanent', 'active'::employment_status, '2020-11-20'::date, 1100000::decimal, 'UGX',
    'G5', 'Main Factory', 8::decimal, 'NSSF-100005', 'TIN-200005', 'Ugandan'
  )
) AS v(company_id, employee_number, first_name, last_name, email, phone, department, job_title, employment_type, status, hire_date, salary, currency, grade, branch_name, leave_balance_days, nssf_number, tin_number, nationality)
WHERE NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.company_id = v.company_id AND e.employee_number = v.employee_number
);

-- Leave balances
INSERT INTO leave_balances (company_id, employee_id, leave_type, year, entitled, taken)
SELECT e.company_id, e.id, 'annual', 2026, 21, GREATEST(21 - COALESCE(e.leave_balance_days, 21), 0)
FROM employees e
WHERE e.company_id = 'a0000000-0000-4000-8000-000000000001'
ON CONFLICT (employee_id, leave_type, year) DO NOTHING;

INSERT INTO leave_balances (company_id, employee_id, leave_type, year, entitled, taken)
SELECT e.company_id, e.id, 'sick', 2026, 14, 0
FROM employees e
WHERE e.company_id = 'a0000000-0000-4000-8000-000000000001'
ON CONFLICT (employee_id, leave_type, year) DO NOTHING;

-- Job requisition + applicants
INSERT INTO job_requisitions (
  company_id, requisition_number, title, department, positions, employment_type,
  grade, description, status, target_hire_date
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'JR-2026-001',
  'Machine Operator — Paper Line',
  'Production',
  6,
  'permanent',
  'G4',
  'Operators for Premium A4 production line expansion.',
  'open',
  CURRENT_DATE + 60
WHERE NOT EXISTS (SELECT 1 FROM job_requisitions WHERE requisition_number = 'JR-2026-001');

INSERT INTO job_applicants (
  company_id, requisition_id, applicant_number, first_name, last_name, email, phone, stage, source
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  jr.id,
  'APP-2026-00' || n,
  CASE n WHEN 1 THEN 'John' WHEN 2 THEN 'Sarah' ELSE 'Michael' END,
  CASE n WHEN 1 THEN 'Byaruhanga' WHEN 2 THEN 'Akello' ELSE 'Kato' END,
  'applicant' || n || '@mail.ug',
  '+25670100000' || n,
  CASE n WHEN 1 THEN 'interview'::applicant_stage WHEN 2 THEN 'shortlisted'::applicant_stage ELSE 'applied'::applicant_stage END,
  'job board'
FROM job_requisitions jr
CROSS JOIN generate_series(1, 3) AS n
WHERE jr.requisition_number = 'JR-2026-001'
  AND NOT EXISTS (SELECT 1 FROM job_applicants WHERE applicant_number = 'APP-2026-00' || n);

-- Training courses
INSERT INTO training_courses (company_id, course_code, title, category, provider, duration_hours, is_mandatory, cost) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'TRN-OSH-01', 'Occupational Safety Induction', 'Safety', 'Internal HSE', 4, true, 0),
  ('a0000000-0000-4000-8000-000000000001', 'TRN-QA-01', 'Quality Inspection Basics', 'Quality', 'Internal QA', 8, true, 0),
  ('a0000000-0000-4000-8000-000000000001', 'TRN-LEAD-01', 'Supervisory Leadership', 'Leadership', 'External', 16, false, 450000)
ON CONFLICT (company_id, course_code) DO NOTHING;

INSERT INTO training_enrollments (company_id, course_id, employee_id, status, completed_at)
SELECT c.company_id, c.id, e.id, 'completed', CURRENT_DATE - 30
FROM training_courses c
CROSS JOIN employees e
WHERE c.course_code = 'TRN-OSH-01'
  AND e.employee_number IN ('EMP-001', 'EMP-003', 'EMP-005')
  AND NOT EXISTS (
    SELECT 1 FROM training_enrollments te WHERE te.course_id = c.id AND te.employee_id = e.id
  );

-- Performance review sample
INSERT INTO performance_reviews (
  company_id, review_number, employee_id, period_label, review_type, rating, score, strengths, improvements, status, review_date
)
SELECT
  e.company_id, 'PRV-2026-001', e.id, '2025 Annual', 'annual', 'exceeds', 4.2,
  'Consistent production output and safety compliance.',
  'Cross-train on packing line.',
  'acknowledged', CURRENT_DATE - 90
FROM employees e
WHERE e.employee_number = 'EMP-001'
  AND NOT EXISTS (SELECT 1 FROM performance_reviews WHERE review_number = 'PRV-2026-001');

-- Payroll run sample
DO $$
DECLARE
  v_run UUID;
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  r RECORD;
  v_gross DECIMAL;
  v_paye DECIMAL;
  v_nssf DECIMAL;
  v_net DECIMAL;
  v_gross_t DECIMAL := 0;
  v_ded_t DECIMAL := 0;
  v_net_t DECIMAL := 0;
  v_cnt INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM payroll_runs WHERE run_number = 'PAY-2026-06') THEN RETURN; END IF;

  INSERT INTO payroll_runs (
    company_id, run_number, period_label, period_start, period_end, pay_date, status
  ) VALUES (
    v_company, 'PAY-2026-06', 'June 2026', '2026-06-01', '2026-06-30', '2026-06-28', 'approved'
  ) RETURNING id INTO v_run;

  FOR r IN SELECT * FROM employees WHERE company_id = v_company AND status = 'active' LOOP
    v_gross := COALESCE(r.salary, 0);
    v_nssf := ROUND(v_gross * 0.05, 0);
    v_paye := CASE
      WHEN v_gross <= 235000 THEN 0
      WHEN v_gross <= 335000 THEN ROUND((v_gross - 235000) * 0.10, 0)
      WHEN v_gross <= 410000 THEN ROUND(10000 + (v_gross - 335000) * 0.20, 0)
      ELSE ROUND(25000 + (v_gross - 410000) * 0.30, 0)
    END;
    v_net := v_gross - v_nssf - v_paye;

    INSERT INTO payroll_lines (
      payroll_run_id, company_id, employee_id, basic_salary, allowances, overtime, bonuses,
      gross_pay, paye, nssf_employee, nssf_employer, lst, other_deductions, net_pay
    ) VALUES (
      v_run, v_company, r.id, v_gross, 0, 0, 0,
      v_gross, v_paye, v_nssf, ROUND(v_gross * 0.10, 0), 0, 0, v_net
    );

    v_gross_t := v_gross_t + v_gross;
    v_ded_t := v_ded_t + v_paye + v_nssf;
    v_net_t := v_net_t + v_net;
    v_cnt := v_cnt + 1;
  END LOOP;

  UPDATE payroll_runs SET
    employee_count = v_cnt,
    gross_total = v_gross_t,
    deductions_total = v_ded_t,
    net_total = v_net_t
  WHERE id = v_run;
END $$;

-- Assets
INSERT INTO employee_assets (company_id, employee_id, asset_type, asset_tag, description, status)
SELECT e.company_id, e.id, 'laptop', 'LT-00' || RIGHT(e.employee_number, 1), 'Dell Latitude', 'issued'
FROM employees e
WHERE e.employee_number IN ('EMP-002', 'EMP-004')
  AND NOT EXISTS (
    SELECT 1 FROM employee_assets a WHERE a.employee_id = e.id AND a.asset_tag LIKE 'LT-%'
  );

-- Insights
INSERT INTO hr_insights (company_id, insight_type, severity, title, recommendation, department, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'workforce_planning',
    'high',
    'Production needs 6 additional machine operators',
    'The Production Department is projected to require six additional machine operators within the next three months based on forecasted production demand and current employee turnover. Accelerate JR-2026-001 hiring pipeline.',
    'Production',
    6
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'turnover_risk',
    'medium',
    'Warehouse leave balance low — burnout risk',
    'Warehouse Officer leave balances are below 16 days with high overtime from WFM. Recommend leave planning and shift rotation.',
    'Warehouse',
    NULL
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'training_gap',
    'medium',
    'Mandatory OSH incomplete for new hires',
    'Enroll all employees hired in last 90 days into Occupational Safety Induction (TRN-OSH-01).',
    NULL,
    NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('HR Payroll', 'hr.payroll', 'hr', 'Run and approve payroll'),
  ('HR Recruit', 'hr.recruit', 'hr', 'Manage requisitions and applicants'),
  ('HR Performance', 'hr.performance', 'hr', 'Performance reviews and OKRs'),
  ('HR Training', 'hr.training', 'hr', 'Courses and enrollments'),
  ('HR Self Service', 'hr.self', 'hr', 'Employee self-service access')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'hr.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_requisitions_all ON job_requisitions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY job_applicants_all ON job_applicants FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY leave_balances_all ON leave_balances FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY public_holidays_all ON public_holidays FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY payroll_runs_all ON payroll_runs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY payroll_lines_all ON payroll_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY performance_reviews_all ON performance_reviews FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY employee_objectives_all ON employee_objectives FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY training_courses_all ON training_courses FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY training_enrollments_all ON training_enrollments FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY hr_cases_all ON hr_cases FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY employee_assets_all ON employee_assets FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY employee_exits_all ON employee_exits FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY hr_insights_all ON hr_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
