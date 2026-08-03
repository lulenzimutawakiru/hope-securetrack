-- =============================================================================
-- SecureTrack ERP - P0: Tenant super admins must never be platform admins
-- =============================================================================
-- Root cause of "tenant super admins see other tenants":
--   * One global role row super_administrator (company_id NULL) is shared by
--     every tenant's super admin.
--   * is_platform_admin() (migration 64) treated any user with that role as
--     platform staff, and the migration-64 seed also set
--     user_profiles.is_platform_admin = true on those tenant users.
--   * is_super_admin() (migration 02) returns true for the role with no tenant
--     scope, and several control-plane policies used it unscoped.
--   * Because is_platform_admin() was true, a tenant super admin could open a
--     break-glass platform_elevations row, making the RESTRICTIVE
--     tenant_company_access() policy return true for EVERY company - a full
--     bypass of tenant isolation on all ~930 company-scoped tables.
--
-- This migration (idempotent; safe to re-run):
--   1. Clears is_platform_admin on tenant-scoped users. Platform staff are
--      org-level accounts with tenant_id IS NULL.
--   2. Redefines is_platform_admin() to require tenant_id IS NULL - no more
--      role-slug shortcut, no silent tenant-admin bypass.
--   3. Adds tenant-scoped helper is_super_admin_for_tenant().
--   4. Rewrites every unscoped control-plane policy (tenants, companies,
--      user_company_memberships, tenant_audit, tenant_subscriptions,
--      tenant_feature_flags, tenant_modules, tenant_setup_progress,
--      domain_events, tenant_provisioning_jobs, platform_health_checks,
--      platform_announcements, ec_enterprise_groups, intg_connectors) so a
--      tenant super admin can only administer their own tenant/company.
--   5. Invalidates stale platform elevations owned by tenant users and
--      repairs membership tenant drift.
--   6. Hardens switch_active_company() (self-contained, no silent bypass).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Decouple platform admin from tenant super admin
-- ---------------------------------------------------------------------------
UPDATE user_profiles
SET is_platform_admin = false,
    updated_at = NOW()
WHERE is_platform_admin = true
  AND tenant_id IS NOT NULL;

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
      AND up.is_platform_admin = true
      AND up.tenant_id IS NULL  -- platform staff are not tenant members
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tenant-scoped super admin helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin_for_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    AND p_tenant_id IS NOT NULL
    AND p_tenant_id = public.user_tenant_id()
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin_for_tenant(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Control-plane policies: tenants / companies / memberships / audit
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (
    public.is_platform_admin()
    OR id = public.user_tenant_id()
  );

DROP POLICY IF EXISTS tenants_all_admin ON tenants;
CREATE POLICY tenants_all_admin ON tenants FOR ALL
  USING (public.is_platform_admin() OR public.is_super_admin_for_tenant(id))
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin_for_tenant(id));

DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT
  USING (
    public.is_platform_admin()
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
    OR (public.is_super_admin() AND (tenant_id IS NULL OR tenant_id = public.user_tenant_id()))
    OR (public.has_permission('settings.manage') AND (tenant_id IS NULL OR tenant_id = public.user_tenant_id()))
  );

DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (public.is_super_admin() AND tenant_id = public.user_tenant_id())
    OR (id = public.user_company_id() AND public.has_permission('settings.manage'))
  )
  WITH CHECK (
    public.is_platform_admin()
    OR (public.is_super_admin() AND tenant_id = public.user_tenant_id())
    OR (id = public.user_company_id() AND public.has_permission('settings.manage') AND COALESCE(tenant_id, public.user_tenant_id()) = public.user_tenant_id())
  );

DROP POLICY IF EXISTS ucm_select ON user_company_memberships;
CREATE POLICY ucm_select ON user_company_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.tenant_company_access(tenant_id, company_id)
  );

DROP POLICY IF EXISTS ucm_manage ON user_company_memberships;
CREATE POLICY ucm_manage ON user_company_memberships FOR ALL
  USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.tenant_company_access(tenant_id, company_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.tenant_company_access(tenant_id, company_id)
  );

DROP POLICY IF EXISTS tenant_audit_select ON tenant_audit;
CREATE POLICY tenant_audit_select ON tenant_audit FOR SELECT
  USING (
    public.is_platform_admin()
    OR public.tenant_company_access(tenant_id, company_id)
    OR tenant_id = public.user_tenant_id()
    OR company_id = public.user_company_id()
  );

DROP POLICY IF EXISTS tenant_audit_insert ON tenant_audit;
CREATE POLICY tenant_audit_insert ON tenant_audit FOR INSERT
  WITH CHECK (actor_id = auth.uid() OR public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 4. Platform control plane (migration 65)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS platform_announcements_read ON platform_announcements;
CREATE POLICY platform_announcements_read ON platform_announcements FOR SELECT
  USING (status = 'active' OR public.is_platform_admin());

DROP POLICY IF EXISTS tenant_subs_all ON tenant_subscriptions;
CREATE POLICY tenant_subs_all ON tenant_subscriptions FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS tenant_flags_all ON tenant_feature_flags;
CREATE POLICY tenant_flags_all ON tenant_feature_flags FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS tenant_modules_all ON tenant_modules;
CREATE POLICY tenant_modules_all ON tenant_modules FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS setup_progress_all ON tenant_setup_progress;
CREATE POLICY setup_progress_all ON tenant_setup_progress FOR ALL
  USING (tenant_id = public.user_tenant_id() OR public.is_platform_admin())
  WITH CHECK (tenant_id = public.user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS domain_events_select ON domain_events;
CREATE POLICY domain_events_select ON domain_events FOR SELECT
  USING (
    public.is_platform_admin()
    OR tenant_id = public.user_tenant_id()
    OR company_id = public.user_company_id()
  );

DROP POLICY IF EXISTS domain_events_insert ON domain_events;
CREATE POLICY domain_events_insert ON domain_events FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    OR company_id IS NULL
    OR public.is_platform_admin()
  );

-- Provisioning jobs and health checks are platform operations.
DROP POLICY IF EXISTS provision_jobs_admin ON tenant_provisioning_jobs;
CREATE POLICY provision_jobs_admin ON tenant_provisioning_jobs FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provision_jobs_insert ON tenant_provisioning_jobs;
CREATE POLICY provision_jobs_insert ON tenant_provisioning_jobs FOR INSERT
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS health_admin ON platform_health_checks;
CREATE POLICY health_admin ON platform_health_checks FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS health_read ON platform_health_checks;
CREATE POLICY health_read ON platform_health_checks FOR SELECT
  USING (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. Global reference tables written by tenant admins (migrations 50 / 27)
-- ---------------------------------------------------------------------------
-- ec_enterprise_groups has no tenant/company column: writes are limited to
-- platform staff, or to tenant super admins managing a group already attached
-- to one of their own companies.
DROP POLICY IF EXISTS ec_groups_write ON ec_enterprise_groups;
CREATE POLICY ec_groups_write ON ec_enterprise_groups FOR ALL
  USING (
    public.is_platform_admin()
    OR (
      public.is_super_admin()
      AND EXISTS (
        SELECT 1 FROM companies c
        WHERE c.enterprise_group_id = ec_enterprise_groups.id
          AND c.tenant_id = public.user_tenant_id()
      )
    )
  )
  WITH CHECK (public.is_platform_admin() OR public.is_super_admin());

-- intg_connectors is a global connector catalog: writes are platform-only.
DROP POLICY IF EXISTS intg_connectors_write ON intg_connectors;
CREATE POLICY intg_connectors_write ON intg_connectors FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 6. Close the elevation cascade + repair drifted state
-- ---------------------------------------------------------------------------
-- Any break-glass elevation owned by a tenant-scoped user is now invalid
-- (is_platform_admin() is false for them); remove the stale rows.
DELETE FROM platform_elevations
WHERE ended_at IS NULL
  AND actor_id IN (
    SELECT id FROM user_profiles WHERE tenant_id IS NOT NULL
  );

-- Repair membership tenant drift (defensive; keeps tenant_id consistent).
UPDATE user_company_memberships m
SET tenant_id = c.tenant_id,
    updated_at = NOW()
FROM companies c
WHERE c.id = m.company_id
  AND c.tenant_id IS NOT NULL
  AND (m.tenant_id IS NULL OR m.tenant_id IS DISTINCT FROM c.tenant_id);

-- ---------------------------------------------------------------------------
-- 7. Self-contained, hardened company switch (no silent admin bypass)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.switch_active_company(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  allowed BOOLEAN;
  target_tenant UUID;
  user_tenant UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Strict access: active membership or home/active profile company.
  -- Platform elevation is the only sanctioned global path. There is no
  -- silent is_super_admin() bypass (it would defeat tenant isolation).
  SELECT public.is_platform_elevated()
      OR EXISTS (
        SELECT 1 FROM user_company_memberships m
        WHERE m.user_id = uid AND m.company_id = p_company_id AND m.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = uid
          AND (up.company_id = p_company_id OR up.active_company_id = p_company_id)
      )
  INTO allowed;

  IF NOT allowed THEN
    RAISE EXCEPTION 'No access to company %', p_company_id;
  END IF;

  SELECT c.tenant_id INTO target_tenant FROM companies c WHERE c.id = p_company_id;

  -- A tenant admin may only ever switch within their own tenant.
  user_tenant := public.user_tenant_id();
  IF NOT public.is_platform_elevated()
     AND user_tenant IS NOT NULL
     AND target_tenant IS NOT NULL
     AND user_tenant IS DISTINCT FROM target_tenant THEN
    RAISE EXCEPTION 'Cross-tenant company switch denied';
  END IF;

  UPDATE user_profiles
  SET
    active_company_id = p_company_id,
    company_id = p_company_id,
    tenant_id = COALESCE(target_tenant, tenant_id),
    updated_at = NOW()
  WHERE id = uid;

  INSERT INTO tenant_audit (tenant_id, company_id, actor_id, action, details)
  VALUES (target_tenant, p_company_id, uid, 'switch_company', 'Active company switched');

  RETURN p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_active_company(UUID) TO authenticated;
