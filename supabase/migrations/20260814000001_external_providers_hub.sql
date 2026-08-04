-- External providers hub — call audit + optional push tokens
-- Supports payments, SMS, WhatsApp, push, maps, SIEM, OCR integrations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.intg_provider_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  provider VARCHAR(60) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  -- payments | comms | maps | jobs | security | siem | docs
  operation VARCHAR(80) NOT NULL DEFAULT 'call',
  success BOOLEAN NOT NULL DEFAULT false,
  sandbox BOOLEAN NOT NULL DEFAULT false,
  http_status INTEGER,
  external_id VARCHAR(200),
  error_message TEXT,
  request_summary TEXT,
  response_summary TEXT,
  entity_type VARCHAR(80),
  entity_id UUID,
  duration_ms INTEGER,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intg_provider_calls_company
  ON public.intg_provider_calls(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intg_provider_calls_provider
  ON public.intg_provider_calls(provider, created_at DESC);

-- Push device tokens for FCM / OneSignal
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(40) DEFAULT 'web',
  -- web | ios | android
  provider VARCHAR(40) DEFAULT 'fcm',
  -- fcm | onesignal
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user
  ON public.user_push_tokens(company_id, user_id)
  WHERE is_active = true;

ALTER TABLE public.intg_provider_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS intg_provider_calls_select ON public.intg_provider_calls;
CREATE POLICY intg_provider_calls_select ON public.intg_provider_calls
  FOR SELECT TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.view','intg.manage','settings.integrations'])
    )
  );

DROP POLICY IF EXISTS intg_provider_calls_insert ON public.intg_provider_calls;
CREATE POLICY intg_provider_calls_insert ON public.intg_provider_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.user_company_id()
    AND (
      public.is_super_admin()
      OR public.has_any_permission(ARRAY['intg.manage','settings.integrations'])
    )
  );

DROP POLICY IF EXISTS user_push_tokens_select ON public.user_push_tokens;
CREATE POLICY user_push_tokens_select ON public.user_push_tokens
  FOR SELECT TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (user_id = auth.uid() OR public.has_any_permission(ARRAY['intg.view','intg.manage','iam.manage']))
  );

DROP POLICY IF EXISTS user_push_tokens_write ON public.user_push_tokens;
CREATE POLICY user_push_tokens_write ON public.user_push_tokens
  FOR ALL TO authenticated
  USING (
    company_id = public.user_company_id()
    AND (user_id = auth.uid() OR public.has_any_permission(ARRAY['intg.manage','iam.manage']))
  )
  WITH CHECK (
    company_id = public.user_company_id()
    AND (user_id = auth.uid() OR public.has_any_permission(ARRAY['intg.manage','iam.manage']))
  );

-- Seed connector catalog rows for marketplace visibility (idempotent)
INSERT INTO public.intg_connectors (connector_code, name, category, provider, protocol, auth_type, description)
SELECT v.code, v.name, v.category, v.provider, v.protocol, v.auth_type, v.description
FROM (VALUES
  ('MTN_MOMO_V2', 'MTN Mobile Money Collections', 'payments', 'mtn', 'rest', 'api_key', 'requestToPay collections'),
  ('AIRTEL_MONEY', 'Airtel Money', 'payments', 'airtel', 'rest', 'oauth2', 'Merchant collections'),
  ('FLUTTERWAVE', 'Flutterwave', 'payments', 'flutterwave', 'rest', 'api_key', 'Card & multi-rail checkout'),
  ('PESAPAL', 'Pesapal', 'payments', 'pesapal', 'rest', 'oauth2', 'East Africa payment gateway'),
  ('STRIPE', 'Stripe', 'payments', 'stripe', 'rest', 'api_key', 'Card checkout sessions'),
  ('AFRICASTALKING', 'Africa''s Talking SMS', 'comms', 'africastalking', 'rest', 'api_key', 'SMS messaging'),
  ('WHATSAPP_CLOUD', 'WhatsApp Cloud API', 'comms', 'meta', 'rest', 'bearer', 'Meta WhatsApp Business'),
  ('FCM', 'Firebase Cloud Messaging', 'comms', 'google', 'rest', 'api_key', 'Push notifications'),
  ('ONESIGNAL', 'OneSignal', 'comms', 'onesignal', 'rest', 'api_key', 'Push notifications'),
  ('MAPBOX', 'Mapbox', 'maps', 'mapbox', 'rest', 'token', 'Geocoding & directions'),
  ('QSTASH', 'Upstash QStash', 'jobs', 'upstash', 'rest', 'token', 'Durable serverless jobs'),
  ('TURNSTILE', 'Cloudflare Turnstile', 'security', 'cloudflare', 'rest', 'secret', 'Bot CAPTCHA'),
  ('DOCUMENT_AI', 'Document OCR', 'docs', 'document_ai', 'rest', 'api_key', 'Invoice / receipt extraction'),
  ('DOCUSIGN', 'DocuSign', 'docs', 'docusign', 'rest', 'oauth2', 'Electronic signatures')
) AS v(code, name, category, provider, protocol, auth_type, description)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'intg_connectors'
)
AND NOT EXISTS (
  SELECT 1 FROM public.intg_connectors c WHERE c.connector_code = v.code
);

COMMIT;
