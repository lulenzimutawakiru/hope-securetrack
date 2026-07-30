-- SecureTrack ERP — Security hardening (audit remediations)
-- Tighten provisioning job inserts; login_history; revoke open policies

-- Provisioning jobs: only platform admins / service role may insert
DROP POLICY IF EXISTS provision_jobs_insert ON tenant_provisioning_jobs;
CREATE POLICY provision_jobs_insert ON tenant_provisioning_jobs FOR INSERT
  WITH CHECK (
    public.is_platform_admin()
    OR public.is_super_admin()
  );

-- Service role still needs full access for API provisioning (bypasses RLS by default on service_role)
-- Authenticated users cannot spam jobs.

-- login_history: only allow insert for own user_id or service patterns
DROP POLICY IF EXISTS login_history_insert ON login_history;
CREATE POLICY login_history_insert ON login_history FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR user_id = auth.uid()
    OR public.is_platform_admin()
    OR public.is_super_admin()
  );

-- Note: service_role bypasses RLS and remains usable for edge/API inserts.
