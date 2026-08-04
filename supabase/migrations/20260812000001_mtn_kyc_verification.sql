-- MTN Customer KYC Verification audit (multi-tenant)
-- Platform credentials: MTN_KYC_API_KEY, MTN_KYC_BASIC_USER, MTN_KYC_BASIC_PASSWORD

BEGIN;

CREATE TABLE IF NOT EXISTS public.intg_mtn_kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id VARCHAR(120) NOT NULL,
  target_system VARCHAR(80),
  identifier_kind VARCHAR(20) NOT NULL DEFAULT 'bvn',
  -- bvn | msisdn | mixed
  identifiers TEXT[] NOT NULL DEFAULT '{}',
  http_status INTEGER,
  status_code VARCHAR(40),
  success BOOLEAN NOT NULL DEFAULT false,
  response_summary JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mtn_kyc_company_created
  ON public.intg_mtn_kyc_verifications(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mtn_kyc_txn
  ON public.intg_mtn_kyc_verifications(company_id, transaction_id);

ALTER TABLE public.intg_mtn_kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intg_mtn_kyc_select ON public.intg_mtn_kyc_verifications;
CREATE POLICY intg_mtn_kyc_select ON public.intg_mtn_kyc_verifications
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

DROP POLICY IF EXISTS intg_mtn_kyc_insert ON public.intg_mtn_kyc_verifications;
CREATE POLICY intg_mtn_kyc_insert ON public.intg_mtn_kyc_verifications
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
  'MTN_KYC',
  'MTN Customer KYC Verification',
  'identity',
  'MTN',
  'rest',
  'api_key',
  'MADAPI KYC verification by MSISDN / BVN',
  'Shield'
WHERE NOT EXISTS (
  SELECT 1 FROM public.intg_connectors WHERE connector_code = 'MTN_KYC'
);

COMMIT;
