-- SecureTrack ERP — Platform Core
-- Subscriptions · feature flags · domain events · provisioning jobs · platform modules · setup wizard

-- ============================================================
-- SUBSCRIPTIONS & PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  max_companies INTEGER DEFAULT 5,
  max_users INTEGER DEFAULT 50,
  max_storage_gb INTEGER DEFAULT 50,
  price_monthly DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  modules JSONB DEFAULT '["core"]'::jsonb,
  is_public BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_code VARCHAR(40) NOT NULL DEFAULT 'enterprise',
  status VARCHAR(30) DEFAULT 'active',
  -- trial | active | past_due | suspended | cancelled
  trial_ends_at TIMESTAMPTZ,
  current_period_start DATE DEFAULT CURRENT_DATE,
  current_period_end DATE,
  seats INTEGER DEFAULT 50,
  modules JSONB DEFAULT '[]'::jsonb,
  billing_email VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- FEATURE FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  default_enabled BOOLEAN DEFAULT false,
  category VARCHAR(50) DEFAULT 'module',
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, flag_key)
);

-- ============================================================
-- DOMAIN EVENTS (event-driven core)
-- ============================================================
CREATE TABLE IF NOT EXISTS domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type VARCHAR(120) NOT NULL,
  -- record.created | payroll.processed | invoice.paid | ...
  aggregate_type VARCHAR(80),
  aggregate_id UUID,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  branch_id UUID,
  actor_id UUID REFERENCES user_profiles(id),
  payload JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  severity VARCHAR(20) DEFAULT 'info',
  source_module VARCHAR(60),
  correlation_id UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_type ON domain_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_tenant ON domain_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_company ON domain_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);

-- ============================================================
-- TENANT PROVISIONING
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_provisioning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code VARCHAR(50) NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | running | completed | failed | partial
  organization_name VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  admin_name VARCHAR(150),
  country_code VARCHAR(5) DEFAULT 'UG',
  currency VARCHAR(10) DEFAULT 'UGX',
  plan_code VARCHAR(40) DEFAULT 'enterprise',
  steps_json JSONB DEFAULT '[]'::jsonb,
  result_json JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_setup_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  step_key VARCHAR(80) NOT NULL,
  step_label VARCHAR(150),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | in_progress | completed | skipped
  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id, step_key)
);

-- ============================================================
-- PLATFORM MODULE CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'operations',
  href VARCHAR(200),
  icon VARCHAR(60),
  is_core BOOLEAN DEFAULT false,
  default_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_code VARCHAR(60) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, module_code)
);

-- ============================================================
-- PLATFORM HEALTH / NOTIFICATIONS (global)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key VARCHAR(80) NOT NULL,
  status VARCHAR(30) DEFAULT 'healthy',
  -- healthy | degraded | down
  latency_ms INTEGER,
  details JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  audience VARCHAR(40) DEFAULT 'all',
  -- all | platform_admins | tenants
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'active',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform_plans','tenant_subscriptions','platform_feature_flags','tenant_feature_flags',
    'domain_events','tenant_provisioning_jobs','tenant_setup_progress','platform_modules',
    'tenant_modules','platform_health_checks','platform_announcements'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Platform-wide readable catalogs
DROP POLICY IF EXISTS platform_plans_read ON platform_plans;
CREATE POLICY platform_plans_read ON platform_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_modules_read ON platform_modules;
CREATE POLICY platform_modules_read ON platform_modules FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_flags_read ON platform_feature_flags;
CREATE POLICY platform_flags_read ON platform_feature_flags FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_announcements_read ON platform_announcements;
CREATE POLICY platform_announcements_read ON platform_announcements FOR SELECT
  USING (status = 'active' OR public.is_platform_admin() OR public.is_super_admin());

-- Tenant-scoped
DROP POLICY IF EXISTS tenant_subs_all ON tenant_subscriptions;
CREATE POLICY tenant_subs_all ON tenant_subscriptions FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS tenant_flags_all ON tenant_feature_flags;
CREATE POLICY tenant_flags_all ON tenant_feature_flags FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS tenant_modules_all ON tenant_modules;
CREATE POLICY tenant_modules_all ON tenant_modules FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS setup_progress_all ON tenant_setup_progress;
CREATE POLICY setup_progress_all ON tenant_setup_progress FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS domain_events_select ON domain_events;
CREATE POLICY domain_events_select ON domain_events FOR SELECT
  USING (
    public.is_platform_admin() OR public.is_super_admin()
    OR tenant_id = public.user_tenant_id()
    OR company_id = public.user_company_id()
  );

DROP POLICY IF EXISTS domain_events_insert ON domain_events;
CREATE POLICY domain_events_insert ON domain_events FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    OR public.is_platform_admin()
    OR public.is_super_admin()
    OR company_id IS NULL
  );

DROP POLICY IF EXISTS provision_jobs_admin ON tenant_provisioning_jobs;
CREATE POLICY provision_jobs_admin ON tenant_provisioning_jobs FOR ALL
  USING (public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin());

-- Allow insert for service role / authenticated provisioning (platform creates jobs)
DROP POLICY IF EXISTS provision_jobs_insert ON tenant_provisioning_jobs;
CREATE POLICY provision_jobs_insert ON tenant_provisioning_jobs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS health_admin ON platform_health_checks;
CREATE POLICY health_admin ON platform_health_checks FOR ALL
  USING (public.is_platform_admin() OR public.is_super_admin())
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin());

DROP POLICY IF EXISTS health_read ON platform_health_checks;
CREATE POLICY health_read ON platform_health_checks FOR SELECT
  USING (public.is_platform_admin() OR public.is_super_admin());

-- ============================================================
-- emit_domain_event helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.emit_domain_event(
  p_event_type VARCHAR,
  p_aggregate_type VARCHAR DEFAULT NULL,
  p_aggregate_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_source_module VARCHAR DEFAULT NULL,
  p_severity VARCHAR DEFAULT 'info'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eid UUID;
  tid UUID;
  cid UUID;
BEGIN
  tid := public.user_tenant_id();
  cid := public.user_company_id();
  INSERT INTO domain_events (
    event_type, aggregate_type, aggregate_id, tenant_id, company_id,
    actor_id, payload, source_module, severity
  )
  VALUES (
    p_event_type, p_aggregate_type, p_aggregate_id, tid, cid,
    auth.uid(), COALESCE(p_payload, '{}'::jsonb), p_source_module, p_severity
  )
  RETURNING id INTO eid;
  RETURN eid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_domain_event(VARCHAR, VARCHAR, UUID, JSONB, VARCHAR, VARCHAR) TO authenticated;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Platform View', 'platform.view', 'platform', 'View platform administration'),
  ('Platform Admin', 'platform.admin', 'platform', 'Full platform administration'),
  ('Platform Provision', 'platform.provision', 'platform', 'Provision new tenants'),
  ('Platform Events', 'platform.events', 'platform', 'View domain event stream'),
  ('Platform Flags', 'platform.flags', 'platform', 'Manage feature flags')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('platform.view','platform.admin','platform.provision','platform.events','platform.flags')
  AND r.slug IN ('super_administrator')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- SEED
-- ============================================================
INSERT INTO platform_plans (plan_code, name, description, max_companies, max_users, max_storage_gb, price_monthly, modules) VALUES
  ('starter', 'Starter', 'SMB starter plan', 1, 25, 25, 99, '["core","finance","sales","hr"]'::jsonb),
  ('professional', 'Professional', 'Growing mid-market', 5, 200, 200, 499, '["core","finance","sales","hr","payroll","inventory","crm"]'::jsonb),
  ('enterprise', 'Enterprise', 'Full SecureTrack ERP suite', 100, 10000, 2000, 2499, '["all"]'::jsonb),
  ('government', 'Government', 'Air-gapped / gov deployment', 50, 50000, 5000, 0, '["all"]'::jsonb)
ON CONFLICT (plan_code) DO NOTHING;

INSERT INTO platform_modules (module_code, name, description, category, href, is_core, sort_order) VALUES
  ('executive', 'Executive Dashboard', 'C-level KPIs and drill-down', 'intelligence', '/dashboard', true, 1),
  ('bi', 'Business Intelligence', 'Analytics and reports', 'intelligence', '/dashboard/reports', true, 2),
  ('finance', 'Finance & Accounting', 'GL, AP, AR, treasury', 'finance', '/dashboard/finance', true, 10),
  ('payroll', 'Payroll', 'Compensation and statutory', 'people', '/dashboard/payroll', false, 20),
  ('hr', 'Human Resources', 'Employee lifecycle', 'people', '/dashboard/hr', false, 21),
  ('talent', 'Recruitment', 'Talent acquisition ATS', 'people', '/dashboard/talent', false, 22),
  ('attendance', 'Workforce Attendance', 'Time and attendance', 'people', '/dashboard/attendance', false, 23),
  ('crm', 'CRM', 'Customer relationship', 'revenue', '/dashboard/crm', false, 30),
  ('sales', 'Sales', 'Orders and pipeline', 'revenue', '/dashboard/sales', false, 31),
  ('procurement', 'Procurement', 'Purchase and suppliers', 'supply', '/dashboard/procurement', false, 40),
  ('inventory', 'Inventory', 'Stock and warehouses', 'supply', '/dashboard/inventory', false, 41),
  ('manufacturing', 'Manufacturing', 'MES and production', 'ops', '/dashboard/production', false, 50),
  ('fleet', 'Fleet', 'Transport and logistics', 'ops', '/dashboard/fleet', false, 51),
  ('assets', 'Asset Management', 'Fixed assets', 'ops', '/dashboard/assets', false, 52),
  ('projects', 'Project Management', 'PPM', 'delivery', '/dashboard/projects', false, 60),
  ('identity', 'Identity & Access', 'IAM', 'security', '/dashboard/identity', true, 70),
  ('audit', 'Audit Centre', 'Enterprise audit log', 'security', '/dashboard/audit', true, 71),
  ('platform', 'Platform Admin', 'Multi-tenant platform ops', 'system', '/dashboard/platform', true, 99)
ON CONFLICT (module_code) DO NOTHING;

INSERT INTO platform_feature_flags (flag_key, name, description, default_enabled, category) VALUES
  ('module.payroll', 'Payroll module', 'Enable enterprise payroll', true, 'module'),
  ('module.talent', 'Talent Acquisition', 'Enable TA module', true, 'module'),
  ('module.fleet', 'Fleet module', 'Enable fleet', true, 'module'),
  ('ai.copilot', 'AI Copilot', 'SecureTrack AI assistant', true, 'ai'),
  ('ai.anomaly', 'Anomaly detection', 'AI anomaly scanning', true, 'ai'),
  ('integration.mobile_money', 'Mobile money', 'MTN/Airtel payouts', true, 'integration'),
  ('security.mfa_required', 'MFA required', 'Force MFA for all users', false, 'security'),
  ('ux.offline_sync', 'Offline sync', 'PWA offline queues', true, 'ux')
ON CONFLICT (flag_key) DO NOTHING;

-- Link existing hope-design tenant subscription
DO $$
DECLARE tid UUID;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'hope-design' LIMIT 1;
  IF tid IS NULL THEN RETURN; END IF;

  INSERT INTO tenant_subscriptions (tenant_id, plan_code, status, seats, modules, billing_email)
  VALUES (tid, 'enterprise', 'active', 1000, '["all"]'::jsonb, 'admin@hopedesign.ug')
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO tenant_modules (tenant_id, module_code, enabled)
  SELECT tid, m.module_code, true FROM platform_modules m
  ON CONFLICT (tenant_id, module_code) DO NOTHING;

  INSERT INTO tenant_feature_flags (tenant_id, flag_key, enabled)
  SELECT tid, f.flag_key, f.default_enabled FROM platform_feature_flags f
  ON CONFLICT (tenant_id, flag_key) DO NOTHING;

  INSERT INTO tenant_setup_progress (tenant_id, step_key, step_label, status, sort_order, completed_at)
  VALUES
    (tid, 'tenant', 'Tenant created', 'completed', 1, NOW()),
    (tid, 'company', 'Company configured', 'completed', 2, NOW()),
    (tid, 'admin', 'Administrator ready', 'completed', 3, NOW()),
    (tid, 'roles', 'Roles & permissions', 'completed', 4, NOW()),
    (tid, 'modules', 'Modules enabled', 'completed', 5, NOW()),
    (tid, 'branding', 'Branding', 'completed', 6, NOW()),
    (tid, 'wizard', 'Setup wizard', 'completed', 7, NOW())
  ON CONFLICT (tenant_id, step_key) DO NOTHING;

  INSERT INTO platform_health_checks (check_key, status, latency_ms, details)
  VALUES
    ('database', 'healthy', 12, '{"engine":"postgresql"}'::jsonb),
    ('auth', 'healthy', 8, '{"provider":"supabase"}'::jsonb),
    ('storage', 'healthy', 15, '{}'::jsonb),
    ('realtime', 'healthy', 20, '{}'::jsonb)
  ON CONFLICT DO NOTHING;
END $$;
