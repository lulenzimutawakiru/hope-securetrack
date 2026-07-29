-- Hope Design Group Ltd — Resend email outbox & integration seed

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  provider VARCHAR(30) DEFAULT 'resend',
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  cc_addresses TEXT[] DEFAULT '{}',
  subject VARCHAR(500),
  template_key VARCHAR(80),
  status VARCHAR(30) DEFAULT 'queued', -- queued | sent | failed | bounced
  provider_message_id VARCHAR(150),
  error_message TEXT,
  payload JSONB DEFAULT '{}',
  sent_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(company_id, status);

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_outbox_select ON email_outbox FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY email_outbox_insert ON email_outbox FOR INSERT
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- Seed Resend integration metadata (API key lives in env, not DB)
INSERT INTO integration_configs (company_id, integration_key, name, category, is_enabled, config)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'resend',
  'Resend Email',
  'messaging',
  true,
  '{"provider":"resend","docs":"https://resend.com/docs","env":["RESEND_API_KEY","RESEND_FROM_EMAIL","RESEND_FROM_NAME","RESEND_REPLY_TO"]}'::jsonb
)
ON CONFLICT (company_id, integration_key) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    is_enabled = true,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Prefer Resend over generic SMTP for messaging
UPDATE integration_configs
SET is_enabled = false,
    updated_at = NOW()
WHERE company_id = 'a0000000-0000-4000-8000-000000000001'
  AND integration_key = 'smtp';

INSERT INTO system_settings (company_id, key, value, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'email.provider', '"resend"', 'Transactional email provider'),
  ('a0000000-0000-4000-8000-000000000001', 'email.from_name', '"Hope SecureTrack"', 'Default From display name'),
  ('a0000000-0000-4000-8000-000000000001', 'email.enabled', 'true', 'Enable outbound email')
ON CONFLICT (company_id, key) DO NOTHING;
