-- SecureChat: fix "send failed" — every company user must be a member of
-- public channels. Member-scoped RLS (20260805000002) blocks inserts for
-- users without a membership row; accounts created after the original seed
-- had none, so they could view public channels but not send messages.
--
--  1) Backfill: add all active company users to every public channel
--  2) Auto-join: new user profiles are joined to public channels on insert
--  3) Defense-in-depth: allow posting to public channels even if a
--     membership row is missing (tenant isolation preserved)

-- ============================================================
-- 1. BACKFILL EXISTING USERS
-- ============================================================
INSERT INTO hc_channel_members (company_id, channel_id, user_id, role, joined_at)
SELECT c.company_id, c.id, u.id, 'member', NOW()
FROM hc_channels c
JOIN user_profiles u ON u.company_id = c.company_id
WHERE COALESCE(c.is_private, false) = false
  AND c.deleted_at IS NULL
  AND u.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM hc_channel_members m
    WHERE m.channel_id = c.id AND m.user_id = u.id
  )
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- ============================================================
-- 2. AUTO-JOIN NEW USERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.hc_autofollow_public_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO hc_channel_members (company_id, channel_id, user_id, role)
  SELECT NEW.company_id, c.id, NEW.id, 'member'
  FROM hc_channels c
  WHERE c.company_id = NEW.company_id
    AND COALESCE(c.is_private, false) = false
    AND c.deleted_at IS NULL
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_hc_autofollow_public_channels ON user_profiles;
CREATE TRIGGER tr_hc_autofollow_public_channels
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.hc_autofollow_public_channels();

-- ============================================================
-- 3. RELAX INSERT POLICIES FOR PUBLIC CHANNELS
-- ============================================================
-- hc_messages: any company user may post to a public channel
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

-- hc_files: any company user may attach a file to a public channel
DROP POLICY IF EXISTS hc_files_insert ON hc_files;
CREATE POLICY hc_files_insert ON hc_files FOR INSERT
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      channel_id IS NULL
      OR public.is_hc_channel_member(channel_id)
      OR EXISTS (
        SELECT 1 FROM hc_channels c
        WHERE c.id = hc_files.channel_id
          AND c.company_id = public.user_company_id()
          AND COALESCE(c.is_private, false) = false
      )
    )
  );

-- hc_reactions: any company user may react to a message in a public channel
DROP POLICY IF EXISTS hc_reactions_insert ON hc_reactions;
CREATE POLICY hc_reactions_insert ON hc_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_hc_channel_member(
        (SELECT m.channel_id FROM hc_messages m WHERE m.id = hc_reactions.message_id)
      )
      OR EXISTS (
        SELECT 1 FROM hc_messages m2
        JOIN hc_channels c ON c.id = m2.channel_id
        WHERE m2.id = hc_reactions.message_id
          AND c.company_id = public.user_company_id()
          AND COALESCE(c.is_private, false) = false
      )
    )
  );
