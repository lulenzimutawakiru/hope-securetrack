-- IAM: allow users to register/update their own sessions after login
-- (migration 08 was already applied without self-insert policies)

DROP POLICY IF EXISTS user_sessions_insert_self ON user_sessions;
CREATE POLICY user_sessions_insert_self ON user_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_sessions_update_self ON user_sessions;
CREATE POLICY user_sessions_update_self ON user_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Super-admin path for remote revoke across companies
DROP POLICY IF EXISTS user_sessions_all_admin ON user_sessions;
CREATE POLICY user_sessions_all_admin ON user_sessions FOR ALL
  USING (
    public.is_super_admin()
    OR (company_id = public.user_company_id() AND public.has_any_permission(ARRAY['iam.manage','iam.sessions']))
  )
  WITH CHECK (
    public.is_super_admin()
    OR company_id = public.user_company_id()
    OR user_id = auth.uid()
  );
