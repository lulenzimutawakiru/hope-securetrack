-- SecureTrack ERP — Security controls: dual-control, MFA flags, portal token hash support

-- Dual-control / maker-checker requests
CREATE TABLE IF NOT EXISTS sec_dual_control_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  subject_type VARCHAR(80),
  subject_id UUID,
  maker_id UUID NOT NULL REFERENCES user_profiles(id),
  checker_id UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | rejected | executed | cancelled
  payload JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  checked_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_dc_company_status
  ON sec_dual_control_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_sec_dc_action
  ON sec_dual_control_requests(company_id, action, status);

ALTER TABLE sec_dual_control_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sec_dc_all ON sec_dual_control_requests;
CREATE POLICY sec_dc_all ON sec_dual_control_requests FOR ALL
  USING (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

-- Portal token hash column (prefer hash over plaintext long-term)
ALTER TABLE bill_portal_users
  ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_bill_portal_token_hash
  ON bill_portal_users(access_token_hash)
  WHERE access_token_hash IS NOT NULL;

-- Enforce MFA flags for privileged role holders (soft: set require_mfa)
UPDATE user_profiles up
SET require_mfa = true, mfa_enforced = true
FROM roles r
WHERE r.id = up.role_id
  AND r.slug IN (
    'super_administrator', 'managing_director', 'finance_manager',
    'hr_manager', 'payroll_officer', 'auditor'
  )
  AND (up.require_mfa IS DISTINCT FROM true OR up.mfa_enforced IS DISTINCT FROM true);

-- Security settings seed
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Dual Control Manage', 'security.dual_control', 'security', 'Create and approve dual-control requests'),
  ('Security Admin', 'security.admin', 'security', 'Security administration')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('security.dual_control', 'security.admin')
  AND r.slug IN ('super_administrator', 'managing_director', 'finance_manager', 'auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
