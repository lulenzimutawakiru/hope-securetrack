-- ============================================================
-- PLATFORM CRM ADVANCED
-- Internal sales CRM for SecureTrack staff: configurable deal
-- pipeline stages, accounts, contacts, deals, activities/tasks,
-- and reusable email templates. Platform-level (staff) tables:
-- tenant/company are nullable platform context; RLS is gated by
-- public.is_super_admin() so only staff can ever read or write.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pipeline stages (configurable, seeded with defaults)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  color VARCHAR(24) NOT NULL DEFAULT 'slate',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_pipeline_stages) THEN
    INSERT INTO crm_pipeline_stages (name, position, probability, color, is_won, is_lost) VALUES
      ('New Lead', 0, 10, 'slate', false, false),
      ('Qualified', 1, 25, 'sky', false, false),
      ('Proposal', 2, 50, 'indigo', false, false),
      ('Negotiation', 3, 75, 'amber', false, false),
      ('Won', 4, 100, 'emerald', true, false),
      ('Lost', 5, 0, 'rose', false, true);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Accounts (organizations)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  name VARCHAR(180) NOT NULL,
  website VARCHAR(255),
  industry VARCHAR(120),
  country VARCHAR(120),
  city VARCHAR(120),
  size_band VARCHAR(40),
  phone VARCHAR(40),
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('prospect', 'active', 'churned')),
  source VARCHAR(60),
  owner_id UUID,
  lead_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  description TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_name ON crm_accounts (name);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_status ON crm_accounts (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_accounts_industry ON crm_accounts (industry);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_lead ON crm_accounts (lead_id) WHERE lead_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. Contacts (people at accounts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_platform_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  account_id UUID NOT NULL REFERENCES crm_accounts(id) ON DELETE CASCADE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(40),
  job_title VARCHAR(120),
  department VARCHAR(120),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID,
  source VARCHAR(60),
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_platform_contacts_account ON crm_platform_contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_platform_contacts_email ON crm_platform_contacts (email);
CREATE INDEX IF NOT EXISTS idx_crm_platform_contacts_name ON crm_platform_contacts (last_name, first_name);

-- ------------------------------------------------------------
-- 4. Deals (opportunities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  account_id UUID NOT NULL REFERENCES crm_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_platform_contacts(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'UGX',
  stage_id UUID NOT NULL REFERENCES crm_pipeline_stages(id),
  probability INT NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  owner_id UUID,
  source VARCHAR(60),
  lead_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  expected_close DATE,
  notes TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  closed_reason VARCHAR(120),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage ON crm_deals (stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_owner ON crm_deals (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_deals_close ON crm_deals (expected_close) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_deals_lead ON crm_deals (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_deals_open ON crm_deals (stage_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 5. Activities (calls, meetings, emails, notes, tasks, follow-ups)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_platform_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  kind VARCHAR(20) NOT NULL DEFAULT 'note'
    CHECK (kind IN ('call', 'meeting', 'email', 'note', 'task', 'follow_up', 'system')),
  subject VARCHAR(200) NOT NULL,
  description TEXT,
  account_id UUID REFERENCES crm_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_platform_contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES crm_deals(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  owner_id UUID,
  outcome VARCHAR(200),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_platform_activities_account ON crm_platform_activities (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_platform_activities_deal ON crm_platform_activities (deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_platform_activities_lead ON crm_platform_activities (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_platform_activities_due ON crm_platform_activities (due_at) WHERE deleted_at IS NULL AND done = false;
CREATE INDEX IF NOT EXISTS idx_crm_platform_activities_kind ON crm_platform_activities (kind);

-- ------------------------------------------------------------
-- 6. Email templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL DEFAULT 'general',
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_email_templates (name, category, subject, body, is_default) VALUES
  ('Initial outreach', 'outreach', 'SecureTrack ERP - introduction', 'Hi {{first_name}},\n\nThank you for your interest in SecureTrack ERP. I would love to schedule a short call to understand your business goals and show you how the platform can help.\n\nBest regards,\nThe SecureTrack ERP Team', true),
  ('Demo follow-up', 'demo', 'Following up on your SecureTrack ERP demo', 'Hi {{first_name}},\n\nThank you for taking the time to join our demo. I have attached a summary and am happy to answer any questions you may have.\n\nBest regards,\nThe SecureTrack ERP Team', true),
  ('Proposal sent', 'proposal', 'Your SecureTrack ERP proposal', 'Hi {{first_name}},\n\nPlease find attached the proposal we discussed. It is valid for 30 days. I would be glad to walk you through the details.\n\nBest regards,\nThe SecureTrack ERP Team', false)
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_crm_templates_category ON crm_email_templates (category);

-- ------------------------------------------------------------
-- 7. Link marketing leads to CRM records
-- ------------------------------------------------------------
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_messages_account ON contact_messages (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_messages_deal ON contact_messages (deal_id) WHERE deal_id IS NOT NULL;

-- ------------------------------------------------------------
-- 8. updated_at maintenance
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crm_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_stages_updated ON crm_pipeline_stages;
CREATE TRIGGER trg_crm_stages_updated BEFORE UPDATE ON crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_crm_accounts_updated ON crm_accounts;
CREATE TRIGGER trg_crm_accounts_updated BEFORE UPDATE ON crm_accounts
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_crm_platform_contacts_updated ON crm_platform_contacts;
CREATE TRIGGER trg_crm_platform_contacts_updated BEFORE UPDATE ON crm_platform_contacts
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_crm_deals_updated ON crm_deals;
CREATE TRIGGER trg_crm_deals_updated BEFORE UPDATE ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_crm_platform_activities_updated ON crm_platform_activities;
CREATE TRIGGER trg_crm_platform_activities_updated BEFORE UPDATE ON crm_platform_activities
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_crm_templates_updated ON crm_email_templates;
CREATE TRIGGER trg_crm_templates_updated BEFORE UPDATE ON crm_email_templates
  FOR EACH ROW EXECUTE FUNCTION crm_touch_updated_at();

-- ------------------------------------------------------------
-- 9. Row Level Security - staff only (defense in depth; the
--    API layer uses the service role and enforces staff gates).
-- ------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_pipeline_stages',
    'crm_accounts',
    'crm_platform_contacts',
    'crm_deals',
    'crm_platform_activities',
    'crm_email_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_staff_select ON %I', t);
    EXECUTE format('CREATE POLICY crm_staff_select ON %I FOR SELECT TO authenticated USING (public.is_super_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_staff_insert ON %I', t);
    EXECUTE format('CREATE POLICY crm_staff_insert ON %I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_staff_update ON %I', t);
    EXECUTE format('CREATE POLICY crm_staff_update ON %I FOR UPDATE TO authenticated USING (public.is_super_admin())', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_staff_delete ON %I', t);
    EXECUTE format('CREATE POLICY crm_staff_delete ON %I FOR DELETE TO authenticated USING (public.is_super_admin())', t);
  END LOOP;
END $$;