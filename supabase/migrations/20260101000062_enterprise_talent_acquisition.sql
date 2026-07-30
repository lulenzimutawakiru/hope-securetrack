-- Hope SecureTrack ERP — Enterprise Talent Acquisition & Recruitment
-- Workforce planning · ATS · Careers · Offers · Onboarding · AI

-- ============================================================
-- PLANNING & REQUISITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_headcount_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  fiscal_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int,
  department VARCHAR(150),
  branch_name VARCHAR(150),
  country VARCHAR(100) DEFAULT 'Uganda',
  approved_headcount INTEGER DEFAULT 0,
  current_headcount INTEGER DEFAULT 0,
  open_positions INTEGER DEFAULT 0,
  budget_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  owner_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'draft',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

CREATE TABLE IF NOT EXISTS ta_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(150),
  branch_name VARCHAR(150),
  job_family VARCHAR(100),
  employment_type VARCHAR(40) DEFAULT 'permanent',
  -- permanent|contract|temporary|intern|consultant
  headcount INTEGER DEFAULT 1,
  priority VARCHAR(20) DEFAULT 'normal',
  justification TEXT,
  budget_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  requested_by_name VARCHAR(150),
  hiring_manager_name VARCHAR(150),
  approval_status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected|cancelled
  status VARCHAR(30) DEFAULT 'open',
  target_start_date DATE,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, requisition_number)
);

CREATE TABLE IF NOT EXISTS ta_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(150),
  grade VARCHAR(40),
  reports_to VARCHAR(150),
  employment_type VARCHAR(40) DEFAULT 'permanent',
  min_salary DECIMAL(18,2) DEFAULT 0,
  max_salary DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  location_name VARCHAR(150),
  fte DECIMAL(5,2) DEFAULT 1,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, position_code)
);

CREATE TABLE IF NOT EXISTS ta_job_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  family VARCHAR(100),
  level VARCHAR(40),
  summary TEXT,
  responsibilities TEXT,
  requirements TEXT,
  skills TEXT,
  education VARCHAR(150),
  experience_years INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_code)
);

-- ============================================================
-- VACANCIES & PIPELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_vacancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vacancy_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  department VARCHAR(150),
  branch_name VARCHAR(150),
  location_name VARCHAR(150),
  country VARCHAR(100) DEFAULT 'Uganda',
  employment_type VARCHAR(40) DEFAULT 'permanent',
  work_mode VARCHAR(40) DEFAULT 'onsite',
  -- onsite|hybrid|remote
  positions INTEGER DEFAULT 1,
  salary_min DECIMAL(18,2) DEFAULT 0,
  salary_max DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  description TEXT,
  requirements TEXT,
  benefits TEXT,
  publish_internal BOOLEAN DEFAULT true,
  publish_external BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  application_deadline DATE,
  hiring_manager_name VARCHAR(150),
  recruiter_name VARCHAR(150),
  requisition_number VARCHAR(50),
  job_code VARCHAR(50),
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|open|on_hold|closed|cancelled|filled
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  applications_count INTEGER DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, vacancy_code)
);

CREATE TABLE IF NOT EXISTS ta_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stage_code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 100,
  is_terminal BOOLEAN DEFAULT false,
  color VARCHAR(20) DEFAULT 'slate',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, stage_code)
);

-- ============================================================
-- CANDIDATES & APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  country VARCHAR(100) DEFAULT 'Uganda',
  city VARCHAR(100),
  current_title VARCHAR(150),
  current_employer VARCHAR(150),
  years_experience DECIMAL(5,1) DEFAULT 0,
  education_level VARCHAR(80),
  skills TEXT,
  source VARCHAR(80) DEFAULT 'careers_portal',
  -- careers_portal|referral|agency|campus|linkedin|internal|walk_in
  talent_pool BOOLEAN DEFAULT false,
  resume_url TEXT,
  cover_letter_url TEXT,
  linkedin_url TEXT,
  consent_marketing BOOLEAN DEFAULT false,
  consent_privacy BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, candidate_number)
);

CREATE TABLE IF NOT EXISTS ta_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  application_number VARCHAR(50) NOT NULL,
  vacancy_code VARCHAR(50),
  vacancy_title VARCHAR(255),
  candidate_id UUID REFERENCES ta_candidates(id) ON DELETE SET NULL,
  candidate_number VARCHAR(50),
  candidate_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(50),
  stage_code VARCHAR(50) DEFAULT 'applied',
  stage_name VARCHAR(100) DEFAULT 'Applied',
  match_score DECIMAL(5,2) DEFAULT 0,
  ai_summary TEXT,
  source VARCHAR(80) DEFAULT 'careers_portal',
  recruiter_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'open',
  -- open|hired|rejected|withdrawn|on_hold
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  last_stage_at TIMESTAMPTZ DEFAULT NOW(),
  reject_reason TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, application_number)
);

CREATE INDEX IF NOT EXISTS idx_ta_apps_stage ON ta_applications(company_id, stage_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ta_apps_vacancy ON ta_applications(company_id, vacancy_code) WHERE deleted_at IS NULL;

-- ============================================================
-- ASSESSMENTS & INTERVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assessment_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  assessment_type VARCHAR(40) DEFAULT 'aptitude',
  -- technical|coding|manufacturing|accounting|hr|psychometric|aptitude|personality|language|essay|practical|video
  duration_minutes INTEGER DEFAULT 60,
  pass_score DECIMAL(5,2) DEFAULT 50,
  vacancy_code VARCHAR(50),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, assessment_code)
);

CREATE TABLE IF NOT EXISTS ta_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attempt_code VARCHAR(50) NOT NULL,
  assessment_code VARCHAR(50),
  application_number VARCHAR(50),
  candidate_name VARCHAR(200),
  score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 100,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'invited',
  -- invited|in_progress|completed|expired|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, attempt_code)
);

CREATE TABLE IF NOT EXISTS ta_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  interview_code VARCHAR(50) NOT NULL,
  application_number VARCHAR(50),
  vacancy_title VARCHAR(255),
  candidate_name VARCHAR(200),
  interview_type VARCHAR(40) DEFAULT 'panel',
  -- phone|video|onsite|panel|assessment_center
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  location_name VARCHAR(150),
  meeting_url TEXT,
  panel_members TEXT,
  score DECIMAL(5,2) DEFAULT 0,
  recommendation VARCHAR(40) DEFAULT 'pending',
  -- pending|hire|hold|reject
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled|completed|cancelled|no_show|rescheduled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, interview_code)
);

CREATE TABLE IF NOT EXISTS ta_background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_code VARCHAR(50) NOT NULL,
  application_number VARCHAR(50),
  candidate_name VARCHAR(200),
  check_type VARCHAR(40) DEFAULT 'employment',
  -- employment|academic|license|reference|identity|right_to_work|criminal
  provider_name VARCHAR(150),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result VARCHAR(40) DEFAULT 'pending',
  -- pending|clear|flagged|failed|cancelled
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, check_code)
);

CREATE TABLE IF NOT EXISTS ta_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reference_code VARCHAR(50) NOT NULL,
  application_number VARCHAR(50),
  candidate_name VARCHAR(200),
  referee_name VARCHAR(150),
  referee_title VARCHAR(150),
  referee_company VARCHAR(150),
  referee_email VARCHAR(255),
  referee_phone VARCHAR(50),
  relationship VARCHAR(80),
  feedback TEXT,
  rating DECIMAL(3,1) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'requested',
  -- requested|received|verified|declined
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reference_code)
);

CREATE TABLE IF NOT EXISTS ta_medical_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  exam_code VARCHAR(50) NOT NULL,
  application_number VARCHAR(50),
  candidate_name VARCHAR(200),
  clinic_name VARCHAR(150),
  scheduled_at TIMESTAMPTZ,
  result VARCHAR(40) DEFAULT 'pending',
  -- pending|fit|fit_with_restrictions|unfit
  status VARCHAR(30) DEFAULT 'scheduled',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, exam_code)
);

-- ============================================================
-- OFFERS & ONBOARDING
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  offer_number VARCHAR(50) NOT NULL,
  application_number VARCHAR(50),
  candidate_name VARCHAR(200),
  vacancy_title VARCHAR(255),
  department VARCHAR(150),
  employment_type VARCHAR(40) DEFAULT 'permanent',
  salary_amount DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  benefits_summary TEXT,
  probation_months INTEGER DEFAULT 6,
  start_date DATE,
  expiry_date DATE,
  approval_status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected
  candidate_response VARCHAR(30) DEFAULT 'pending',
  -- pending|accepted|declined|expired|withdrawn
  responded_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|issued|accepted|declined|expired|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, offer_number)
);

CREATE TABLE IF NOT EXISTS ta_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  task_code VARCHAR(50) NOT NULL,
  offer_number VARCHAR(50),
  candidate_name VARCHAR(200),
  task_name VARCHAR(200) NOT NULL,
  owner_department VARCHAR(100),
  -- hr|it|facilities|security|payroll|training
  due_date DATE,
  completed_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending|in_progress|done|blocked|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, task_code)
);

-- ============================================================
-- SOURCES: AGENCIES, REFERRALS, CAMPUS, TALENT POOL
-- ============================================================
CREATE TABLE IF NOT EXISTS ta_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agency_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  fee_pct DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, agency_code)
);

CREATE TABLE IF NOT EXISTS ta_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  employee_name VARCHAR(150),
  candidate_name VARCHAR(200),
  vacancy_title VARCHAR(255),
  reward_amount DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'submitted',
  -- submitted|interviewing|hired|paid|rejected
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, referral_code)
);

CREATE TABLE IF NOT EXISTS ta_campus_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  institution VARCHAR(200),
  event_date DATE,
  location_name VARCHAR(150),
  candidates_reached INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'planned',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, event_code)
);

CREATE TABLE IF NOT EXISTS ta_talent_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pool_code VARCHAR(50) NOT NULL,
  candidate_number VARCHAR(50),
  candidate_name VARCHAR(200),
  skills TEXT,
  interest_area VARCHAR(150),
  availability VARCHAR(40) DEFAULT 'passive',
  -- active|passive|not_looking
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pool_code)
);

CREATE TABLE IF NOT EXISTS ta_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(40) DEFAULT 'resume',
  -- resume|cover_letter|offer|contract|id|certificate|policy|other
  related_type VARCHAR(40),
  related_number VARCHAR(80),
  file_url TEXT,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_code)
);

CREATE TABLE IF NOT EXISTS ta_settings (
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

CREATE TABLE IF NOT EXISTS ta_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_code VARCHAR(50) NOT NULL,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  score DECIMAL(5,2) DEFAULT 0,
  recommendations TEXT,
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, insight_code)
);

CREATE TABLE IF NOT EXISTS ta_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(80),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ta_headcount_plans','ta_requisitions','ta_positions','ta_job_library','ta_vacancies',
    'ta_pipeline_stages','ta_candidates','ta_applications','ta_assessments','ta_assessment_attempts',
    'ta_interviews','ta_background_checks','ta_references','ta_medical_exams','ta_offers',
    'ta_onboarding_tasks','ta_agencies','ta_referrals','ta_campus_events','ta_talent_pool',
    'ta_documents','ta_settings','ta_ai_insights','ta_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
      t || '_all', t
    );
  END LOOP;
END $$;

-- Public careers portal: anyone can read open external vacancies
DROP POLICY IF EXISTS ta_vacancies_public_read ON ta_vacancies;
CREATE POLICY ta_vacancies_public_read ON ta_vacancies
  FOR SELECT
  USING (status = 'open' AND publish_external = true AND deleted_at IS NULL);

-- Allow authenticated company users full access (already covered by ta_vacancies_all)
-- Public apply inserts via service role API only

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Talent View', 'ta.view', 'talent', 'View talent acquisition module'),
  ('Talent Manage', 'ta.manage', 'talent', 'Manage recruitment records'),
  ('Talent Recruit', 'ta.recruit', 'talent', 'Recruiter operations'),
  ('Talent Approve', 'ta.approve', 'talent', 'Approve requisitions and offers'),
  ('Talent AI', 'ta.ai', 'talent', 'AI matching and insights'),
  ('Talent Admin', 'ta.admin', 'talent', 'Talent settings and audit'),
  ('Talent Portal', 'ta.portal', 'talent', 'Careers and candidate portal admin')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug)
  AND NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN (
  'super_administrator','managing_director','operations_manager',
  'hr_manager','hr_officer','auditor'
)
AND p.slug LIKE 'ta.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN RETURN; END IF;

  INSERT INTO ta_pipeline_stages (company_id, stage_code, name, sort_order, is_terminal, color) VALUES
    (cid, 'applied', 'Applied', 10, false, 'slate'),
    (cid, 'screen', 'Screening', 20, false, 'blue'),
    (cid, 'shortlist', 'Shortlisted', 30, false, 'cyan'),
    (cid, 'assessment', 'Assessment', 40, false, 'violet'),
    (cid, 'interview', 'Interview', 50, false, 'amber'),
    (cid, 'background', 'Background check', 60, false, 'orange'),
    (cid, 'offer', 'Offer', 70, false, 'emerald'),
    (cid, 'hired', 'Hired', 80, true, 'green'),
    (cid, 'rejected', 'Rejected', 90, true, 'red')
  ON CONFLICT (company_id, stage_code) DO NOTHING;

  INSERT INTO ta_job_library (company_id, job_code, title, family, level, summary, requirements, experience_years, status) VALUES
    (cid, 'JOB-PRINT-OP', 'Security Print Operator', 'Production', 'Specialist', 'Operate security printing lines and quality checks.', 'Diploma + 2 years manufacturing', 2, 'active'),
    (cid, 'JOB-QA-ENG', 'Quality Assurance Engineer', 'Quality', 'Professional', 'QA for security documents and manufacturing.', 'Degree in engineering/quality', 3, 'active'),
    (cid, 'JOB-SALES-EX', 'Sales Executive', 'Commercial', 'Professional', 'B2B sales for print and logistics services.', 'Degree + CRM experience', 2, 'active')
  ON CONFLICT (company_id, job_code) DO NOTHING;

  INSERT INTO ta_vacancies (
    company_id, vacancy_code, title, department, branch_name, location_name, employment_type,
    work_mode, positions, salary_min, salary_max, currency, description, requirements,
    publish_internal, publish_external, is_featured, status, published_at, recruiter_name
  ) VALUES
    (cid, 'VAC-2026-001', 'Security Print Operator', 'Production', 'Kampala Factory', 'Kampala', 'permanent',
     'onsite', 3, 1200000, 2200000, 'UGX',
     'Join Hope Design Group security printing production team.',
     'Diploma; experience with industrial print equipment preferred.',
     true, true, true, 'open', NOW(), 'HR Recruiting'),
    (cid, 'VAC-2026-002', 'Quality Assurance Engineer', 'Quality', 'Head Office', 'Kampala', 'permanent',
     'hybrid', 1, 2500000, 4500000, 'UGX',
     'Lead QA for security documents and manufacturing processes.',
     'Engineering degree; ISO/QMS experience.',
     true, true, true, 'open', NOW(), 'HR Recruiting'),
    (cid, 'VAC-2026-003', 'Sales Executive — Central Region', 'Sales', 'Head Office', 'Kampala', 'permanent',
     'hybrid', 2, 1800000, 3500000, 'UGX',
     'Drive B2B revenue across print, packaging and logistics.',
     'Degree; 2+ years B2B sales.',
     true, true, false, 'open', NOW(), 'HR Recruiting')
  ON CONFLICT (company_id, vacancy_code) DO NOTHING;

  INSERT INTO ta_settings (company_id, setting_key, setting_value, category, description) VALUES
    (cid, 'default_currency', 'UGX', 'general', 'Default offer currency'),
    (cid, 'default_probation_months', '6', 'offer', 'Default probation period'),
    (cid, 'careers_portal_enabled', 'true', 'portal', 'Public careers portal'),
    (cid, 'ai_matching_enabled', 'true', 'ai', 'AI candidate matching'),
    (cid, 'require_background_check', 'true', 'compliance', 'Background check before hire')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO ta_ai_insights (company_id, insight_code, insight_type, title, summary, severity, score, recommendations, status) VALUES
    (cid, 'AI-TA-01', 'funnel', 'Screening bottleneck', 'Applications are accumulating in screening for Production roles.', 'medium', 72, 'Add assessment automation; assign second recruiter', 'open'),
    (cid, 'AI-TA-02', 'source', 'Careers portal performing well', 'External portal is the top source for open vacancies this month.', 'info', 80, 'Feature more roles; enable job alerts', 'open')
  ON CONFLICT (company_id, insight_code) DO NOTHING;
END $$;
