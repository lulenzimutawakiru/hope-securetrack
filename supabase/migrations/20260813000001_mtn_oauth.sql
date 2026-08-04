-- MTN MADAPI OAuth2 access-token audit (multi-tenant)
-- Platform credentials: MTN_OAUTH_CLIENT_ID, MTN_OAUTH_CLIENT_SECRET
-- Security: never stores the raw token - only a sha256 token_hash + expiry metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS public.intg_mtn_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id VARCHAR(120),
  http_status INTEGER,
  status_code VARCHAR(40),
  success BOOLEAN NOT NULL DEFAULT false,
  token_hash VARCHAR(64),
  expires_at TIMESTAMPTZ,
  issued_at VARCHAR(64),
  client_id VARCHAR(160),
  response_summary JSONB,
  error_message TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtn_oauth_company_created
  ON public.intg_mtn_oauth_tokens(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mtn_oauth_company_txn
  ON public.intg_mtn_oauth_tokens(company_id, transaction_id);

ALTER TABLE public.intg_mtn_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intg_mtn_oauth_select ON public.intg_mtn_oauth_tokens;
CREATE POLICY intg_mtn_oauth_select ON public.intg_mtn_oauth_tokens
  FOR SELECT TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY[
        'intg.view','intg.manage','crm.view','crm.manage','iam.view','settings.integrations'
      ])
    )
  );

DROP POLICY IF EXISTS intg_mtn_oauth_insert ON public.intg_mtn_oauth_tokens;
CREATE POLICY intg_mtn_oauth_insert ON public.intg_mtn_oauth_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY[
        'intg.manage','crm.manage','iam.manage','settings.integrations'
      ])
    )
  );

-- Seed connector catalog row if missing
INSERT INTO public.intg_connectors (
  connector_code, name, category, provider, protocol, auth_type, description, icon
)
SELECT
  'MTN_MADAPI_OAUTH',
  'MTN MADAPI OAuth2',
  'identity',
  'MTN',
  'rest',
  'oauth2_client_credentials',
  'MADAPI OAuth2 access token (client_credentials grant)',
  'Key'
WHERE NOT EXISTS (
  SELECT 1 FROM public.intg_connectors WHERE connector_code = 'MTN_MADAPI_OAUTH'
);

COMMIT;