-- =============================================================================
-- SecureTrack ERP - P0: Platform admin = SecureTrack staff only, fully RBAC
-- =============================================================================
-- Requirement: "platform admin is a control panel for SecureTrack ERP, it can
-- only be accessed by SecureTrack Staff and should be fully RBAC."
--
-- Design (defense in depth):
--   1. New global role `platform_admin` (tenant_id NULL, company_id NULL) that
--      carries the control-plane entitlements (platform.*, tenant.*, security,
--      audit, iam, eal, users/settings). It is never copied into tenants.
--   2. `platform.%` and `tenant.%` permissions are stripped from every other
--      role (including the global super_administrator used by tenant super
--      admins) so tenant admins can never hold control-plane entitlements.
--   3. BEFORE INSERT/UPDATE guard trigger on user_profiles blocks:
--        - self-service privilege escalation (role_id / is_platform_admin)
--        - setting is_platform_admin on tenant-scoped rows
--        - promoting users to platform staff by non-staff
--        - assigning the global super_administrator / platform_admin roles
--      Client-initiated writes are gated on auth.uid() IS NOT NULL so the
--      service-role bootstrap path (scripts/bootstrap-platform-staff.mjs)
--      remains available.
--   4. A SecureTrack staff company (tenant NULL) is created so staff accounts
--      have a legal company target when provisioned.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Staff role: platform_admin (org-level, no tenant, no company)
-- ---------------------------------------------------------------------------
INSERT INTO roles (
  name, slug, description, is_system, is_active, role_category,
  data_scope_default, tenant_id, company_id
)
SELECT
  'SecureTrack Platform Admin', 'platform_admin',
  'Control-plane role for SecureTrack staff. Org-level; never assign to tenant users.',
  true, true, 'platform', 'platform', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE slug = 'platform_admin' AND company_id IS NULL
);

-- Link control-plane entitlements to the staff role (idempotent).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'platform_admin'
  AND r.company_id IS NULL
  AND (
    p.slug LIKE 'platform.%'
    OR p.slug LIKE 'tenant.%'
    OR p.slug IN (
      'security.admin', 'security.dual_control',
      'audit.view', 'audit.manage',
      'iam.view', 'iam.manage', 'iam.security', 'iam.sessions', 'iam.approvals',
      'iam.provision', 'iam.import', 'iam.roles', 'iam.abac', 'iam.password',
      'iam.mfa', 'iam.governance',
      'users.view', 'users.manage',
      'settings.manage'
    )
    OR p.slug LIKE 'eal.%'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Strip control-plane entitlements from every non-staff role
-- ---------------------------------------------------------------------------
DELETE FROM role_permissions rp
USING permissions p, roles r
WHERE rp.permission_id = p.id
  AND rp.role_id = r.id
  AND r.slug <> 'platform_admin'
  AND (p.slug LIKE 'platform.%' OR p.slug LIKE 'tenant.%');

-- Defensive: never leave is_platform_admin set on tenant-scoped profiles.
UPDATE user_profiles
SET is_platform_admin = false,
    updated_at = NOW()
WHERE is_platform_admin = true
  AND tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Guard trigger: staff-only platform flag, no self-service escalation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff BOOLEAN := public.is_platform_admin();
  v_elevated BOOLEAN := public.is_platform_elevated();
  v_global_admin BOOLEAN;
BEGIN
  -- Client (authenticated) writes only; service-role bootstrap is exempt.
  IF auth.uid() IS NOT NULL THEN
    -- Platform admin flag is staff-only: never on tenant-scoped rows.
    IF NEW.is_platform_admin AND NEW.tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'Platform admin flag requires tenant_id IS NULL (staff only)';
    END IF;

    -- Self-service escalation (role or platform flag) requires elevation.
    IF auth.uid() = OLD.id
       AND NOT v_elevated
       AND (
         NEW.role_id IS DISTINCT FROM OLD.role_id
         OR NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
       ) THEN
      RAISE EXCEPTION 'Self-service privilege escalation denied';
    END IF;

    -- Promoting someone to platform staff requires staff or elevation.
    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
       AND NOT v_staff
       AND NOT v_elevated THEN
      RAISE EXCEPTION 'Only SecureTrack staff may grant platform admin';
    END IF;

    -- Assigning a global admin role (super_administrator / platform_admin)
    -- requires staff or elevation.
    IF NEW.role_id IS DISTINCT FROM OLD.role_id
       AND NOT v_staff
       AND NOT v_elevated THEN
      SELECT EXISTS (
        SELECT 1 FROM roles r
        WHERE r.id = NEW.role_id
          AND r.company_id IS NULL
          AND r.slug IN ('super_administrator', 'platform_admin')
      ) INTO v_global_admin;
      IF v_global_admin THEN
        RAISE EXCEPTION 'Assigning global admin roles requires platform staff or elevation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privilege_columns ON public.user_profiles;
CREATE TRIGGER trg_guard_profile_privilege_columns
  BEFORE INSERT OR UPDATE OF role_id, is_platform_admin ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privilege_columns();

-- ---------------------------------------------------------------------------
-- 4. SecureTrack staff company (tenant NULL) for staff account provisioning
-- ---------------------------------------------------------------------------
INSERT INTO companies (
  name, code, legal_name, company_type, tenant_id, is_primary, is_active,
  country, timezone
)
SELECT
  'SecureTrack ERP Operations', 'SECURETRACK-STAFF',
  'SecureTrack ERP Operations', 'internal', NULL, false, true,
  'Uganda', 'Africa/Kampala'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE code = 'SECURETRACK-STAFF'
);

-- ---------------------------------------------------------------------------
-- 5. Audit trail
-- ---------------------------------------------------------------------------
INSERT INTO tenant_audit (tenant_id, company_id, actor_id, action, details)
SELECT NULL, NULL, NULL, 'platform_admin_staff_rbac',
       jsonb_build_object('role', 'platform_admin', 'note', 'Platform admin restricted to SecureTrack staff (org-level, RBAC)')
WHERE EXISTS (
  SELECT 1 FROM roles WHERE slug = 'platform_admin' AND company_id IS NULL
);