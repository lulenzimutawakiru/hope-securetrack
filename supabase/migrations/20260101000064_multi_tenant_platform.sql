-- SecureTrack ERP — Multi-tenant platform foundation
-- Tenants (SaaS orgs) · multi-company memberships · active company context · RLS helpers

-- ============================================================
-- TENANTS (top-level isolation unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  status VARCHAR(30) DEFAULT 'active',
  -- trial | active | suspended | cancelled
  plan_code VARCHAR(40) DEFAULT 'enterprise',
  max_companies INTEGER DEFAULT 50,
  max_users INTEGER DEFAULT 1000,
  primary_currency VARCHAR(10) DEFAULT 'UGX',
  country_code VARCHAR(5) DEFAULT 'UG',
  timezone VARCHAR(60) DEFAULT 'Africa/Kampala',
  logo_url TEXT,
  primary_contact_email VARCHAR(255),
  branding JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  trial_ends_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- ============================================================
-- COMPANIES → TENANT
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_role VARCHAR(40) DEFAULT 'operating',
  -- holding | operating | subsidiary | branch_legal
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'UGX';

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);

-- ============================================================
-- USER PROFILE CONTEXT
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active_company ON user_profiles(active_company_id);

-- ============================================================
-- MULTI-COMPANY MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS user_company_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  -- active | invited | suspended | left
  title VARCHAR(150),
  invited_by UUID REFERENCES user_profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_ucm_user ON user_company_memberships(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ucm_company ON user_company_memberships(company_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ucm_tenant ON user_company_memberships(tenant_id);

-- ============================================================
-- TENANT AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(60) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS HELPERS (active company context)
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(up.active_company_id, up.company_id)
  FROM user_profiles up
  WHERE up.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    up.tenant_id,
    (SELECT c.tenant_id FROM companies c WHERE c.id = COALESCE(up.active_company_id, up.company_id))
  )
  FROM user_profiles up
  WHERE up.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.is_platform_admin = true
        OR EXISTS (
          SELECT 1 FROM roles r
          WHERE r.id = up.role_id AND r.slug = 'super_administrator'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_platform_admin()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (up.company_id = p_company_id OR up.active_company_id = p_company_id)
    )
    OR EXISTS (
      SELECT 1 FROM user_company_memberships m
      WHERE m.user_id = auth.uid()
        AND m.company_id = p_company_id
        AND m.status = 'active'
    )
$$;

-- Switch active company (membership or home company required)
CREATE OR REPLACE FUNCTION public.switch_active_company(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  allowed BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.user_has_company_access(p_company_id) INTO allowed;
  IF NOT allowed THEN
    RAISE EXCEPTION 'No access to company %', p_company_id;
  END IF;

  UPDATE user_profiles
  SET
    active_company_id = p_company_id,
    company_id = p_company_id,
    tenant_id = COALESCE(
      (SELECT tenant_id FROM companies WHERE id = p_company_id),
      tenant_id
    )
  WHERE id = uid;

  INSERT INTO tenant_audit (tenant_id, company_id, actor_id, action, details)
  SELECT c.tenant_id, p_company_id, uid, 'switch_company', 'Active company switched'
  FROM companies c WHERE c.id = p_company_id;

  RETURN p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_active_company(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR id = public.user_tenant_id()
  );

DROP POLICY IF EXISTS tenants_all_admin ON tenants;
CREATE POLICY tenants_all_admin ON tenants FOR ALL
  USING (public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS ucm_select ON user_company_memberships;
CREATE POLICY ucm_select ON user_company_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.is_super_admin()
    OR company_id = public.user_company_id()
  );

DROP POLICY IF EXISTS ucm_manage ON user_company_memberships;
CREATE POLICY ucm_manage ON user_company_memberships FOR ALL
  USING (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR (
      company_id = public.user_company_id()
      AND public.has_permission('users.manage')
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR (
      company_id = public.user_company_id()
      AND public.has_permission('users.manage')
    )
  );

DROP POLICY IF EXISTS tenant_audit_select ON tenant_audit;
CREATE POLICY tenant_audit_select ON tenant_audit FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR tenant_id = public.user_tenant_id()
    OR company_id = public.user_company_id()
  );

DROP POLICY IF EXISTS tenant_audit_insert ON tenant_audit;
CREATE POLICY tenant_audit_insert ON tenant_audit FOR INSERT
  WITH CHECK (actor_id = auth.uid() OR public.is_platform_admin() OR public.is_super_admin());

-- Companies: allow members to see companies they belong to
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR id = public.user_company_id()
    OR tenant_id = public.user_tenant_id()
    OR EXISTS (
      SELECT 1 FROM user_company_memberships m
      WHERE m.user_id = auth.uid()
        AND m.company_id = companies.id
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert ON companies FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR public.has_permission('settings.manage')
  );

DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies FOR UPDATE
  USING (
    public.is_platform_admin()
    OR public.is_super_admin()
    OR (id = public.user_company_id() AND public.has_permission('settings.manage'))
  );

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Tenant View', 'tenant.view', 'tenant', 'View tenant and company memberships'),
  ('Tenant Manage', 'tenant.manage', 'tenant', 'Manage tenant settings and companies'),
  ('Tenant Admin', 'tenant.admin', 'tenant', 'Platform tenant administration'),
  ('Company Switch', 'tenant.switch', 'tenant', 'Switch active company context')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug)
  AND NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('tenant.view', 'tenant.manage', 'tenant.admin', 'tenant.switch')
  AND r.slug IN ('super_administrator', 'managing_director', 'hr_manager', 'finance_manager', 'auditor')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- SEED: default tenant + memberships from existing profiles
-- ============================================================
DO $$
DECLARE
  tid UUID;
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  cname TEXT;
BEGIN
  -- Prefer existing demo company if present
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id, name INTO cid, cname FROM companies WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1;
  ELSE
    SELECT name INTO cname FROM companies WHERE id = cid;
  END IF;

  IF cid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO tenants (id, slug, name, legal_name, status, plan_code, primary_currency, country_code, settings)
  VALUES (
    'b0000000-0000-4000-8000-000000000001',
    'hope-design',
    COALESCE(cname, 'Hope Design Group'),
    'Hope Design Group Ltd',
    'active',
    'enterprise',
    'UGX',
    'UG',
    '{"product":"SecureTrack ERP","modules":"all"}'::jsonb
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
  RETURNING id INTO tid;

  IF tid IS NULL THEN
    SELECT id INTO tid FROM tenants WHERE slug = 'hope-design';
  END IF;

  UPDATE companies
  SET tenant_id = tid, is_primary = true, updated_at = NOW()
  WHERE id = cid;

  -- Attach other companies without tenant to same demo tenant (single-tenant migration path)
  UPDATE companies
  SET tenant_id = tid
  WHERE tenant_id IS NULL;

  -- Sync profile tenant + active company
  UPDATE user_profiles up
  SET
    tenant_id = COALESCE(up.tenant_id, c.tenant_id, tid),
    active_company_id = COALESCE(up.active_company_id, up.company_id),
    is_platform_admin = CASE
      WHEN EXISTS (
        SELECT 1 FROM roles r WHERE r.id = up.role_id AND r.slug = 'super_administrator'
      ) THEN true
      ELSE COALESCE(up.is_platform_admin, false)
    END
  FROM companies c
  WHERE c.id = up.company_id;

  -- Memberships for every profile home company
  INSERT INTO user_company_memberships (user_id, company_id, tenant_id, role_id, is_default, status)
  SELECT
    up.id,
    up.company_id,
    COALESCE(up.tenant_id, tid),
    up.role_id,
    true,
    'active'
  FROM user_profiles up
  WHERE up.company_id IS NOT NULL
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- Optional second demo company under same tenant for multi-company switching
  IF NOT EXISTS (SELECT 1 FROM companies WHERE code = 'HDG-LOG') THEN
    INSERT INTO companies (
      id, name, code, legal_name, country, city,
      company_type, tenant_id, is_primary, is_active, base_currency
    )
    VALUES (
      'a0000000-0000-4000-8000-000000000002',
      'Hope Logistics Ltd',
      'HDG-LOG',
      'Hope Logistics Ltd',
      'Uganda',
      'Kampala',
      'subsidiary',
      tid,
      false,
      true,
      'UGX'
    )
    ON CONFLICT (code) DO NOTHING;
  END IF;

  -- Grant super-admins membership on all companies in tenant (for switcher)
  INSERT INTO user_company_memberships (user_id, company_id, tenant_id, role_id, is_default, status)
  SELECT up.id, c.id, tid, up.role_id, false, 'active'
  FROM user_profiles up
  JOIN roles r ON r.id = up.role_id AND r.slug = 'super_administrator'
  CROSS JOIN companies c
  WHERE c.tenant_id = tid
  ON CONFLICT (user_id, company_id) DO NOTHING;
END $$;
