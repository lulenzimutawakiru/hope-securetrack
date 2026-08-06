-- Enterprise Control Plane: granular platform staff roles.
-- Access Matrix (CPanel Security Rules):
--   owner      -> Platform Owner (full)
--   cto        -> CTO (infrastructure + security + AI)
--   security   -> Security Admin (audit + security + MFA/SSO)
--   devops     -> DevOps (deployment + monitoring + jobs)
--   compliance -> Compliance Officer (audit + reports + governance)
-- Tenant Owner / Company Admin / Normal User never hold these roles.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS platform_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_platform_role_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_platform_role_check
      CHECK (
        platform_role IS NULL OR platform_role IN ('owner','cto','security','devops','compliance')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_role
  ON user_profiles(platform_role)
  WHERE platform_role IS NOT NULL;

-- A platform role may only be held by SecureTrack staff:
-- is_platform_admin = true AND no tenant binding. Tenant admins can never
-- self-assign a CPanel role (defense in depth beyond application checks).
CREATE OR REPLACE FUNCTION assert_platform_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.platform_role IS NOT NULL
     AND (NEW.is_platform_admin IS NOT TRUE OR NEW.tenant_id IS NOT NULL) THEN
    RAISE EXCEPTION 'platform_role requires a SecureTrack staff profile (is_platform_admin=true and no tenant_id)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_platform_role_scope ON user_profiles;
CREATE TRIGGER trg_user_profiles_platform_role_scope
  BEFORE INSERT OR UPDATE OF platform_role, is_platform_admin, tenant_id
  ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assert_platform_role_scope();

-- RPC for staff-scoped reads (RLS-safe; fails closed for tenant users).
CREATE OR REPLACE FUNCTION current_platform_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_role
  FROM user_profiles
  WHERE id = auth.uid()
    AND is_platform_admin = true
    AND tenant_id IS NULL;
$$;
