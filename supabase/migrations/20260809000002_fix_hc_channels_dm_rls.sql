-- SecureChat: fix "failed to send" / DM channel creation (ERROR 42501 RLS)
--
-- Root cause: the INSERT WITH CHECK policies on hc_channels were already
-- correct, but PostgREST INSERT ... RETURNING (.select("*").single() in
-- createChannel / startDm) also requires the returned row to pass the SELECT
-- policy. For a brand-new private DM channel the creator is not yet a member
-- (membership rows are inserted after channel creation) and is_private=true,
-- so hc_channels_select rejected the row:
--   ERROR 42501: new row violates row-level security policy for table "hc_channels"
--
-- Fix: allow the channel creator to read the channel before membership rows
-- exist (created_by = auth.uid()).

DROP POLICY IF EXISTS hc_channels_select ON public.hc_channels;
CREATE POLICY hc_channels_select ON public.hc_channels FOR SELECT TO public
  USING (
    company_id = user_company_id()
    AND (
      is_hc_channel_member(id)
      OR (NOT COALESCE(is_private, false))
      OR created_by = auth.uid()
    )
  );