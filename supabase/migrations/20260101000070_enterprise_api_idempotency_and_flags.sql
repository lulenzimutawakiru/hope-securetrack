-- SecureTrack ERP — API idempotency + enterprise flag seeds + login attempt support

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL,
  response_status INT NOT NULL DEFAULT 200,
  response_body JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idemp_exp ON api_idempotency_keys(expires_at);

ALTER TABLE api_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_idemp_company ON api_idempotency_keys;
CREATE POLICY api_idemp_company ON api_idempotency_keys FOR ALL
  USING (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    company_id = public.user_company_id()
    OR public.is_super_admin()
    OR public.is_platform_admin()
  );

-- Seed platform feature flags (defaults)
INSERT INTO platform_feature_flags (flag_key, name, description, category, default_enabled)
SELECT v.flag_key, v.name, v.description, v.category, v.default_enabled
FROM (VALUES
  ('ai.copilot', 'AI Copilot', 'Enable SecureTrack AI assistant', 'ai', true),
  ('security.mfa_privileged', 'MFA Privileged', 'Enforce MFA for privileged roles', 'security', true),
  ('security.dual_control', 'Dual Control', 'Maker-checker for money/identity', 'security', true),
  ('payroll.server_mutations', 'Payroll Server Mutations', 'Use server APIs for payroll process/bank/release', 'payroll', true),
  ('finance.server_gl_post', 'Finance Server GL', 'Use server API for GL posting', 'finance', true),
  ('jobs.durable_queue', 'Durable Job Queue', 'Background jobs via job_queue', 'platform', true),
  ('portal.token_hash', 'Portal Token Hash', 'Hash portal access tokens', 'security', true),
  ('ux.command_palette', 'Command Palette', 'Global command palette', 'ux', true),
  ('integrations.webhooks', 'Outbound Webhooks', 'Allow webhook delivery jobs', 'integrations', true)
) AS v(flag_key, name, description, category, default_enabled)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'platform_feature_flags'
)
AND NOT EXISTS (
  SELECT 1 FROM platform_feature_flags p WHERE p.flag_key = v.flag_key
);

-- Optional: cleanup expired idempotency keys (ops can schedule)
-- DELETE FROM api_idempotency_keys WHERE expires_at < NOW();
