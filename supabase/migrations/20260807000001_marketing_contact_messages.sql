-- ============================================================
-- MARKETING CONTACT MESSAGES
-- Public lead capture for the SecureTrack ERP marketing site.
-- Platform-level (pre-tenant) table: tenant_id/company_id are optional
-- and can be linked later when a lead matches an existing tenant.
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(150),
  industry VARCHAR(120),
  country VARCHAR(120),
  message TEXT NOT NULL CHECK (char_length(message) <= 8000),
  source VARCHAR(40) NOT NULL DEFAULT 'marketing_site',
  ip_hash VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'closed')),
  consent_privacy BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages (email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages (status);

CREATE OR REPLACE FUNCTION marketing_contact_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_messages_updated_at ON contact_messages;
CREATE TRIGGER trg_contact_messages_updated_at
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW EXECUTE FUNCTION marketing_contact_touch_updated_at();

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Staff (platform admins) can read and update leads
DROP POLICY IF EXISTS contact_messages_staff_read ON contact_messages;
CREATE POLICY contact_messages_staff_read ON contact_messages FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS contact_messages_staff_update ON contact_messages;
CREATE POLICY contact_messages_staff_update ON contact_messages FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- Public submissions insert rows only; status/source are fixed so leads
-- cannot be tampered with from anonymous clients. Writes from the API
-- route use the service role (bypasses RLS).
DROP POLICY IF EXISTS contact_messages_public_insert ON contact_messages;
CREATE POLICY contact_messages_public_insert ON contact_messages FOR INSERT TO anon
  WITH CHECK (status = 'new' AND source = 'marketing_site');