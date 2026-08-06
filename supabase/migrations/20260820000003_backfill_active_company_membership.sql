-- =============================================================================
-- Backfill active company context for users provisioned before membership rows
-- were created. Idempotent; safe to re-run.
-- 1. Set active_company_id from company_id when missing.
-- 2. Insert missing user_company_memberships rows from user_profiles (tenant
--    derived from the company when the profile has no tenant_id).
-- =============================================================================

UPDATE user_profiles
SET active_company_id = company_id,
    updated_at = NOW()
WHERE active_company_id IS NULL
  AND company_id IS NOT NULL;

INSERT INTO user_company_memberships (
  user_id,
  company_id,
  tenant_id,
  role_id,
  is_default,
  status,
  joined_at,
  created_at,
  updated_at
)
SELECT
  up.id,
  up.company_id,
  COALESCE(up.tenant_id, c.tenant_id) AS tenant_id,
  up.role_id,
  TRUE,
  'active',
  COALESCE(up.activated_at, up.created_at, NOW()),
  NOW(),
  NOW()
FROM user_profiles up
LEFT JOIN companies c ON c.id = up.company_id
WHERE up.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_company_memberships m
    WHERE m.user_id = up.id
      AND m.company_id = up.company_id
  )
ON CONFLICT (user_id, company_id) DO NOTHING;
