-- Hope Design Group Ltd — Enterprise CRM
-- 360° customer lifecycle: Lead → Opportunity → Quote → Order → Support → Loyalty

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE activity_type AS ENUM (
  'call','meeting','site_visit','demo','follow_up','email','whatsapp','presentation','tender','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE activity_status AS ENUM (
  'planned','completed','cancelled','no_show'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contract_status AS ENUM (
  'draft','active','expired','terminated','renewed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE campaign_status AS ENUM (
  'draft','scheduled','running','completed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND CUSTOMERS (CRM fields)
-- ============================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS business_size VARCHAR(50),
  ADD COLUMN IF NOT EXISTS parent_company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(50) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nps_score INTEGER,
  ADD COLUMN IF NOT EXISTS csat_score DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  title VARCHAR(150),
  department VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  whatsapp VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  preferred_channel VARCHAR(50) DEFAULT 'email',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer ON crm_contacts(customer_id);

-- ============================================================
-- ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  contact_id UUID REFERENCES crm_contacts(id),
  lead_id UUID REFERENCES sales_leads(id),
  opportunity_id UUID REFERENCES sales_opportunities(id),
  activity_type activity_type NOT NULL DEFAULT 'call',
  status activity_status DEFAULT 'planned',
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  location VARCHAR(255),
  outcome TEXT,
  owner_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_sched ON crm_activities(company_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON crm_activities(customer_id);

-- ============================================================
-- NOTES & INTERACTIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  title VARCHAR(255) NOT NULL,
  contract_type VARCHAR(50) DEFAULT 'sales',
  status contract_status DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  value DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  renewal_reminder_days INTEGER DEFAULT 30,
  terms TEXT,
  owner_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, contract_number)
);

-- ============================================================
-- LOYALTY TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  entry_type VARCHAR(30) NOT NULL DEFAULT 'earn',
  reason TEXT,
  reference VARCHAR(100),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FEEDBACK / NPS / CSAT
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  channel VARCHAR(50) DEFAULT 'portal',
  score_type VARCHAR(20) NOT NULL DEFAULT 'csat',
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MARKETING CAMPAIGNS (foundation)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(50) DEFAULT 'email',
  status campaign_status DEFAULT 'draft',
  segment TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  budget DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  metrics JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- CRM INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View CRM', 'crm.view', 'crm', 'View CRM dashboards and accounts'),
  ('Manage CRM', 'crm.manage', 'crm', 'Manage customers, activities, contracts'),
  ('CRM Marketing', 'crm.marketing', 'crm', 'Campaigns and marketing automation'),
  ('CRM Service', 'crm.service', 'crm', 'Service tickets and feedback')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'crm.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000010', id FROM permissions
WHERE slug IN ('crm.view','crm.manage','crm.service','sales.view','sales.pipeline','sales.quotes')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_contacts_all ON crm_contacts FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_activities_all ON crm_activities FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_notes_all ON crm_notes FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_contracts_all ON crm_contracts FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_loyalty_all ON crm_loyalty_ledger FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_feedback_all ON crm_feedback FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_campaigns_all ON crm_campaigns FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
CREATE POLICY crm_insights_all ON crm_insights FOR ALL
  USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());

-- Seed CRM insights
INSERT INTO crm_insights (company_id, insight_type, severity, title, recommendation)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'upsell',
    'high',
    'High purchase probability — Premium A4',
    'Customer ABC Ltd has a high probability of purchasing Premium A4 Copy Paper within the next 30 days. Recommend sending a promotional quotation and scheduling a follow-up meeting.'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'churn_risk',
    'medium',
    'Dormant institutional accounts',
    'Several educational accounts have no orders in 90+ days. Recommend re-engagement campaign and account manager visits.'
  )
ON CONFLICT DO NOTHING;
