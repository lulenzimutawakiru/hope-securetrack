-- =============================================================================
-- SecureTrack ERP — P0 TENANT ISOLATION ENFORCEMENT
-- Cross-tenant access prevention: dual tenant_id + company_id RLS
-- Platform admin no longer silently bypasses business data RLS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. JIT platform elevation (break-glass) — never silent bypass
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_elevations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  ticket_ref VARCHAR(120),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  ended_by UUID REFERENCES user_profiles(id),
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_elevations_active
  ON platform_elevations(actor_id, expires_at)
  WHERE ended_at IS NULL;

ALTER TABLE platform_elevations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_elevations_self ON platform_elevations;
CREATE POLICY platform_elevations_self ON platform_elevations FOR SELECT
  USING (actor_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS platform_elevations_insert ON platform_elevations;
CREATE POLICY platform_elevations_insert ON platform_elevations FOR INSERT
  WITH CHECK (actor_id = auth.uid() AND public.is_platform_admin());

-- Immutable elevation audit (append-only via app + insert-only policy)
CREATE TABLE IF NOT EXISTS platform_elevation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elevation_id UUID,
  actor_id UUID NOT NULL,
  action VARCHAR(40) NOT NULL,
  reason TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_elevation_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_elevation_audit_select ON platform_elevation_audit;
CREATE POLICY platform_elevation_audit_select ON platform_elevation_audit FOR SELECT
  USING (public.is_platform_admin() OR actor_id = auth.uid());
DROP POLICY IF EXISTS platform_elevation_audit_insert ON platform_elevation_audit;
CREATE POLICY platform_elevation_audit_insert ON platform_elevation_audit FOR INSERT
  WITH CHECK (actor_id = auth.uid());
-- No UPDATE/DELETE policies → immutable for normal roles

CREATE OR REPLACE FUNCTION public.is_platform_elevated()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_elevations e
    WHERE e.actor_id = auth.uid()
      AND e.ended_at IS NULL
      AND e.expires_at > NOW()
      AND public.is_platform_admin()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_elevated() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Core isolation helpers — membership + tenant, NO silent admin bypass
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_tenant()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.user_tenant_id()
$$;

CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_company_id IS NOT NULL
    AND (
      -- Active JIT elevation only (logged break-glass)
      public.is_platform_elevated()
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
    )
$$;

/**
 * Dual-key isolation: tenant_id AND company membership.
 * RESTRICTIVE policies call this — AND'd with existing permissive policies.
 */
CREATE OR REPLACE FUNCTION public.tenant_company_access(
  p_tenant_id UUID,
  p_company_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_tenant UUID;
  v_co_tenant UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF p_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Break-glass only
  IF public.is_platform_elevated() THEN
    RETURN true;
  END IF;

  IF NOT public.user_has_company_access(p_company_id) THEN
    RETURN false;
  END IF;

  v_user_tenant := public.user_tenant_id();
  SELECT c.tenant_id INTO v_co_tenant FROM companies c WHERE c.id = p_company_id;

  -- Company must exist
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If row carries tenant_id, it must match company's tenant and user's tenant
  IF p_tenant_id IS NOT NULL THEN
    IF v_co_tenant IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_co_tenant THEN
      RETURN false; -- row tenant ≠ company.tenant (data integrity)
    END IF;
    IF v_user_tenant IS NOT NULL AND p_tenant_id IS DISTINCT FROM v_user_tenant THEN
      RETURN false; -- cross-tenant
    END IF;
  END IF;

  -- User tenant must match company tenant when both set
  IF v_user_tenant IS NOT NULL AND v_co_tenant IS NOT NULL
     AND v_user_tenant IS DISTINCT FROM v_co_tenant THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_company_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_tenant() TO authenticated;

-- Company access when only company_id column exists (derive tenant from companies)
CREATE OR REPLACE FUNCTION public.company_access_strict(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.tenant_company_access(
    (SELECT c.tenant_id FROM companies c WHERE c.id = p_company_id),
    p_company_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.company_access_strict(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Switch company — must stay within tenant unless elevated
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

  SELECT public.user_has_company_access(p_company_id) INTO allowed;
  IF NOT allowed THEN
    RAISE EXCEPTION 'No access to company %', p_company_id;
  END IF;

  SELECT c.tenant_id INTO target_tenant FROM companies c WHERE c.id = p_company_id;
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

-- ---------------------------------------------------------------------------
-- 4. Ensure default tenant for orphan companies + backfill profiles
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  default_tenant UUID;
BEGIN
  SELECT id INTO default_tenant FROM tenants WHERE slug = 'default' LIMIT 1;
  IF default_tenant IS NULL THEN
    INSERT INTO tenants (slug, name, status, plan_code)
    VALUES ('default', 'Default Tenant', 'active', 'enterprise')
    RETURNING id INTO default_tenant;
  END IF;

  UPDATE companies
  SET tenant_id = default_tenant
  WHERE tenant_id IS NULL AND deleted_at IS NULL;

  UPDATE user_profiles up
  SET tenant_id = c.tenant_id
  FROM companies c
  WHERE c.id = COALESCE(up.active_company_id, up.company_id)
    AND (up.tenant_id IS NULL OR up.tenant_id IS DISTINCT FROM c.tenant_id);

  UPDATE user_company_memberships m
  SET tenant_id = c.tenant_id
  FROM companies c
  WHERE c.id = m.company_id
    AND (m.tenant_id IS NULL OR m.tenant_id IS DISTINCT FROM c.tenant_id);
END $$;

-- ---------------------------------------------------------------------------
-- 5. Dynamic: add tenant_id to all business tables with company_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  sql text;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND c.table_name NOT IN ('companies', 'spatial_ref_sys')
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_name = c.table_name
          AND t.table_type = 'BASE TABLE'
      )
  LOOP
    -- Add tenant_id if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns x
      WHERE x.table_schema = 'public'
        AND x.table_name = r.table_name
        AND x.column_name = 'tenant_id'
    ) THEN
      sql := format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID', r.table_name);
      EXECUTE sql;
    END IF;

    -- Backfill from companies
    sql := format(
      'UPDATE public.%I t SET tenant_id = c.tenant_id FROM public.companies c WHERE t.company_id = c.id AND (t.tenant_id IS NULL OR t.tenant_id IS DISTINCT FROM c.tenant_id)',
      r.table_name
    );
    BEGIN
      EXECUTE sql;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Backfill skip %: %', r.table_name, SQLERRM;
    END;

    -- Indexes
    BEGIN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
        'idx_' || left(r.table_name, 40) || '_tenant',
        r.table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, company_id)',
        'idx_' || left(r.table_name, 35) || '_tenant_co',
        r.table_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Index skip %: %', r.table_name, SQLERRM;
    END;

    -- RESTRICTIVE dual-key policy (AND with existing policies)
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_restrict ON public.%I', r.table_name);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_restrict ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.tenant_company_access(tenant_id, company_id)) WITH CHECK (public.tenant_company_access(tenant_id, company_id))',
        r.table_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Policy skip %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Trigger: auto-set tenant_id from company on INSERT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_set_tenant_from_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT c.tenant_id INTO NEW.tenant_id
    FROM companies c WHERE c.id = NEW.company_id;
  END IF;
  -- Force session tenant if set (prevent client spoof of other tenant)
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.user_tenant_id();
  ELSIF public.user_tenant_id() IS NOT NULL
        AND NEW.tenant_id IS DISTINCT FROM public.user_tenant_id()
        AND NOT public.is_platform_elevated() THEN
    RAISE EXCEPTION 'tenant_id spoofing denied';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns t
        WHERE t.table_schema = 'public'
          AND t.table_name = c.table_name
          AND t.column_name = 'tenant_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.tables tb
        WHERE tb.table_schema = 'public'
          AND tb.table_name = c.table_name
          AND tb.table_type = 'BASE TABLE'
      )
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_from_company ON public.%I', r.table_name);
      EXECUTE format(
        'CREATE TRIGGER trg_set_tenant_from_company BEFORE INSERT OR UPDATE OF company_id, tenant_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_set_tenant_from_company()',
        r.table_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Trigger skip %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Elevate / end elevation RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_platform_elevation(
  p_reason TEXT,
  p_minutes INT DEFAULT 30,
  p_ticket TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eid UUID;
  mins INT := LEAST(GREATEST(COALESCE(p_minutes, 30), 5), 120);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform admins may elevate';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Justification required (min 10 chars)';
  END IF;

  -- End prior open elevations
  UPDATE platform_elevations
  SET ended_at = NOW(), ended_by = auth.uid()
  WHERE actor_id = auth.uid() AND ended_at IS NULL;

  INSERT INTO platform_elevations (actor_id, reason, ticket_ref, expires_at)
  VALUES (auth.uid(), trim(p_reason), p_ticket, NOW() + (mins || ' minutes')::interval)
  RETURNING id INTO eid;

  INSERT INTO platform_elevation_audit (elevation_id, actor_id, action, reason, details)
  VALUES (eid, auth.uid(), 'elevate', p_reason, jsonb_build_object('minutes', mins, 'ticket', p_ticket));

  RETURN eid;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_platform_elevation()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE platform_elevations
  SET ended_at = NOW(), ended_by = auth.uid()
  WHERE actor_id = auth.uid() AND ended_at IS NULL;

  INSERT INTO platform_elevation_audit (actor_id, action, reason)
  VALUES (auth.uid(), 'end_elevation', 'manual end');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_platform_elevation(TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_platform_elevation() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Permissions
-- ---------------------------------------------------------------------------
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Platform Elevate', 'platform.elevate', 'platform', 'Request JIT platform elevation'),
  ('Platform Ops Portal', 'platform.ops_portal', 'platform', 'Access platform operator portal')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);
