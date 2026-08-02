-- SecureTrack ERP — Phase 11: Legacy identity & permissive-policy lockdown
-- =============================================================================
-- Closes the two remaining legacy bypass paths introduced in migration 0001:
--
--   1. matches_tenant() trusted the JWT claim app_role='platform_admin'. That
--      claim is stale/tamperable (it only changes on token refresh) and is not
--      the server-authoritative identity path — modern platform admin is derived
--      from user_profiles + platform_elevations.
--   2. matches_tenant() returned true when BOTH row tenant_id and JWT tenant_id
--      were NULL — the classic "NULL == NULL" tenant bypass. Rows with NULL
--      tenant_id are now invisible to every tenant-scoped session.
--
-- Additionally:
--   * The seven legacy FOR ALL policies built on matches_tenant() are dropped.
--   * The dead legacy tables (profiles, audit_log, custom_fields,
--     workflow_definitions, tenant_settings) become deny-by-default: RLS stays
--     enabled and zero policies remain, so every authenticated access is
--     rejected. App code no longer reads or writes these tables (all identity
--     and audit traffic goes to user_profiles / audit_logs / control plane).
--   * The two platform reference tables that never had RLS
--     (industry_templates, entity_metadata) are locked to platform/super admins.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the legacy permissive FOR ALL policies (created in 0001)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_isolation_profiles" ON profiles;
DROP POLICY IF EXISTS "tenant_isolation_audit_log" ON audit_log;
DROP POLICY IF EXISTS "tenant_isolation_tenants" ON tenants;
DROP POLICY IF EXISTS "tenant_isolation_tenant_modules" ON tenant_modules;
DROP POLICY IF EXISTS "tenant_isolation_custom_fields" ON custom_fields;
DROP POLICY IF EXISTS "tenant_isolation_workflow_definitions" ON workflow_definitions;
DROP POLICY IF EXISTS "tenant_isolation_tenant_settings" ON tenant_settings;

-- ---------------------------------------------------------------------------
-- 2. Harden matches_tenant() — no JWT claim trust, no NULL==NULL bypass.
--    Modern identity helpers (is_platform_admin / is_platform_elevated) read
--    user_profiles + platform_elevations (server-authoritative); strict
--    equality is checked against the session-derived tenant via user_tenant_id().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.matches_tenant(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin() OR public.is_platform_elevated() THEN
    RETURN true;
  END IF;
  RETURN p_tenant_id IS NOT NULL
     AND p_tenant_id = public.user_tenant_id();
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Deny-by-default for the dead legacy tables.
--    RLS remains enabled; with every policy removed these tables reject all
--    authenticated access. tenants / tenant_modules keep their modern policies
--    (tenants_select, tenants_all_admin / tenant_modules_all) — only the legacy
--    bypass policies above were dropped for them.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Lock down platform reference tables that never had RLS.
--    Read is restricted to platform/super admins; writes stay service-role only
--    (no INSERT/UPDATE/DELETE policies are created).
-- ---------------------------------------------------------------------------
ALTER TABLE industry_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS industry_templates_admin_read ON industry_templates;
CREATE POLICY industry_templates_admin_read ON industry_templates FOR SELECT
  USING (public.is_platform_admin() OR public.is_super_admin());

ALTER TABLE entity_metadata ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_metadata_admin_read ON entity_metadata;
CREATE POLICY entity_metadata_admin_read ON entity_metadata FOR SELECT
  USING (public.is_platform_admin() OR public.is_super_admin());
