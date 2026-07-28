-- Hope Design Group Ltd — Enterprise User & Identity Management (IAM)
-- Authentication foundation: RBAC, sessions, MFA flags, approval matrix, security alerts

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE account_lifecycle AS ENUM (
  'requested','approved','provisioned','active','suspended','reactivated','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE user_kind AS ENUM (
  'internal','external_supplier','external_customer','external_contractor',
  'external_auditor','external_partner','external_regulator'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND USER PROFILES
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS user_kind user_kind DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS lifecycle_status account_lifecycle DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS job_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS national_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS date_joined DATE,
  ADD COLUMN IF NOT EXISTS contract_expiry DATE,
  ADD COLUMN IF NOT EXISTS supervisor_user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_device TEXT,
  ADD COLUMN IF NOT EXISTS last_login_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS cost_center VARCHAR(50),
  ADD COLUMN IF NOT EXISTS external_org_name VARCHAR(255);

-- ============================================================
-- PASSWORD / SECURITY POLICY (company-level)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  min_password_length INTEGER DEFAULT 10,
  require_uppercase BOOLEAN DEFAULT true,
  require_number BOOLEAN DEFAULT true,
  require_special BOOLEAN DEFAULT true,
  password_history_count INTEGER DEFAULT 5,
  password_expiry_days INTEGER DEFAULT 90,
  max_failed_logins INTEGER DEFAULT 5,
  lockout_minutes INTEGER DEFAULT 30,
  session_timeout_minutes INTEGER DEFAULT 480,
  max_concurrent_sessions INTEGER DEFAULT 5,
  mfa_required_for_admins BOOLEAN DEFAULT true,
  allow_external_users BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

INSERT INTO security_policies (company_id)
VALUES ('a0000000-0000-4000-8000-000000000001')
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================
-- USER SESSIONS (app-tracked)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_token_hash VARCHAR(128),
  ip_address INET,
  user_agent TEXT,
  device_label VARCHAR(150),
  location_hint VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, is_active);

-- ============================================================
-- LOGIN HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  email VARCHAR(255),
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  location_hint VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);

-- ============================================================
-- APPROVAL AUTHORITY MATRIX
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_authority (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  document_type VARCHAR(50) NOT NULL,
  max_amount DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  department VARCHAR(100),
  branch_code VARCHAR(50),
  is_unlimited BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO approval_authority (company_id, document_type, max_amount, currency, is_unlimited)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'purchase_order', 5000000, 'UGX', false),
  ('a0000000-0000-4000-8000-000000000001', 'purchase_order', 100000000, 'UGX', false),
  ('a0000000-0000-4000-8000-000000000001', 'purchase_order', NULL, 'UGX', true),
  ('a0000000-0000-4000-8000-000000000001', 'sales_discount', 10, 'PCT', false),
  ('a0000000-0000-4000-8000-000000000001', 'credit_release', 50000000, 'UGX', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECURITY ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open',
  resolved_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status, created_at DESC);

-- ============================================================
-- USER ROLE ASSIGNMENTS HISTORY (SoD audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  old_role_id UUID REFERENCES roles(id),
  new_role_id UUID REFERENCES roles(id),
  changed_by UUID REFERENCES user_profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Identity', 'iam.view', 'iam', 'View users and identity dashboards'),
  ('Manage Identity', 'iam.manage', 'iam', 'Create/edit users and roles'),
  ('Manage Security', 'iam.security', 'iam', 'Security policies, MFA, alerts'),
  ('View Sessions', 'iam.sessions', 'iam', 'View and revoke sessions'),
  ('Manage Approvals Matrix', 'iam.approvals', 'iam', 'Configure approval authority')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'iam.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE security_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_policies_select ON security_policies FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY security_policies_update ON security_policies FOR UPDATE
  USING (company_id = public.user_company_id() AND public.has_permission('iam.security'));

CREATE POLICY user_sessions_select ON user_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    OR (company_id = public.user_company_id() AND public.has_any_permission(ARRAY['iam.view','iam.sessions','iam.manage']))
  );
CREATE POLICY user_sessions_insert_self ON user_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_sessions_update_self ON user_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY user_sessions_all_admin ON user_sessions FOR ALL
  USING (
    public.is_super_admin()
    OR (company_id = public.user_company_id() AND public.has_any_permission(ARRAY['iam.manage','iam.sessions']))
  )
  WITH CHECK (
    public.is_super_admin()
    OR company_id = public.user_company_id()
  );

CREATE POLICY login_history_select ON login_history FOR SELECT
  USING (
    user_id = auth.uid()
    OR (company_id = public.user_company_id() AND public.has_any_permission(ARRAY['iam.view','iam.security','audit.view']))
  );
CREATE POLICY login_history_insert ON login_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY approval_authority_all ON approval_authority FOR ALL
  USING (company_id = public.user_company_id())
  WITH CHECK (company_id = public.user_company_id());

CREATE POLICY security_alerts_all ON security_alerts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

CREATE POLICY user_role_changes_select ON user_role_changes FOR SELECT
  USING (company_id = public.user_company_id() AND public.has_any_permission(ARRAY['iam.view','audit.view']));
CREATE POLICY user_role_changes_insert ON user_role_changes FOR INSERT
  WITH CHECK (company_id = public.user_company_id());

-- Helper: record login
CREATE OR REPLACE FUNCTION public.record_login_event(
  p_user_id UUID,
  p_email TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_company UUID;
  v_id UUID;
  v_fails INTEGER;
  v_lockout INTEGER := 5;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT company_id INTO v_company FROM user_profiles WHERE id = p_user_id;
  END IF;

  INSERT INTO login_history (company_id, user_id, email, success, failure_reason, ip_address, user_agent)
  VALUES (v_company, p_user_id, p_email, p_success, p_failure_reason, p_ip, p_user_agent)
  RETURNING id INTO v_id;

  IF p_user_id IS NOT NULL THEN
    IF p_success THEN
      UPDATE user_profiles SET
        failed_login_count = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        last_login_ip = COALESCE(p_ip, last_login_ip),
        last_login_user_agent = COALESCE(p_user_agent, last_login_user_agent)
      WHERE id = p_user_id;
    ELSE
      UPDATE user_profiles SET
        failed_login_count = COALESCE(failed_login_count, 0) + 1
      WHERE id = p_user_id
      RETURNING failed_login_count INTO v_fails;

      IF v_fails >= v_lockout THEN
        UPDATE user_profiles SET locked_until = NOW() + INTERVAL '30 minutes'
        WHERE id = p_user_id;
        INSERT INTO security_alerts (company_id, user_id, alert_type, severity, title, description, ip_address)
        VALUES (
          v_company, p_user_id, 'brute_force', 'high',
          'Account locked after failed logins',
          'User exceeded max failed login attempts and was temporarily locked.',
          p_ip
        );
      END IF;
    END IF;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_login_event(UUID, TEXT, BOOLEAN, TEXT, INET, TEXT) TO authenticated, anon, service_role;
