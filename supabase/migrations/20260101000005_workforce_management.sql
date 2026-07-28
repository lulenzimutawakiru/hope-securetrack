-- Hope Design Group Ltd — Enterprise Workforce Management (WFM)
-- Cloud / On-Premise / Hybrid / Offline-capable schema foundation

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE shift_pattern AS ENUM (
  'fixed','rotating','night','weekend','split','flexible','holiday','emergency'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE attendance_method AS ENUM (
  'biometric','facial','rfid','qr','mobile_gps','web','nfc','manual'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE overtime_status AS ENUM (
  'pending','approved','rejected','paid'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE field_job_status AS ENUM (
  'assigned','en_route','on_site','completed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE safety_incident_severity AS ENUM (
  'low','medium','high','critical'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND EMPLOYEES (workforce master)
-- ============================================================
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS national_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS grade VARCHAR(50),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS work_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS cost_center VARCHAR(50),
  ADD COLUMN IF NOT EXISTS business_unit VARCHAR(100),
  ADD COLUMN IF NOT EXISTS medical_clearance_expiry DATE,
  ADD COLUMN IF NOT EXISTS ppe_requirements TEXT[],
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS overtime_eligible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS skills TEXT[],
  ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  pattern shift_pattern DEFAULT 'fixed',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  is_night BOOLEAN DEFAULT false,
  is_weekend BOOLEAN DEFAULT false,
  color VARCHAR(20) DEFAULT '#0D7377',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES shift_templates(id),
  work_date DATE NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'scheduled',
  location VARCHAR(255),
  notes TEXT,
  assigned_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, work_date, shift_template_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_assign_date ON shift_assignments(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_assign_emp ON shift_assignments(employee_id, work_date);

-- ============================================================
-- ATTENDANCE (enhance existing attendance_records)
-- ============================================================
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS method attendance_method DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS check_in_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS check_in_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS check_out_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS check_out_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS productive_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idle_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_assignment_id UUID REFERENCES shift_assignments(id),
  ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';

-- ============================================================
-- OVERTIME
-- ============================================================
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL,
  rate_multiplier DECIMAL(4,2) DEFAULT 1.5,
  reason TEXT,
  status overtime_status DEFAULT 'pending',
  estimated_cost DECIMAL(14,2),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SKILLS & TRAINING
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skill_catalog(id) ON DELETE CASCADE,
  proficiency INTEGER DEFAULT 3 CHECK (proficiency BETWEEN 1 AND 5),
  certified BOOLEAN DEFAULT false,
  certified_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, skill_id)
);

CREATE TABLE IF NOT EXISTS training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  provider VARCHAR(150),
  completed_on DATE,
  expires_on DATE,
  certificate_url TEXT,
  status VARCHAR(30) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAFETY & COMPLIANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS safety_inductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  induction_type VARCHAR(100) NOT NULL,
  completed_on DATE NOT NULL,
  valid_until DATE,
  facilitator VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ppe_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  item_name VARCHAR(150) NOT NULL,
  quantity INTEGER DEFAULT 1,
  issued_on DATE NOT NULL DEFAULT CURRENT_DATE,
  return_due DATE,
  status VARCHAR(30) DEFAULT 'issued',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES employees(id),
  employee_id UUID REFERENCES employees(id),
  incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location VARCHAR(255),
  severity safety_incident_severity DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(30) DEFAULT 'open',
  actions_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FIELD WORKFORCE
-- ============================================================
CREATE TABLE IF NOT EXISTS field_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  address TEXT,
  assigned_to UUID REFERENCES employees(id),
  status field_job_status DEFAULT 'assigned',
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  gps_lat DECIMAL(10,7),
  gps_lng DECIMAL(10,7),
  customer_signature_url TEXT,
  photo_urls TEXT[],
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

-- ============================================================
-- LABOR COST SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS labor_cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  work_date DATE NOT NULL,
  department VARCHAR(100),
  cost_center VARCHAR(50),
  production_line VARCHAR(100),
  regular_hours DECIMAL(6,2) DEFAULT 0,
  overtime_hours DECIMAL(6,2) DEFAULT 0,
  regular_cost DECIMAL(14,2) DEFAULT 0,
  overtime_cost DECIMAL(14,2) DEFAULT 0,
  total_cost DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  source VARCHAR(50) DEFAULT 'attendance',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_cost_date ON labor_cost_entries(company_id, work_date);

-- ============================================================
-- WORKFORCE PLANNING HINTS (AI recommendations storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS workforce_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT NOT NULL,
  work_date DATE,
  department VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Workforce', 'wfm.view', 'wfm', 'View workforce dashboards'),
  ('Manage Workforce', 'wfm.manage', 'wfm', 'Manage shifts, attendance, planning'),
  ('Approve Workforce', 'wfm.approve', 'wfm', 'Approve leave, overtime, swaps'),
  ('View Field Workforce', 'wfm.field', 'wfm', 'Field jobs and GPS tracking'),
  ('Manage Safety', 'wfm.safety', 'wfm', 'Safety and PPE compliance')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'wfm.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_inductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppe_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_templates_all ON shift_templates FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY shift_assignments_all ON shift_assignments FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY overtime_all ON overtime_requests FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY skill_catalog_all ON skill_catalog FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY employee_skills_all ON employee_skills FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY training_all ON training_records FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY safety_ind_all ON safety_inductions FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY ppe_all ON ppe_issuances FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY incidents_all ON safety_incidents FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY field_jobs_all ON field_jobs FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY labor_cost_all ON labor_cost_entries FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY wfm_insights_all ON workforce_insights FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());

-- Seed default shifts for Hope Design
INSERT INTO shift_templates (company_id, code, name, pattern, start_time, end_time, break_minutes, is_night)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'MORNING', 'Morning Shift', 'fixed', '06:00', '14:00', 45, false),
  ('a0000000-0000-4000-8000-000000000001', 'AFTERNOON', 'Afternoon Shift', 'fixed', '14:00', '22:00', 45, false),
  ('a0000000-0000-4000-8000-000000000001', 'NIGHT', 'Night Shift', 'night', '22:00', '06:00', 45, true),
  ('a0000000-0000-4000-8000-000000000001', 'GENERAL', 'General Office', 'flexible', '08:00', '17:00', 60, false)
ON CONFLICT DO NOTHING;

INSERT INTO skill_catalog (company_id, code, name, category) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'PRINT-OP', 'Security Press Operator', 'Manufacturing'),
  ('a0000000-0000-4000-8000-000000000001', 'QC-INSP', 'Quality Inspector', 'Quality'),
  ('a0000000-0000-4000-8000-000000000001', 'FORKLIFT', 'Forklift Certified', 'Warehouse'),
  ('a0000000-0000-4000-8000-000000000001', 'ELEC-ENG', 'Electrical Engineer', 'Engineering'),
  ('a0000000-0000-4000-8000-000000000001', 'FIELD-TECH', 'Field Technician', 'Field Service')
ON CONFLICT DO NOTHING;

INSERT INTO workforce_insights (company_id, insight_type, severity, title, recommendation, work_date, department)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'staffing_shortage',
    'high',
    'Production Line coverage risk',
    'Production is projected to need additional machine operators. Recommend cross-training warehouse staff with PRINT-OP certification and pre-approving overtime for the night shift.',
    CURRENT_DATE + 2,
    'Production'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'overtime_forecast',
    'medium',
    'Overtime cost forecast rising',
    'Overtime hours trend up 12% week-over-week. Balance load across morning and afternoon shifts; defer non-critical maintenance to weekend flexible shift.',
    CURRENT_DATE + 1,
    'Operations'
  )
ON CONFLICT DO NOTHING;
