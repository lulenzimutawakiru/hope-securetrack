-- Hope Design Group — Enterprise Identity Management & User Provisioning
-- IDM · Provisioning · Multi-role · ABAC · Username rules · MFA policy · Approvals

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Provision Users', 'iam.provision', 'iam', 'Create and provision user accounts'),
  ('Bulk User Import', 'iam.import', 'iam', 'Bulk import users'),
  ('Manage Custom Roles', 'iam.roles', 'iam', 'Create custom roles and map permissions'),
  ('Manage ABAC Rules', 'iam.abac', 'iam', 'Attribute-based access control'),
  ('Reset Passwords', 'iam.password', 'iam', 'Force reset and temporary passwords'),
  ('MFA Administration', 'iam.mfa', 'iam', 'Configure MFA enforcement'),
  ('Identity Governance', 'iam.governance', 'iam', 'Access reviews and certifications')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'iam.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'hr_manager','hr_officer','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND USER PROFILES (IDM fields)
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(40) DEFAULT 'employee',
  -- employee | manager | administrator | customer | supplier | contractor | partner | auditor | guest
  ADD COLUMN IF NOT EXISTS division VARCHAR(100),
  ADD COLUMN IF NOT EXISTS team_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(40) DEFAULT 'active',
  -- active | pending_activation | suspended | locked | disabled | expired
  ADD COLUMN IF NOT EXISTS account_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_token VARCHAR(100),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_from VARCHAR(40) DEFAULT 'manual',
  -- manual | hr_onboarding | customer | supplier | project | api | bulk | ad_sync
  ADD COLUMN IF NOT EXISTS employee_record_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_scope VARCHAR(40) DEFAULT 'company',
  -- own | department | branch | company | all
  ADD COLUMN IF NOT EXISTS login_allowed_ips TEXT,
  ADD COLUMN IF NOT EXISTS require_mfa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_methods TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS temp_password_set BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username
  ON user_profiles(company_id, username) WHERE username IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(company_id, account_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_type ON user_profiles(company_id, user_type);

-- ============================================================
-- USERNAME GENERATION RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_username_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  pattern VARCHAR(100) NOT NULL DEFAULT 'firstname.lastname',
  -- firstname.lastname | employee.number | department.employee | email.prefix | custom
  custom_template VARCHAR(150),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

-- ============================================================
-- MULTI-ROLE ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES user_profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_idm_user_roles_user ON idm_user_roles(user_id);

-- ============================================================
-- CUSTOM ROLE BUILDER META (extends roles)
-- ============================================================
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS role_category VARCHAR(50) DEFAULT 'system',
  -- system | custom | temporary | external
  ADD COLUMN IF NOT EXISTS data_scope_default VARCHAR(40) DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- ABAC RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_abac_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- e.g. {"department":"Finance","role_slug":"accountant"}
  effect VARCHAR(20) NOT NULL DEFAULT 'allow',
  -- allow | deny
  permission_slugs TEXT[] DEFAULT ARRAY[]::TEXT[],
  action_label VARCHAR(100),
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

-- ============================================================
-- ACCOUNT PROVISIONING REQUESTS + APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_provision_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_number VARCHAR(50) NOT NULL,
  source VARCHAR(40) DEFAULT 'manual',
  -- manual | hr_onboarding | bulk | api | customer | supplier
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | manager_approved | security_review | admin_approved | activated | rejected | cancelled
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  username VARCHAR(100),
  user_type VARCHAR(40) DEFAULT 'employee',
  employee_id VARCHAR(50),
  employee_record_id UUID REFERENCES employees(id),
  department VARCHAR(100),
  division VARCHAR(100),
  team_name VARCHAR(100),
  branch_name VARCHAR(150),
  location_name VARCHAR(150),
  cost_center VARCHAR(50),
  job_title VARCHAR(150),
  role_id UUID REFERENCES roles(id),
  role_ids UUID[] DEFAULT ARRAY[]::UUID[],
  manager_user_id UUID REFERENCES user_profiles(id),
  requested_by UUID REFERENCES user_profiles(id),
  manager_approved_by UUID REFERENCES user_profiles(id),
  manager_approved_at TIMESTAMPTZ,
  security_reviewed_by UUID REFERENCES user_profiles(id),
  security_reviewed_at TIMESTAMPTZ,
  admin_approved_by UUID REFERENCES user_profiles(id),
  admin_approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES user_profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  provisioned_user_id UUID REFERENCES user_profiles(id),
  temp_password_hint TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_idm_provision_status ON idm_provision_requests(company_id, status);

-- ============================================================
-- PASSWORD HISTORY + RESET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idm_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  forced BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MFA POLICY
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_mfa_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL DEFAULT 'Default MFA Policy',
  require_admins BOOLEAN DEFAULT true,
  require_finance BOOLEAN DEFAULT true,
  require_remote BOOLEAN DEFAULT true,
  require_all_employees BOOLEAN DEFAULT false,
  allow_email_otp BOOLEAN DEFAULT true,
  allow_sms_otp BOOLEAN DEFAULT true,
  allow_authenticator BOOLEAN DEFAULT true,
  allow_security_keys BOOLEAN DEFAULT false,
  allow_biometrics BOOLEAN DEFAULT false,
  allow_push BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- ============================================================
-- BULK IMPORT BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'processing',
  -- processing | completed | failed | partial
  errors JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

-- ============================================================
-- ACCESS GOVERNANCE / CERTIFICATION
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_access_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_progress | completed | cancelled
  due_date DATE,
  reviewer_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, review_number)
);

CREATE TABLE IF NOT EXISTS idm_access_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES idm_access_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  decision VARCHAR(30) DEFAULT 'pending',
  -- pending | certify | revoke | modify
  notes TEXT,
  decided_by UUID REFERENCES user_profiles(id),
  decided_at TIMESTAMPTZ
);

-- ============================================================
-- IDENTITY AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS idm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  target_user_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  -- create | update | suspend | activate | lock | unlock | reset_password | assign_role | provision | import | delete
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idm_audit_created ON idm_audit(created_at DESC);

-- ============================================================
-- EXTEND SECURITY POLICIES
-- ============================================================
ALTER TABLE security_policies
  ADD COLUMN IF NOT EXISTS force_reset_on_first_login BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS temp_password_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS username_rule_code VARCHAR(50) DEFAULT 'firstname.lastname',
  ADD COLUMN IF NOT EXISTS require_account_approval BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mfa_required_for_finance BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mfa_required_for_remote BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mfa_required_for_all BOOLEAN DEFAULT false;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'idm_username_rules','idm_user_roles','idm_abac_rules','idm_provision_requests',
    'idm_password_history','idm_password_resets','idm_mfa_policies','idm_import_batches',
    'idm_access_reviews','idm_access_review_items','idm_audit'
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
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO idm_username_rules (company_id, rule_code, name, pattern, is_default)
  VALUES
    (cid, 'firstname.lastname', 'First.Last', 'firstname.lastname', true),
    (cid, 'employee.number', 'Employee Number', 'employee.number', false),
    (cid, 'department.employee', 'Dept + Number', 'department.employee', false),
    (cid, 'email.prefix', 'Email Prefix', 'email.prefix', false)
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO idm_mfa_policies (company_id, name, require_admins, require_finance, require_remote, require_all_employees)
  VALUES (cid, 'Hope Design MFA Policy', true, true, true, false)
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO idm_abac_rules (company_id, rule_code, name, description, conditions, effect, permission_slugs, action_label, priority)
  VALUES
    (cid, 'FIN-INV-APPR', 'Finance Invoice Approval',
     'Accountants in Finance may approve invoices',
     '{"department":"Finance","role_contains":"accountant"}'::jsonb,
     'allow', ARRAY['billing.approve','invoices.manage'], 'Invoice Approval', 10),
    (cid, 'HR-ONLY-PAY', 'HR Payroll Access',
     'Only HR can view payroll profile data',
     '{"department":"HR"}'::jsonb,
     'allow', ARRAY['profile.payroll','hr.payroll'], 'Payroll View', 20),
    (cid, 'DENY-GUEST-ADMIN', 'Deny Guest Admin',
     'Guests cannot access admin modules',
     '{"user_type":"guest"}'::jsonb,
     'deny', ARRAY['iam.manage','settings.manage','finance.manage'], 'Block Admin', 5)
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  -- Backfill multi-role primary from user_profiles.role_id
  INSERT INTO idm_user_roles (company_id, user_id, role_id, is_primary)
  SELECT up.company_id, up.id, up.role_id, true
  FROM user_profiles up
  WHERE up.company_id = cid
    AND NOT EXISTS (
      SELECT 1 FROM idm_user_roles ur WHERE ur.user_id = up.id AND ur.role_id = up.role_id
    );

  -- Backfill username from email prefix where missing
  UPDATE user_profiles
  SET username = split_part(email, '@', 1)
  WHERE company_id = cid AND (username IS NULL OR username = '');

  UPDATE user_profiles
  SET account_status = CASE
    WHEN NOT is_active THEN 'suspended'
    WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN 'locked'
    ELSE COALESCE(account_status, 'active')
  END
  WHERE company_id = cid;

END $$;
