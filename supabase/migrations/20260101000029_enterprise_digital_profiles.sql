-- Hope Design Group — Enterprise Digital Employee Profile Platform
-- 360° profile · documents · skills · timeline · visibility · self-service · audit

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Profiles', 'profile.view', 'profiles', 'View employee digital profiles'),
  ('Manage Profiles', 'profile.manage', 'profiles', 'Create and edit profiles'),
  ('Profile Self-Service', 'profile.self', 'profiles', 'Employee self-service portal'),
  ('Profile Manager View', 'profile.manager', 'profiles', 'Manager team profile view'),
  ('Profile Payroll View', 'profile.payroll', 'profiles', 'View payroll section of profile'),
  ('Profile Documents', 'profile.documents', 'profiles', 'Manage profile documents'),
  ('Profile Security', 'profile.security', 'profiles', 'Security clearance & access profile'),
  ('Profile Analytics', 'profile.analytics', 'profiles', 'Profile completion analytics'),
  ('Profile AI', 'profile.ai', 'profiles', 'AI profile assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'profile.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'hr_manager','hr_officer','production_manager','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Self-service for all active staff roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug = 'profile.self'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND EMPLOYEES → DIGITAL PROFILE MASTER
-- ============================================================
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS alt_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
  ADD COLUMN IF NOT EXISTS languages TEXT,
  ADD COLUMN IF NOT EXISTS residential_address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_relationship VARCHAR(80),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS division VARCHAR(100),
  ADD COLUMN IF NOT EXISTS team_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cost_center VARCHAR(80),
  ADD COLUMN IF NOT EXISTS work_location VARCHAR(150),
  ADD COLUMN IF NOT EXISTS manager_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_grade VARCHAR(50),
  ADD COLUMN IF NOT EXISTS position_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS responsibilities TEXT,
  ADD COLUMN IF NOT EXISTS job_description TEXT,
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS experience_years DECIMAL(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS working_hours VARCHAR(80) DEFAULT '08:00-17:00',
  ADD COLUMN IF NOT EXISTS security_clearance VARCHAR(50) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS login_risk_score DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_completion_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(30) DEFAULT 'department',
  -- everyone | department | manager | hr | private
  ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payroll_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(60) DEFAULT 'Africa/Kampala';

CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_deleted ON employees(company_id) WHERE deleted_at IS NULL;

-- ============================================================
-- EMPLOYMENT TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  -- joined | confirmed | promotion | transfer | department_change | salary_change
  -- role_change | contract_renewal | resignation | termination | recognition | warning
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_value TEXT,
  to_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_timeline_emp ON profile_timeline(employee_id, event_date DESC);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  -- national_id | passport | contract | certificate | academic | license
  -- medical | training | appraisal | other
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  mime_type VARCHAR(100),
  file_size_bytes INTEGER,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  -- active | pending_approval | rejected | expired | archived
  issued_on DATE,
  expires_on DATE,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_docs_emp ON profile_documents(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profile_docs_expiry ON profile_documents(company_id, expires_on)
  WHERE deleted_at IS NULL AND expires_on IS NOT NULL;

-- ============================================================
-- CERTIFICATIONS (profile-level, complements training)
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  certificate_name VARCHAR(255) NOT NULL,
  issuing_org VARCHAR(255),
  certificate_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE,
  verification_url TEXT,
  document_id UUID REFERENCES profile_documents(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'active',
  -- active | expired | revoked | pending
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_certs_expiry ON profile_certifications(company_id, expiry_date);

-- ============================================================
-- EXTENDED SKILLS (soft + technical beyond skill_catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  skill_name VARCHAR(150) NOT NULL,
  skill_category VARCHAR(40) DEFAULT 'technical',
  -- technical | soft | language | tool | domain
  level_label VARCHAR(30) DEFAULT 'intermediate',
  -- beginner | intermediate | advanced | expert
  level_score INTEGER DEFAULT 3 CHECK (level_score BETWEEN 1 AND 5),
  years_experience DECIMAL(5,1) DEFAULT 0,
  certified BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, skill_name, skill_category)
);

-- ============================================================
-- PROJECT ASSIGNMENTS (profile view)
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_code VARCHAR(50),
  project_name VARCHAR(255) NOT NULL,
  role_on_project VARCHAR(150),
  progress_pct DECIMAL(5,2) DEFAULT 0,
  hours_worked DECIMAL(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  deliverables TEXT,
  performance_note TEXT,
  bill_project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISIBILITY & CONSENT
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  field_group VARCHAR(50) NOT NULL,
  -- personal | contact | employment | skills | documents | performance | public_bio
  visibility VARCHAR(30) NOT NULL DEFAULT 'department',
  -- everyone | department | manager | hr | private | self
  UNIQUE(employee_id, field_group)
);

CREATE TABLE IF NOT EXISTS profile_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL,
  -- data_processing | photo_use | marketing | background_check | biometric
  granted BOOLEAN DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, consent_type)
);

-- ============================================================
-- SELF-SERVICE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  request_type VARCHAR(40) NOT NULL,
  -- profile_update | document_upload | id_replacement | leave | expense
  -- asset | support | training | data_correction
  title VARCHAR(255) NOT NULL,
  description TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | completed | cancelled
  priority VARCHAR(20) DEFAULT 'normal',
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

-- ============================================================
-- COMPLETION SNAPSHOTS + AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE UNIQUE,
  completion_pct DECIMAL(5,2) DEFAULT 0,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  completed_fields JSONB DEFAULT '[]'::jsonb,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  -- view | create | update | delete | restore | export | approve | login_link
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(60),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_audit_emp ON profile_audit(employee_id, created_at DESC);

-- ============================================================
-- SECURITY PROFILE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  user_id UUID REFERENCES user_profiles(id),
  event_type VARCHAR(50) NOT NULL,
  -- login | failed_login | mfa | password_change | access_denied | device | clearance_change
  severity VARCHAR(20) DEFAULT 'info',
  message TEXT,
  device_info TEXT,
  ip_address VARCHAR(60),
  risk_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_timeline','profile_documents','profile_certifications','profile_skills',
    'profile_projects','profile_visibility','profile_consents','profile_requests',
    'profile_completion','profile_audit','profile_security_events'
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
-- SEED: backfill timeline + completion for existing employees
-- ============================================================
DO $$
DECLARE
  cid UUID;
  emp_row RECORD;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  FOR emp_row IN SELECT * FROM employees WHERE company_id = cid LOOP
    -- Joining event
    IF emp_row.hire_date IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profile_timeline t WHERE t.employee_id = emp_row.id AND t.event_type = 'joined'
    ) THEN
      INSERT INTO profile_timeline (company_id, employee_id, event_type, title, description, event_date)
      VALUES (cid, emp_row.id, 'joined', 'Joined Company',
        COALESCE(emp_row.job_title, 'Employee') || ' · ' || COALESCE(emp_row.department, 'General'),
        emp_row.hire_date);
    END IF;

    IF emp_row.confirmation_date IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profile_timeline t WHERE t.employee_id = emp_row.id AND t.event_type = 'confirmed'
    ) THEN
      INSERT INTO profile_timeline (company_id, employee_id, event_type, title, event_date)
      VALUES (cid, emp_row.id, 'confirmed', 'Confirmed employment', emp_row.confirmation_date);
    END IF;

    -- Default visibility
    INSERT INTO profile_visibility (company_id, employee_id, field_group, visibility)
    VALUES
      (cid, emp_row.id, 'personal', 'hr'),
      (cid, emp_row.id, 'contact', 'department'),
      (cid, emp_row.id, 'employment', 'department'),
      (cid, emp_row.id, 'skills', 'everyone'),
      (cid, emp_row.id, 'documents', 'hr'),
      (cid, emp_row.id, 'performance', 'manager'),
      (cid, emp_row.id, 'public_bio', 'everyone')
    ON CONFLICT (employee_id, field_group) DO NOTHING;

    -- Default consents
    INSERT INTO profile_consents (company_id, employee_id, consent_type, granted, granted_at)
    VALUES
      (cid, emp_row.id, 'data_processing', true, NOW()),
      (cid, emp_row.id, 'photo_use', false, NULL)
    ON CONFLICT (employee_id, consent_type) DO NOTHING;

    -- Sample skills for first few
    INSERT INTO profile_skills (company_id, employee_id, skill_name, skill_category, level_label, level_score, years_experience)
    SELECT cid, emp_row.id, s.name, s.cat, s.lvl, s.score, s.yrs
    FROM (VALUES
      ('Manufacturing', 'technical', 'advanced', 4, 3.0),
      ('Communication', 'soft', 'intermediate', 3, 5.0),
      ('Quality Control', 'domain', 'intermediate', 3, 2.0)
    ) AS s(name, cat, lvl, score, yrs)
    WHERE NOT EXISTS (SELECT 1 FROM profile_skills ps WHERE ps.employee_id = emp_row.id AND ps.skill_name = s.name)
    LIMIT 3;

  END LOOP;

  -- Demo project for first employees
  INSERT INTO profile_projects (company_id, employee_id, project_code, project_name, role_on_project, progress_pct, hours_worked, status)
  SELECT cid, emp.id, 'PRJ-ERP-01', 'ERP Implementation', 'Process Contributor', 75, 120, 'active'
  FROM employees emp
  WHERE emp.company_id = cid
  AND NOT EXISTS (SELECT 1 FROM profile_projects p WHERE p.employee_id = emp.id AND p.project_code = 'PRJ-ERP-01')
  ORDER BY emp.created_at LIMIT 3;

END $$;
