-- SecureChat: allow direct messages (DMs)
-- DM partners must be able to read each other's membership rows so that:
--   * existing 1:1 DMs are found by startDm() instead of creating duplicates
--   * each participant can resolve who the DM is with
-- Members may read the membership of any channel they belong to. Tenant
-- isolation is preserved: the row must belong to the actor's own company.

DROP POLICY IF EXISTS hc_channel_members_select ON hc_channel_members;
CREATE POLICY hc_channel_members_select ON hc_channel_members FOR SELECT
  USING (
    company_id = public.user_company_id()
    AND (
      user_id = auth.uid()
      OR public.is_hc_channel_member(channel_id)
      OR public.is_super_admin()
    )
  );