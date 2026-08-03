-- SecureChat: fix "failed to send"
--
-- Root causes observed in production:
--  1) Restrictive write policies require hc.view/hc.manage, but roles created
--     after the original HopeChat seed (e.g. platform_admin) had zero hc.* grants.
--  2) INSERT was relaxed for public channels (00009) but SELECT was not, so
--     PostgREST INSERT ... RETURNING fails with RLS when the caller is not yet
--     a channel member (common for fire-and-forget membership upserts).
--  3) Re-backfill public-channel memberships for any users still missing rows.

-- ============================================================
-- 1. Grant HopeChat permissions to every role that is missing them
-- ============================================================
-- Baseline access: every role can view chat + meetings + AI assist.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug IN ('hc.view', 'hc.meetings', 'hc.ai')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Platform / admin roles get full HopeChat capability set.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug LIKE 'hc.%'
  AND r.slug IN (
    'super_administrator',
    'platform_admin',
    'managing_director',
    'operations_manager',
    'warehouse_manager',
    'hr_manager',
    'finance_manager',
    'production_manager',
    'auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- 2. Re-backfill public channel memberships
-- ============================================================
INSERT INTO hc_channel_members (company_id, channel_id, user_id, role, joined_at)
SELECT c.company_id, c.id, u.id, 'member', NOW()
FROM hc_channels c
JOIN user_profiles u ON u.company_id = c.company_id
WHERE COALESCE(c.is_private, false) = false
  AND c.deleted_at IS NULL
  AND COALESCE(u.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM hc_channel_members m
    WHERE m.channel_id = c.id AND m.user_id = u.id
  )
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- ============================================================
-- 3. Align SELECT with INSERT for public channels
--    (INSERT ... RETURNING / .select().single() needs SELECT policy)
-- ============================================================
DROP POLICY IF EXISTS hc_messages_select ON hc_messages;
CREATE POLICY hc_messages_select ON hc_messages FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_hc_channel_member(channel_id)
    OR EXISTS (
      SELECT 1 FROM hc_channels c
      WHERE c.id = hc_messages.channel_id
        AND c.company_id = public.user_company_id()
        AND COALESCE(c.is_private, false) = false
    )
  );

-- Keep insert policy in sync (membership OR public channel, same company).
DROP POLICY IF EXISTS hc_messages_insert ON hc_messages;
CREATE POLICY hc_messages_insert ON hc_messages FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      public.is_hc_channel_member(channel_id)
      OR EXISTS (
        SELECT 1 FROM hc_channels c
        WHERE c.id = hc_messages.channel_id
          AND c.company_id = public.user_company_id()
          AND COALESCE(c.is_private, false) = false
      )
    )
  );
