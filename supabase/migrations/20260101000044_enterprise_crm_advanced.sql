-- Hope SecureTrack ERP — Enterprise CRM Platform (Advanced)
-- Customer 360 · Leads · Opportunities · Pipeline · Marketing · Loyalty
-- Contracts · Portal · AI · Timeline · Dealers · Tenders · Communications
-- Multi-company RLS · Soft-delete · Full CRUD+

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE crm_customer_status AS ENUM (
  'lead','prospect','active','preferred','vip','suspended','blacklisted','inactive','closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE crm_customer_class AS ENUM (
  'individual','corporate','government','ngo','school','distributor','dealer',
  'retailer','wholesaler','export','strategic','vip'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE crm_timeline_kind AS ENUM (
  'call','meeting','email','whatsapp','sms','note','quote','order','invoice',
  'payment','ticket','delivery','complaint','return','task','ai_summary','portal','system'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE crm_loyalty_tier AS ENUM (
  'bronze','silver','gold','platinum','diamond'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE crm_consent_type AS ENUM (
  'email','sms','whatsapp','phone','marketing','data_processing'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND CUSTOMERS → Customer 360°
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS designation VARCHAR(150),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS physical_address TEXT,
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS time_zone VARCHAR(80) DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS customer_class VARCHAR(40) DEFAULT 'corporate',
  ADD COLUMN IF NOT EXISTS customer_status VARCHAR(40) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS parent_customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS hierarchy_path TEXT,
  ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 70 CHECK (health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS churn_risk DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clv_estimate DECIMAL(16,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance DECIMAL(16,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_hold BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS segment_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(company_id, customer_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_class ON customers(company_id, customer_class) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_parent ON customers(parent_customer_id) WHERE parent_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING gin (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(code,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
);

-- ============================================================
-- EXTEND CONTACTS
-- ============================================================
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_technical BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_finance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_procurement BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS consent_sms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_whatsapp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- EXTEND LEADS
-- ============================================================
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualification_notes TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS territory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS campaign_id UUID,
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100),
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================================
-- EXTEND OPPORTUNITIES
-- ============================================================
ALTER TABLE sales_opportunities
  ADD COLUMN IF NOT EXISTS competitors TEXT,
  ADD COLUMN IF NOT EXISTS decision_makers TEXT,
  ADD COLUMN IF NOT EXISTS risks TEXT,
  ADD COLUMN IF NOT EXISTS win_strategy TEXT,
  ADD COLUMN IF NOT EXISTS products_interest TEXT,
  ADD COLUMN IF NOT EXISTS forecast_category VARCHAR(40) DEFAULT 'pipeline',
  ADD COLUMN IF NOT EXISTS weighted_value DECIMAL(16,2) GENERATED ALWAYS AS (
    COALESCE(expected_value,0) * COALESCE(probability,0) / 100.0
  ) STORED,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================================
-- CUSTOMER TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES sales_leads(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  kind crm_timeline_kind NOT NULL DEFAULT 'note',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  direction VARCHAR(20) DEFAULT 'outbound',
  channel VARCHAR(50),
  ref_type VARCHAR(50),
  ref_id UUID,
  amount DECIMAL(16,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  sentiment VARCHAR(20),
  actor_id UUID REFERENCES user_profiles(id),
  actor_name VARCHAR(150),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_timeline_customer ON crm_timeline(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_company ON crm_timeline(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_lead ON crm_timeline(lead_id) WHERE lead_id IS NOT NULL;

-- ============================================================
-- CONSENT MANAGEMENT (GDPR / Uganda DPA)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  consent_type crm_consent_type NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(100),
  ip_address VARCHAR(64),
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_consents_customer ON crm_consents(customer_id);

-- ============================================================
-- SEGMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  rules JSONB DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  is_dynamic BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS crm_segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES crm_segments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segment_id, customer_id)
);

-- ============================================================
-- CAMPAIGN MEMBERS + ENHANCE CAMPAIGNS
-- ============================================================
ALTER TABLE crm_campaigns
  ADD COLUMN IF NOT EXISTS subject VARCHAR(255),
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES crm_segments(id),
  ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS crm_campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(40) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_members ON crm_campaign_members(campaign_id, status);

-- ============================================================
-- LOYALTY PROGRAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  points_per_currency DECIMAL(10,4) DEFAULT 1,
  currency VARCHAR(10) DEFAULT 'UGX',
  is_active BOOLEAN DEFAULT true,
  rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS crm_loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES crm_loyalty_programs(id) ON DELETE CASCADE,
  tier crm_loyalty_tier NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  benefits TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(program_id, tier)
);

CREATE TABLE IF NOT EXISTS crm_loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  program_id UUID REFERENCES crm_loyalty_programs(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  points_cost INTEGER NOT NULL DEFAULT 100,
  reward_type VARCHAR(40) DEFAULT 'discount',
  value DECIMAL(14,2) DEFAULT 0,
  stock INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

ALTER TABLE crm_loyalty_ledger
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES crm_loyalty_programs(id),
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES crm_contracts(id) ON DELETE SET NULL,
  doc_type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  file_size BIGINT,
  mime_type VARCHAR(100),
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  expires_at DATE,
  uploaded_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_documents_customer ON crm_documents(customer_id) WHERE deleted_at IS NULL;

-- ============================================================
-- COMMUNICATIONS HUB
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'email',
  direction VARCHAR(20) DEFAULT 'outbound',
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(40) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  provider_ref VARCHAR(150),
  error_message TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_comms_customer ON crm_communications(customer_id, created_at DESC);

-- ============================================================
-- DEALER / DISTRIBUTOR MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  dealer_code VARCHAR(50) NOT NULL,
  dealer_type VARCHAR(40) DEFAULT 'dealer',
  territory VARCHAR(150),
  region VARCHAR(100),
  sales_target DECIMAL(16,2) DEFAULT 0,
  ytd_sales DECIMAL(16,2) DEFAULT 0,
  price_list VARCHAR(50) DEFAULT 'dealer',
  commission_pct DECIMAL(5,2) DEFAULT 0,
  manager_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, dealer_code)
);

CREATE TABLE IF NOT EXISTS crm_dealer_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES crm_dealers(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  target_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(16,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  UNIQUE(dealer_id, period_year, period_month)
);

-- ============================================================
-- TENDERS / GOVERNMENT & INSTITUTIONAL
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tender_number VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  issuing_body VARCHAR(255),
  tender_type VARCHAR(50) DEFAULT 'open',
  status VARCHAR(40) DEFAULT 'identified',
  submission_deadline TIMESTAMPTZ,
  bid_value DECIMAL(16,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  win_probability INTEGER DEFAULT 30,
  requirements TEXT,
  compliance_docs TEXT,
  owner_id UUID REFERENCES user_profiles(id),
  opportunity_id UUID REFERENCES sales_opportunities(id),
  awarded_at TIMESTAMPTZ,
  lost_reason TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, tender_number)
);

-- ============================================================
-- HEALTH SCORES & AI INSIGHTS STORE
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  churn_risk DECIMAL(5,2) DEFAULT 0,
  engagement INTEGER DEFAULT 50,
  financial INTEGER DEFAULT 50,
  support INTEGER DEFAULT 50,
  factors JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

ALTER TABLE crm_insights
  ADD COLUMN IF NOT EXISTS score DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES sales_opportunities(id),
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES sales_leads(id),
  ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- ============================================================
-- FEEDBACK ENHANCEMENTS
-- ============================================================
ALTER TABLE crm_feedback
  ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20),
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_id UUID,
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ============================================================
-- CONTRACT ENHANCEMENTS
-- ============================================================
ALTER TABLE crm_contracts
  ADD COLUMN IF NOT EXISTS sla_terms TEXT,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notice_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS milestone_schedule JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- PORTAL SESSIONS / REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_portal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL DEFAULT 'support',
  subject VARCHAR(255) NOT NULL,
  body TEXT,
  status VARCHAR(40) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  ref_type VARCHAR(50),
  ref_id UUID,
  handled_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_portal_req ON crm_portal_requests(customer_id, status);

-- ============================================================
-- MERGE / AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_customer_id UUID NOT NULL,
  target_customer_id UUID NOT NULL,
  merged_fields JSONB DEFAULT '{}',
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  details TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit ON crm_audit_log(company_id, created_at DESC);

-- ============================================================
-- SALES TARGETS (team / branch)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES user_profiles(id),
  branch_name VARCHAR(150),
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  target_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
  actual_amount DECIMAL(16,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('CRM Leads', 'crm.leads', 'crm', 'Manage leads and conversion'),
  ('CRM Opportunities', 'crm.opportunities', 'crm', 'Manage opportunities and pipeline'),
  ('CRM AI', 'crm.ai', 'crm', 'AI customer intelligence'),
  ('CRM Portal', 'crm.portal', 'crm', 'Customer portal administration'),
  ('CRM Credit', 'crm.credit', 'crm', 'Credit limits and holds'),
  ('CRM Admin', 'crm.admin', 'crm', 'CRM administration and merge'),
  ('CRM Export', 'crm.export', 'crm', 'Export CRM data')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'crm.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000010', id FROM permissions
WHERE slug IN ('crm.view','crm.manage','crm.leads','crm.opportunities','crm.service','crm.marketing','sales.view','sales.pipeline','sales.quotes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE crm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_segment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_dealer_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_portal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_sales_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY crm_timeline_all ON crm_timeline FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_consents_all ON crm_consents FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_segments_all ON crm_segments FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_segment_members_all ON crm_segment_members FOR ALL
    USING (segment_id IN (SELECT id FROM crm_segments WHERE company_id = public.user_company_id()))
    WITH CHECK (segment_id IN (SELECT id FROM crm_segments WHERE company_id = public.user_company_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_campaign_members_all ON crm_campaign_members FOR ALL
    USING (campaign_id IN (SELECT id FROM crm_campaigns WHERE company_id = public.user_company_id()))
    WITH CHECK (campaign_id IN (SELECT id FROM crm_campaigns WHERE company_id = public.user_company_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_loyalty_programs_all ON crm_loyalty_programs FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_loyalty_tiers_all ON crm_loyalty_tiers FOR ALL
    USING (program_id IN (SELECT id FROM crm_loyalty_programs WHERE company_id = public.user_company_id()))
    WITH CHECK (program_id IN (SELECT id FROM crm_loyalty_programs WHERE company_id = public.user_company_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_loyalty_rewards_all ON crm_loyalty_rewards FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_documents_all ON crm_documents FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_communications_all ON crm_communications FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_dealers_all ON crm_dealers FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_dealer_targets_all ON crm_dealer_targets FOR ALL
    USING (dealer_id IN (SELECT id FROM crm_dealers WHERE company_id = public.user_company_id()))
    WITH CHECK (dealer_id IN (SELECT id FROM crm_dealers WHERE company_id = public.user_company_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_tenders_all ON crm_tenders FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_health_scores_all ON crm_health_scores FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_portal_requests_all ON crm_portal_requests FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_merge_log_all ON crm_merge_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_audit_log_all ON crm_audit_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY crm_sales_targets_all ON crm_sales_targets FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED DATA — Hope Design Group
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  cust1 UUID;
  cust2 UUID;
  cust3 UUID;
  lead1 UUID;
  opp1 UUID;
  prog UUID;
  seg1 UUID;
  camp1 UUID;
BEGIN
  -- Ensure sample customers exist / update 360 fields
  SELECT id INTO cust1 FROM customers WHERE company_id = cid AND code = 'CUS-MOES' LIMIT 1;
  IF cust1 IS NULL THEN
    INSERT INTO customers (
      company_id, code, name, trading_name, customer_type, customer_class, customer_status,
      industry, contact_person, designation, email, phone, whatsapp, city, region, district,
      country, credit_limit, payment_terms_days, currency, preferred_currency, loyalty_level,
      health_score, clv_estimate, portal_enabled, source, territory
    ) VALUES (
      cid, 'CUS-MOES', 'Ministry of Education and Sports', 'MoES Uganda',
      'government', 'government', 'vip', 'Government / Education',
      'Procurement Director', 'Director Procurement', 'procurement@education.go.ug',
      '+256414123456', '+256700111222', 'Kampala', 'Central', 'Kampala',
      'Uganda', 500000000, 60, 'UGX', 'UGX', 'platinum', 92, 2500000000, true,
      'tender', 'Central Uganda'
    ) RETURNING id INTO cust1;
  ELSE
    UPDATE customers SET
      customer_class = COALESCE(customer_class, 'government'),
      customer_status = COALESCE(customer_status, 'vip'),
      health_score = COALESCE(health_score, 92),
      portal_enabled = true
    WHERE id = cust1;
  END IF;

  SELECT id INTO cust2 FROM customers WHERE company_id = cid AND code = 'CUS-MAKERERE' LIMIT 1;
  IF cust2 IS NULL THEN
    INSERT INTO customers (
      company_id, code, name, trading_name, customer_type, customer_class, customer_status,
      industry, contact_person, email, phone, city, region, country, credit_limit,
      payment_terms_days, currency, parent_customer_id, health_score, loyalty_level, source
    ) VALUES (
      cid, 'CUS-MAKERERE', 'Makerere University', 'Mak',
      'institutional', 'school', 'preferred', 'Higher Education',
      'Bursar Office', 'bursar@mak.ac.ug', '+256414542803', 'Kampala', 'Central', 'Uganda',
      80000000, 45, 'UGX', cust1, 85, 'gold', 'referral'
    ) RETURNING id INTO cust2;
  END IF;

  SELECT id INTO cust3 FROM customers WHERE company_id = cid AND code = 'CUS-DEALER-EAST' LIMIT 1;
  IF cust3 IS NULL THEN
    INSERT INTO customers (
      company_id, code, name, customer_type, customer_class, customer_status,
      industry, contact_person, email, phone, city, region, country, credit_limit,
      currency, loyalty_level, health_score, territory, source
    ) VALUES (
      cid, 'CUS-DEALER-EAST', 'Eastern Paper Distributors Ltd',
      'distributor', 'distributor', 'active', 'Distribution',
      'Sales Manager', 'sales@easterndist.ug', '+256772334455', 'Mbale', 'Eastern', 'Uganda',
      120000000, 'UGX', 'silver', 78, 'Eastern Uganda', 'sales_rep'
    ) RETURNING id INTO cust3;
  END IF;

  -- Contacts
  IF NOT EXISTS (SELECT 1 FROM crm_contacts WHERE company_id = cid AND customer_id = cust1 LIMIT 1) THEN
    INSERT INTO crm_contacts (
      company_id, customer_id, first_name, last_name, title, department, email, phone, mobile,
      is_primary, is_decision_maker, is_procurement, consent_email, consent_whatsapp
    ) VALUES
      (cid, cust1, 'Grace', 'Nakato', 'Director Procurement', 'Procurement',
       'grace.nakato@education.go.ug', '+256414123456', '+256700111222', true, true, true, true, true),
      (cid, cust1, 'James', 'Okello', 'Finance Controller', 'Finance',
       'j.okello@education.go.ug', '+256414123457', '+256700111333', false, false, false, true, false);
  END IF;

  -- Leads
  IF NOT EXISTS (SELECT 1 FROM sales_leads WHERE company_id = cid AND lead_number = 'LD-CRM-001' LIMIT 1) THEN
    INSERT INTO sales_leads (
      company_id, lead_number, company_name, contact_name, email, phone, source, industry,
      status, estimated_value, currency, lead_score, ai_score, next_action, territory
    ) VALUES (
      cid, 'LD-CRM-001', 'Jinja Secondary School Consortium', 'Head of Procurement',
      'procure@jinjaschools.ug', '+256753221100', 'website', 'Education',
      'qualified', 45000000, 'UGX', 78, 82, 'Schedule site demo of secure exam papers', 'Eastern Uganda'
    ) RETURNING id INTO lead1;
  ELSE
    SELECT id INTO lead1 FROM sales_leads WHERE company_id = cid AND lead_number = 'LD-CRM-001' LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sales_leads WHERE company_id = cid AND lead_number = 'LD-CRM-002' LIMIT 1) THEN
    INSERT INTO sales_leads (
      company_id, lead_number, company_name, contact_name, email, phone, source,
      status, estimated_value, currency, lead_score, ai_score
    ) VALUES (
      cid, 'LD-CRM-002', 'Rwanda Export Partner LLC', 'Import Manager',
      'import@rwexport.rw', '+250788112233', 'trade_show',
      'contacted', 180000000, 'USD', 65, 70
    );
  END IF;

  -- Opportunities
  IF NOT EXISTS (SELECT 1 FROM sales_opportunities WHERE company_id = cid AND opportunity_number = 'OPP-CRM-001' LIMIT 1) THEN
    INSERT INTO sales_opportunities (
      company_id, opportunity_number, name, customer_id, lead_id, stage, probability,
      expected_value, currency, expected_close_date, competitors, win_strategy, products_interest,
      forecast_category
    ) VALUES (
      cid, 'OPP-CRM-001', 'MoES National Exam Papers 2026', cust1, lead1, 'proposal', 60,
      850000000, 'UGX', (CURRENT_DATE + 45), 'Competitor PrintCo',
      'Emphasize QR authentication, chain-of-custody, and prior MoES delivery performance',
      'Secure exam booklets, certificates, holograms', 'best_case'
    ) RETURNING id INTO opp1;
  ELSE
    SELECT id INTO opp1 FROM sales_opportunities WHERE company_id = cid AND opportunity_number = 'OPP-CRM-001' LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sales_opportunities WHERE company_id = cid AND opportunity_number = 'OPP-CRM-002' LIMIT 1) THEN
    INSERT INTO sales_opportunities (
      company_id, opportunity_number, name, customer_id, stage, probability,
      expected_value, currency, expected_close_date, forecast_category
    ) VALUES (
      cid, 'OPP-CRM-002', 'Makerere transcript security paper annual', cust2, 'negotiation', 75,
      95000000, 'UGX', (CURRENT_DATE + 20), 'commit'
    );
  END IF;

  -- Timeline
  IF NOT EXISTS (SELECT 1 FROM crm_timeline WHERE company_id = cid AND title = 'Initial discovery call — MoES' LIMIT 1) THEN
    INSERT INTO crm_timeline (company_id, customer_id, kind, title, body, channel, actor_name, occurred_at)
    VALUES
      (cid, cust1, 'call', 'Initial discovery call — MoES',
       'Discussed 2026 exam paper volumes, security requirements, and delivery windows.',
       'phone', 'Sales Team', NOW() - INTERVAL '12 days'),
      (cid, cust1, 'meeting', 'Technical demo — QR authentication',
       'Demonstrated SecureTrack QR verification and counterfeit reporting portal.',
       'in_person', 'Solutions Engineer', NOW() - INTERVAL '7 days'),
      (cid, cust1, 'email', 'Draft proposal sent',
       'Branded quotation and security specification pack emailed to procurement.',
       'email', 'Account Manager', NOW() - INTERVAL '3 days'),
      (cid, cust2, 'note', 'Renewal discussion started',
       'Bursar confirmed budget allocation for security paper Q3.',
       'internal', 'Account Manager', NOW() - INTERVAL '2 days'),
      (cid, cust3, 'whatsapp', 'Dealer stock inquiry',
       'Eastern distributor requested restock of A4 bond and security labels.',
       'whatsapp', 'Channel Manager', NOW() - INTERVAL '1 day');
  END IF;

  -- Segments
  IF NOT EXISTS (SELECT 1 FROM crm_segments WHERE company_id = cid AND code = 'GOV-EDU' LIMIT 1) THEN
    INSERT INTO crm_segments (company_id, code, name, description, rules, member_count, is_dynamic)
    VALUES
      (cid, 'GOV-EDU', 'Government & Education', 'Ministries, universities, schools',
       '{"customer_class":["government","school"]}', 2, true),
      (cid, 'CHANNEL', 'Dealers & Distributors', 'Channel partners',
       '{"customer_class":["dealer","distributor"]}', 1, true),
      (cid, 'VIP', 'VIP & Strategic', 'High-value strategic accounts',
       '{"customer_status":["vip","preferred"]}', 2, true);
  END IF;

  SELECT id INTO seg1 FROM crm_segments WHERE company_id = cid AND code = 'GOV-EDU' LIMIT 1;
  IF seg1 IS NOT NULL AND cust1 IS NOT NULL THEN
    INSERT INTO crm_segment_members (segment_id, customer_id)
    VALUES (seg1, cust1), (seg1, cust2)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Campaign
  IF NOT EXISTS (SELECT 1 FROM crm_campaigns WHERE company_id = cid AND code = 'CAMP-Q3-EDU' LIMIT 1) THEN
    INSERT INTO crm_campaigns (
      company_id, code, name, channel, status, segment, starts_at, ends_at, budget, currency,
      subject, body_html, target_count, ai_recommendation
    ) VALUES (
      cid, 'CAMP-Q3-EDU', 'Q3 Education Security Paper Push', 'email', 'scheduled',
      'Government & Education', NOW() + INTERVAL '3 days', NOW() + INTERVAL '30 days',
      5000000, 'UGX',
      'Secure your 2026 examinations with Hope Design Group',
      '<p>Partner with Hope Design Group for QR-authenticated exam materials.</p>',
      120,
      'Target schools with orders older than 90 days; emphasize authenticity and delivery SLA.'
    ) RETURNING id INTO camp1;
  END IF;

  -- Loyalty program
  IF NOT EXISTS (SELECT 1 FROM crm_loyalty_programs WHERE company_id = cid AND code = 'HOPE-REWARDS' LIMIT 1) THEN
    INSERT INTO crm_loyalty_programs (company_id, code, name, description, points_per_currency, currency, is_active)
    VALUES (cid, 'HOPE-REWARDS', 'Hope Rewards', 'Enterprise loyalty for channel and institutional buyers', 0.001, 'UGX', true)
    RETURNING id INTO prog;

    INSERT INTO crm_loyalty_tiers (program_id, tier, min_points, discount_pct, benefits, sort_order) VALUES
      (prog, 'bronze', 0, 0, 'Standard support', 1),
      (prog, 'silver', 10000, 2, 'Priority quoting · 2% rebate', 2),
      (prog, 'gold', 50000, 4, 'Dedicated AM · 4% rebate', 3),
      (prog, 'platinum', 150000, 6, 'SLA priority · 6% rebate · early access', 4),
      (prog, 'diamond', 500000, 8, 'Strategic partner · 8% rebate · co-marketing', 5);

    INSERT INTO crm_loyalty_rewards (company_id, program_id, code, name, points_cost, reward_type, value) VALUES
      (cid, prog, 'RWD-5PCT', '5% invoice credit', 25000, 'discount', 5),
      (cid, prog, 'RWD-FREE-SHIP', 'Free delivery Kampala', 8000, 'service', 0);
  END IF;

  -- Dealers
  IF cust3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_dealers WHERE company_id = cid AND dealer_code = 'DLR-EAST-01' LIMIT 1) THEN
    INSERT INTO crm_dealers (
      company_id, customer_id, dealer_code, dealer_type, territory, region,
      sales_target, ytd_sales, price_list, commission_pct, is_active
    ) VALUES (
      cid, cust3, 'DLR-EAST-01', 'distributor', 'Eastern Uganda', 'Eastern',
      400000000, 185000000, 'distributor', 3.5, true
    );
  END IF;

  -- Tender
  IF NOT EXISTS (SELECT 1 FROM crm_tenders WHERE company_id = cid AND tender_number = 'TND-MOES-2026-01' LIMIT 1) THEN
    INSERT INTO crm_tenders (
      company_id, tender_number, title, customer_id, issuing_body, tender_type, status,
      submission_deadline, bid_value, currency, win_probability, requirements, opportunity_id
    ) VALUES (
      cid, 'TND-MOES-2026-01', 'Supply of secure national examination materials 2026',
      cust1, 'Ministry of Education and Sports', 'restricted', 'bid_prep',
      NOW() + INTERVAL '28 days', 850000000, 'UGX', 55,
      'ISO print security · QR authentication · sealed logistics · local content',
      opp1
    );
  END IF;

  -- Health scores
  IF cust1 IS NOT NULL THEN
    INSERT INTO crm_health_scores (company_id, customer_id, score, churn_risk, engagement, financial, support, factors)
    VALUES (cid, cust1, 92, 8, 90, 95, 88, '{"orders_90d":4,"tickets_open":0,"nps":72}')
    ON CONFLICT (customer_id) DO UPDATE SET score = 92, churn_risk = 8, computed_at = NOW();
  END IF;
  IF cust2 IS NOT NULL THEN
    INSERT INTO crm_health_scores (company_id, customer_id, score, churn_risk, engagement, financial, support, factors)
    VALUES (cid, cust2, 85, 15, 80, 88, 82, '{"orders_90d":2,"tickets_open":1,"nps":65}')
    ON CONFLICT (customer_id) DO UPDATE SET score = 85, churn_risk = 15, computed_at = NOW();
  END IF;
  IF cust3 IS NOT NULL THEN
    INSERT INTO crm_health_scores (company_id, customer_id, score, churn_risk, engagement, financial, support, factors)
    VALUES (cid, cust3, 78, 22, 75, 70, 80, '{"orders_90d":6,"stock_turns":3}')
    ON CONFLICT (customer_id) DO UPDATE SET score = 78, churn_risk = 22, computed_at = NOW();
  END IF;

  -- Insights
  INSERT INTO crm_insights (company_id, customer_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, cust1, 'upsell', 'high',
    'Expand hologram volume on MoES certificates',
    'Bundle certificate holograms with exam paper bid to increase AOV by ~12%.',
    88, 'open'
  WHERE cust1 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM crm_insights WHERE company_id = cid AND title LIKE 'Expand hologram%' LIMIT 1);

  INSERT INTO crm_insights (company_id, customer_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, cust3, 'churn_risk', 'medium',
    'Eastern distributor below target pace',
    'YTD at 46% of annual target. Schedule joint sales ride-along and restock promo.',
    62, 'open'
  WHERE cust3 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM crm_insights WHERE company_id = cid AND title LIKE 'Eastern distributor%' LIMIT 1);

  INSERT INTO crm_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'forecast', 'info',
    'Q3 pipeline coverage healthy',
    'Weighted pipeline covers 1.4x target. Protect MoES bid and accelerate Makerere close.',
    75, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM crm_insights WHERE company_id = cid AND title LIKE 'Q3 pipeline%' LIMIT 1);

  -- Feedback
  IF NOT EXISTS (SELECT 1 FROM crm_feedback WHERE company_id = cid AND comment LIKE 'Delivery quality excellent%' LIMIT 1) THEN
    INSERT INTO crm_feedback (company_id, customer_id, channel, score_type, score, comment, sentiment)
    VALUES
      (cid, cust2, 'portal', 'csat', 5, 'Delivery quality excellent on transcript paper batch.', 'positive'),
      (cid, cust3, 'email', 'nps', 8, 'Would recommend Hope Design to regional partners.', 'positive');
  END IF;

  -- Contracts
  IF NOT EXISTS (SELECT 1 FROM crm_contracts WHERE company_id = cid AND contract_number = 'CTR-MOES-2025' LIMIT 1) THEN
    INSERT INTO crm_contracts (
      company_id, contract_number, customer_id, title, contract_type, status,
      start_date, end_date, value, currency, renewal_reminder_days, terms, auto_renew
    ) VALUES (
      cid, 'CTR-MOES-2025', cust1, 'Framework Agreement — Secure Print Materials',
      'framework', 'active', CURRENT_DATE - 180, CURRENT_DATE + 185,
      1200000000, 'UGX', 60, 'Multi-year framework for security printing services.', true
    );
  END IF;

  -- Sales targets
  IF NOT EXISTS (SELECT 1 FROM crm_sales_targets WHERE company_id = cid AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND branch_name = 'Central' LIMIT 1) THEN
    INSERT INTO crm_sales_targets (company_id, branch_name, period_year, period_month, target_amount, actual_amount, currency)
    VALUES
      (cid, 'Central', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 350000000, 210000000, 'UGX'),
      (cid, 'Eastern', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 120000000, 68000000, 'UGX');
  END IF;

  -- Activities sample
  IF NOT EXISTS (SELECT 1 FROM crm_activities WHERE company_id = cid AND subject = 'Follow-up MoES proposal' LIMIT 1) THEN
    INSERT INTO crm_activities (
      company_id, customer_id, opportunity_id, activity_type, status, subject, description, scheduled_at
    ) VALUES (
      cid, cust1, opp1, 'follow_up', 'planned', 'Follow-up MoES proposal',
      'Confirm technical clarifications and pricing validity.',
      NOW() + INTERVAL '2 days'
    );
  END IF;

END $$;
