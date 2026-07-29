-- Hope SecureTrack ERP — Enterprise Company Management Platform
-- Master organizational foundation: groups · companies · branches · factories
-- business units · departments · cost/profit centers · governance · calendar · risk

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE ec_company_type AS ENUM (
  'holding','operating','subsidiary','joint_venture','franchise','sister','branch_legal'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ec_org_node_type AS ENUM (
  'enterprise_group','holding','company','subsidiary','branch','factory',
  'warehouse','office','distribution_center','retail_outlet','service_center',
  'regional_office','project_site','business_unit','department','cost_center','profit_center'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ec_entity_status AS ENUM (
  'draft','active','inactive','suspended','archived','dissolved'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE ec_risk_level AS ENUM (
  'low','medium','high','critical'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND companies (master profile)
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_type VARCHAR(40) DEFAULT 'operating',
  ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enterprise_group_id UUID,
  ADD COLUMN IF NOT EXISTS business_license VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sector VARCHAR(150),
  ADD COLUMN IF NOT EXISTS registered_address TEXT,
  ADD COLUMN IF NOT EXISTS operational_address TEXT,
  ADD COLUMN IF NOT EXISTS postal_address TEXT,
  ADD COLUMN IF NOT EXISTS mobile VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS date_incorporated DATE,
  ADD COLUMN IF NOT EXISTS financial_year_label VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fiscal_calendar VARCHAR(50) DEFAULT 'calendar',
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(20) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS company_status ec_entity_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS dark_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS letterhead_url TEXT,
  ADD COLUMN IF NOT EXISTS digital_stamp_url TEXT,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(company_status) WHERE deleted_at IS NULL;

-- ============================================================
-- EXTEND branches / factories / departments / warehouses
-- ============================================================
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;

ALTER TABLE factories
  ADD COLUMN IF NOT EXISTS plant_manager_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS plant_manager_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS production_capacity NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS capacity_uom VARCHAR(30) DEFAULT 'units/day',
  ADD COLUMN IF NOT EXISTS production_lines INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_quality_lab BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_maintenance_shop BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dispatch_area BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oee_target DECIMAL(5,2) DEFAULT 85,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS manager_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS assistant_manager_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS budget_currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS business_unit_id UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_type VARCHAR(50) DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- ENTERPRISE GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_enterprise_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  headquarters_country VARCHAR(100),
  primary_currency VARCHAR(10) DEFAULT 'UGX',
  status ec_entity_status DEFAULT 'active',
  logo_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_enterprise_group_id_fkey;
ALTER TABLE companies
  ADD CONSTRAINT companies_enterprise_group_id_fkey
  FOREIGN KEY (enterprise_group_id) REFERENCES ec_enterprise_groups(id) ON DELETE SET NULL;

-- ============================================================
-- BUSINESS UNITS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  unit_type VARCHAR(50) DEFAULT 'corporate',
  -- manufacturing | security_printing | ict | distribution | logistics | retail | corporate
  director_name VARCHAR(150),
  director_user_id UUID REFERENCES user_profiles(id),
  budget_amount DECIMAL(18,2),
  budget_currency VARCHAR(10) DEFAULT 'UGX',
  cost_center_code VARCHAR(50),
  profit_center_code VARCHAR(50),
  kpis JSONB DEFAULT '[]'::jsonb,
  status ec_entity_status DEFAULT 'active',
  sort_order INTEGER DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_business_unit_id_fkey;
ALTER TABLE departments
  ADD CONSTRAINT departments_business_unit_id_fkey
  FOREIGN KEY (business_unit_id) REFERENCES ec_business_units(id) ON DELETE SET NULL;

-- ============================================================
-- COST & PROFIT CENTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  business_unit_id UUID REFERENCES ec_business_units(id) ON DELETE SET NULL,
  manager_name VARCHAR(150),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS ec_profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  business_unit_id UUID REFERENCES ec_business_units(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- ORG STRUCTURE TREE (unified hierarchy for charts)
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_org_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES ec_org_nodes(id) ON DELETE SET NULL,
  node_type ec_org_node_type NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  manager_person_id UUID,
  manager_user_id UUID REFERENCES user_profiles(id),
  manager_name VARCHAR(150),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_org_parent ON ec_org_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_ec_org_company ON ec_org_nodes(company_id) WHERE deleted_at IS NULL;

-- ============================================================
-- COMPANY SETTINGS (module policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain VARCHAR(50) NOT NULL,
  -- financial | hr | manufacturing | procurement | sales | security | general
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, domain, setting_key)
);

-- ============================================================
-- BRANDING OVERRIDES (per company white-label)
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_company_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  primary_color VARCHAR(20) DEFAULT '#0B1F3A',
  secondary_color VARCHAR(20) DEFAULT '#C9A227',
  accent_color VARCHAR(20) DEFAULT '#1B4F72',
  font_family VARCHAR(100) DEFAULT 'Inter',
  logo_url TEXT,
  dark_logo_url TEXT,
  favicon_url TEXT,
  seal_url TEXT,
  watermark_url TEXT,
  letterhead_url TEXT,
  invoice_template_code VARCHAR(50) DEFAULT 'default',
  po_template_code VARCHAR(50) DEFAULT 'default',
  dn_template_code VARCHAR(50) DEFAULT 'default',
  quote_template_code VARCHAR(50) DEFAULT 'default',
  id_card_template_code VARCHAR(50) DEFAULT 'staff',
  email_signature_html TEXT,
  portal_theme JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT VAULT
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type VARCHAR(80) NOT NULL,
  -- incorporation | tax | license | insurance | iso | policy | sop | board | legal | other
  title VARCHAR(255) NOT NULL,
  doc_number VARCHAR(100),
  file_url TEXT,
  issued_date DATE,
  expiry_date DATE,
  reminder_days INTEGER DEFAULT 30,
  status VARCHAR(30) DEFAULT 'active',
  version_no INTEGER DEFAULT 1,
  sensitivity VARCHAR(30) DEFAULT 'confidential',
  uploaded_by UUID REFERENCES user_profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_docs_expiry ON ec_company_documents(company_id, expiry_date)
  WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

-- ============================================================
-- CALENDAR & HOLIDAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  -- public_holiday | company_holiday | shutdown | maintenance | payroll | financial_close | production | corporate
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_all_day BOOLEAN DEFAULT true,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_cal_company ON ec_calendar_events(company_id, start_date);

-- ============================================================
-- GOVERNANCE: BOARD, COMMITTEES, MEETINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  title VARCHAR(150),
  member_type VARCHAR(50) DEFAULT 'director',
  -- chair | director | independent | secretary | observer
  email VARCHAR(255),
  phone VARCHAR(50),
  appointed_date DATE,
  term_end_date DATE,
  is_active BOOLEAN DEFAULT true,
  person_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ec_committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  chair_name VARCHAR(150),
  mandate TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS ec_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES ec_committees(id) ON DELETE SET NULL,
  meeting_number VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(50) DEFAULT 'board',
  scheduled_at TIMESTAMPTZ,
  location VARCHAR(200),
  agenda TEXT,
  minutes TEXT,
  status VARCHAR(30) DEFAULT 'scheduled',
  -- scheduled | held | cancelled | adjourned
  resolutions JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ec_authorized_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  role_title VARCHAR(150),
  authority_scope VARCHAR(100) DEFAULT 'general',
  -- banking | contracts | legal | hr | finance | general
  limit_amount DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  signature_url TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ec_shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shareholder_name VARCHAR(255) NOT NULL,
  shareholder_type VARCHAR(50) DEFAULT 'individual',
  -- individual | company | trust | government
  shares INTEGER,
  ownership_pct DECIMAL(7,4),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSURANCE & RISK
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_type VARCHAR(50) NOT NULL,
  -- property | vehicle | equipment | employee | liability | cyber
  policy_number VARCHAR(100),
  insurer_name VARCHAR(200),
  coverage_amount DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  premium_amount DECIMAL(18,2),
  start_date DATE,
  end_date DATE,
  reminder_days INTEGER DEFAULT 30,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ec_risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  risk_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  -- strategic | financial | operational | compliance | cyber | environmental
  description TEXT,
  likelihood ec_risk_level DEFAULT 'medium',
  impact ec_risk_level DEFAULT 'medium',
  residual_rating ec_risk_level DEFAULT 'medium',
  risk_owner VARCHAR(150),
  mitigation_plan TEXT,
  next_review_date DATE,
  status VARCHAR(30) DEFAULT 'open',
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, risk_code)
);

-- ============================================================
-- INTER-COMPANY LINKS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_intercompany_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  link_type VARCHAR(50) NOT NULL,
  -- sales | purchase | stock_transfer | shared_employees | shared_services | consolidation
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_company_id, to_company_id, link_type)
);

-- ============================================================
-- SHARED SERVICE RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_shared_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  consumer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_domain VARCHAR(50) NOT NULL,
  -- hr | finance | procurement | inventory | it | legal
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_company_id, consumer_company_id, service_domain)
);

-- ============================================================
-- AI CORPORATE INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  -- branch_performance | cost | profitability | workforce | manufacturing | budget | compliance | strategic
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  score DECIMAL(5,2),
  recommendations JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- AUDIT LOG (company structure changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS ec_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(100),
  details TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_address VARCHAR(60),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_audit_company ON ec_audit_log(company_id, created_at DESC);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Enterprise Structure', 'ec.view', 'enterprise_company', 'View companies, branches, org chart'),
  ('Manage Companies', 'ec.manage', 'enterprise_company', 'Create and edit companies and structure'),
  ('Manage Branches & Factories', 'ec.structure', 'enterprise_company', 'Branches, factories, warehouses, departments'),
  ('Company Governance', 'ec.governance', 'enterprise_company', 'Board, committees, meetings, signatories'),
  ('Company Documents', 'ec.documents', 'enterprise_company', 'Document vault and compliance files'),
  ('Company Risk & Insurance', 'ec.risk', 'enterprise_company', 'Risk register and insurance policies'),
  ('Enterprise Company Admin', 'ec.admin', 'enterprise_company', 'Full enterprise company administration'),
  ('Company AI Insights', 'ec.ai', 'enterprise_company', 'AI corporate assistant')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'ec.%' OR slug LIKE 'settings.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE ec_enterprise_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_profit_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_org_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_company_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_authorized_signatories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_intercompany_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_shared_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ec_audit_log ENABLE ROW LEVEL SECURITY;

-- Enterprise groups: visible to authenticated company users (read) / super admin write via policies
DO $$ BEGIN
  CREATE POLICY ec_groups_select ON ec_enterprise_groups FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_groups_write ON ec_enterprise_groups FOR ALL
    USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY ec_bu_all ON ec_business_units FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_cc_all ON ec_cost_centers FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_pc_all ON ec_profit_centers FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_org_all ON ec_org_nodes FOR ALL
    USING (company_id IS NULL OR company_id = public.user_company_id())
    WITH CHECK (company_id IS NULL OR company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_set_all ON ec_company_settings FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_brand_all ON ec_company_branding FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_docs_all ON ec_company_documents FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_cal_all ON ec_calendar_events FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_board_all ON ec_board_members FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_comm_all ON ec_committees FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_meet_all ON ec_meetings FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_sign_all ON ec_authorized_signatories FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_sh_all ON ec_shareholders FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_ins_all ON ec_insurance_policies FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_risk_all ON ec_risk_register FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_icl_all ON ec_intercompany_links FOR ALL
    USING (from_company_id = public.user_company_id() OR to_company_id = public.user_company_id())
    WITH CHECK (from_company_id = public.user_company_id() OR to_company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_ss_all ON ec_shared_services FOR ALL
    USING (provider_company_id = public.user_company_id() OR consumer_company_id = public.user_company_id())
    WITH CHECK (provider_company_id = public.user_company_id() OR consumer_company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_ai_all ON ec_ai_insights FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ec_aud_all ON ec_audit_log FOR ALL
    USING (company_id IS NULL OR company_id = public.user_company_id())
    WITH CHECK (company_id IS NULL OR company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  gid UUID;
  bu_mfg UUID;
  bu_print UUID;
  bu_corp UUID;
  root_node UUID;
  co_node UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO ec_enterprise_groups (code, name, description, headquarters_country, primary_currency)
  VALUES ('HOPE-GROUP', 'Hope Design Group Enterprise', 'Security printing & enterprise solutions group', 'Uganda', 'UGX')
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO gid;

  IF gid IS NULL THEN
    SELECT id INTO gid FROM ec_enterprise_groups WHERE code = 'HOPE-GROUP';
  END IF;

  UPDATE companies SET
    enterprise_group_id = coalesce(enterprise_group_id, gid),
    trading_name = coalesce(trading_name, name),
    company_type = coalesce(company_type, 'operating'),
    company_status = coalesce(company_status, 'active'),
    sector = coalesce(sector, 'Manufacturing'),
    industry = coalesce(industry, 'Security Printing'),
    base_currency = coalesce(base_currency, 'UGX'),
    timezone = coalesce(timezone, 'Africa/Kampala'),
    language_code = coalesce(language_code, 'en'),
    country = coalesce(country, 'Uganda')
  WHERE id = cid;

  INSERT INTO ec_business_units (company_id, code, name, unit_type, director_name, sort_order)
  VALUES
    (cid, 'BU-MFG', 'Manufacturing', 'manufacturing', 'Plant Director', 10),
    (cid, 'BU-SEC', 'Security Printing', 'security_printing', 'Print Operations Director', 20),
    (cid, 'BU-DIST', 'Distribution & Logistics', 'distribution', 'Logistics Director', 30),
    (cid, 'BU-ICT', 'ICT Services', 'ict', 'CTO', 40),
    (cid, 'BU-CORP', 'Corporate Services', 'corporate', 'COO', 50)
  ON CONFLICT (company_id, code) DO NOTHING;

  SELECT id INTO bu_mfg FROM ec_business_units WHERE company_id = cid AND code = 'BU-MFG';
  SELECT id INTO bu_print FROM ec_business_units WHERE company_id = cid AND code = 'BU-SEC';
  SELECT id INTO bu_corp FROM ec_business_units WHERE company_id = cid AND code = 'BU-CORP';

  INSERT INTO ec_cost_centers (company_id, code, name)
  VALUES
    (cid, 'CC-1000', 'Administration'),
    (cid, 'CC-2000', 'Production'),
    (cid, 'CC-3000', 'Warehouse'),
    (cid, 'CC-4000', 'Sales & Marketing'),
    (cid, 'CC-5000', 'Finance & HR')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO ec_profit_centers (company_id, code, name, business_unit_id)
  VALUES
    (cid, 'PC-PRINT', 'Security Print P&L', bu_print),
    (cid, 'PC-MFG', 'Manufacturing P&L', bu_mfg),
    (cid, 'PC-CORP', 'Corporate P&L', bu_corp)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Ensure core departments
  INSERT INTO departments (company_id, name, code, is_active, cost_center_code, manager_name)
  VALUES
    (cid, 'Finance', 'DEPT-FIN', true, 'CC-5000', 'Finance Manager'),
    (cid, 'Human Resources', 'DEPT-HR', true, 'CC-5000', 'HR Manager'),
    (cid, 'Production', 'DEPT-PROD', true, 'CC-2000', 'Production Manager'),
    (cid, 'Warehouse', 'DEPT-WH', true, 'CC-3000', 'Warehouse Manager'),
    (cid, 'Procurement', 'DEPT-PROC', true, 'CC-1000', 'Procurement Manager'),
    (cid, 'Sales', 'DEPT-SALES', true, 'CC-4000', 'Sales Manager'),
    (cid, 'Quality Control', 'DEPT-QC', true, 'CC-2000', 'QC Manager'),
    (cid, 'ICT', 'DEPT-ICT', true, 'CC-1000', 'ICT Manager'),
    (cid, 'Dispatch', 'DEPT-DISP', true, 'CC-3000', 'Dispatch Supervisor'),
    (cid, 'Service Desk', 'DEPT-SD', true, 'CC-1000', 'Service Desk Lead')
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Org chart nodes
  IF NOT EXISTS (SELECT 1 FROM ec_org_nodes WHERE company_id = cid AND code = 'ROOT-HQ') THEN
    INSERT INTO ec_org_nodes (company_id, node_type, code, name, manager_name, sort_order)
    VALUES (cid, 'company', 'ROOT-HQ', 'Hope Design Group Ltd', 'Managing Director', 0)
    RETURNING id INTO co_node;

    INSERT INTO ec_org_nodes (company_id, parent_id, node_type, code, name, manager_name, sort_order)
    VALUES
      (cid, co_node, 'business_unit', 'NODE-BU-MFG', 'Manufacturing', 'Plant Director', 10),
      (cid, co_node, 'business_unit', 'NODE-BU-SEC', 'Security Printing', 'Print Director', 20),
      (cid, co_node, 'business_unit', 'NODE-BU-CORP', 'Corporate Services', 'COO', 30),
      (cid, co_node, 'department', 'NODE-FIN', 'Finance', 'Finance Manager', 40),
      (cid, co_node, 'department', 'NODE-HR', 'Human Resources', 'HR Manager', 50),
      (cid, co_node, 'department', 'NODE-PROD', 'Production', 'Production Manager', 60),
      (cid, co_node, 'department', 'NODE-WH', 'Warehouse', 'Warehouse Manager', 70),
      (cid, co_node, 'department', 'NODE-SALES', 'Sales', 'Sales Manager', 80);
  END IF;

  INSERT INTO ec_company_branding (company_id, primary_color, secondary_color)
  VALUES (cid, '#0B1F3A', '#C9A227')
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO ec_company_settings (company_id, domain, setting_key, setting_value, description) VALUES
    (cid, 'financial', 'base_currency', '"UGX"', 'Primary reporting currency'),
    (cid, 'financial', 'fiscal_year_start_month', '1', 'Fiscal year starts January'),
    (cid, 'hr', 'standard_work_hours', '{"start":"08:00","end":"17:00","days":["Mon","Tue","Wed","Thu","Fri"]}', 'Standard working hours'),
    (cid, 'hr', 'leave_policy_days', '21', 'Annual leave entitlement'),
    (cid, 'manufacturing', 'oee_target', '85', 'Target OEE %'),
    (cid, 'procurement', 'po_approval_limit', '5000000', 'PO auto-approval limit UGX'),
    (cid, 'sales', 'credit_policy', '{"require_check":true,"default_days":30}', 'Customer credit defaults')
  ON CONFLICT (company_id, domain, setting_key) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM ec_calendar_events WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO ec_calendar_events (company_id, event_type, title, start_date, end_date) VALUES
      (cid, 'public_holiday', 'New Year''s Day', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1), make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)),
      (cid, 'public_holiday', 'Labour Day', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 5, 1), make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 5, 1)),
      (cid, 'public_holiday', 'Independence Day', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 9), make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 10, 9)),
      (cid, 'public_holiday', 'Christmas Day', make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 25), make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 12, 25)),
      (cid, 'financial_close', 'Month-end financial close', (date_trunc('month', CURRENT_DATE) + INTERVAL '27 days')::date, (date_trunc('month', CURRENT_DATE) + INTERVAL '27 days')::date),
      (cid, 'payroll', 'Monthly payroll run', (date_trunc('month', CURRENT_DATE) + INTERVAL '24 days')::date, (date_trunc('month', CURRENT_DATE) + INTERVAL '24 days')::date);
  END IF;

  INSERT INTO ec_board_members (company_id, full_name, title, member_type, is_active)
  SELECT cid, v.n, v.t, v.mt, true
  FROM (VALUES
    ('Board Chair', 'Chairperson', 'chair'),
    ('Managing Director', 'CEO / MD', 'director'),
    ('Finance Director', 'Director', 'director'),
    ('Company Secretary', 'Secretary', 'secretary')
  ) AS v(n, t, mt)
  WHERE NOT EXISTS (SELECT 1 FROM ec_board_members WHERE company_id = cid LIMIT 1);

  INSERT INTO ec_committees (company_id, code, name, chair_name, mandate)
  VALUES
    (cid, 'AUD', 'Audit Committee', 'Independent Director', 'Financial reporting and internal control oversight'),
    (cid, 'RISK', 'Risk & Compliance Committee', 'Board Chair', 'Enterprise risk and regulatory compliance'),
    (cid, 'HRREM', 'HR & Remuneration Committee', 'Non-Executive Director', 'Executive compensation and talent')
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO ec_authorized_signatories (company_id, full_name, role_title, authority_scope, limit_amount)
  SELECT cid, v.n, v.r, v.s, v.lim
  FROM (VALUES
    ('Managing Director', 'CEO', 'general', 1000000000::numeric),
    ('Finance Manager', 'Finance', 'finance', 50000000::numeric),
    ('Procurement Manager', 'Procurement', 'contracts', 20000000::numeric)
  ) AS v(n, r, s, lim)
  WHERE NOT EXISTS (SELECT 1 FROM ec_authorized_signatories WHERE company_id = cid LIMIT 1);

  INSERT INTO ec_insurance_policies (company_id, policy_type, policy_number, insurer_name, coverage_amount, premium_amount, start_date, end_date)
  SELECT cid, v.t, v.pn, v.ins, v.cov, v.prem, CURRENT_DATE - 90, CURRENT_DATE + 275
  FROM (VALUES
    ('property', 'POL-PROP-001', 'UAP Insurance', 5000000000::numeric, 12000000::numeric),
    ('liability', 'POL-LIAB-001', 'Jubilee', 1000000000::numeric, 4500000::numeric),
    ('cyber', 'POL-CYB-001', 'AIG', 500000000::numeric, 8000000::numeric)
  ) AS v(t, pn, ins, cov, prem)
  WHERE NOT EXISTS (SELECT 1 FROM ec_insurance_policies WHERE company_id = cid LIMIT 1);

  INSERT INTO ec_risk_register (company_id, risk_code, title, category, description, likelihood, impact, residual_rating, risk_owner, mitigation_plan, next_review_date)
  VALUES
    (cid, 'RSK-001', 'Power outage at print plant', 'operational',
     'Grid instability may halt security print lines.', 'high', 'high', 'medium',
     'Plant Manager', 'Backup generators + UPS; fuel contracts; staggered shifts', CURRENT_DATE + 30),
    (cid, 'RSK-002', 'Counterfeit brand leakage', 'compliance',
     'Unauthorized reproduction of security features.', 'medium', 'critical', 'medium',
     'QC Director', 'QR authentication, sealed chain-of-custody, audit trails', CURRENT_DATE + 14),
    (cid, 'RSK-003', 'Currency volatility on import materials', 'financial',
     'FX swings on ink and specialty paper imports.', 'high', 'medium', 'medium',
     'Finance Manager', 'Forward contracts; dual-currency pricing', CURRENT_DATE + 60),
    (cid, 'RSK-004', 'Cyber attack on ERP / identity', 'cyber',
     'Ransomware or credential compromise.', 'medium', 'critical', 'medium',
     'ICT Manager', 'MFA, backups, SOC monitoring, patch cadence', CURRENT_DATE + 21)
  ON CONFLICT (company_id, risk_code) DO NOTHING;

  INSERT INTO ec_company_documents (company_id, doc_type, title, doc_number, issued_date, expiry_date, status)
  SELECT cid, v.t, v.title, v.num, CURRENT_DATE - 365, CURRENT_DATE + v.exp, 'active'
  FROM (VALUES
    ('incorporation', 'Certificate of Incorporation', 'COI-HDG-001', 1825),
    ('tax', 'TIN Certificate', 'TIN-HDG-001', 365),
    ('license', 'Trading License', 'TL-2026-001', 365),
    ('iso', 'ISO 9001 Certificate', 'ISO9001-HDG', 730),
    ('policy', 'Information Security Policy', 'POL-IS-001', 365)
  ) AS v(t, title, num, exp)
  WHERE NOT EXISTS (SELECT 1 FROM ec_company_documents WHERE company_id = cid LIMIT 1);

  INSERT INTO ec_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations)
  SELECT cid, v.t, v.title, v.sum, v.sev, v.sc, v.rec::jsonb
  FROM (VALUES
    ('branch_performance', 'Kampala branch leads sales concentration',
     'Over 60% of revenue is concentrated in one branch — diversification risk.',
     'warning', 72.0,
     '["Expand Eastern channel","Balance inventory across DCs","Set regional sales targets"]'),
    ('manufacturing', 'Print plant OEE below target',
     'Current estimated OEE trails the 85% target due to changeover and downtime.',
     'warning', 68.0,
     '["SMED changeover training","Preventive maintenance windows","Track downtime codes"]'),
    ('budget', 'Admin cost center variance',
     'CC-1000 spend is tracking 12% above quarterly budget.',
     'info', 55.0,
     '["Review discretionary spend","Reallocate unused CAPEX","Manager variance meeting"]'),
    ('compliance', 'Insurance renewals within 90 days',
     'Property and cyber policies renew within the next quarter.',
     'info', 80.0,
     '["Start broker RFP","Update asset schedules","Board risk note"]')
  ) AS v(t, title, sum, sev, sc, rec)
  WHERE NOT EXISTS (SELECT 1 FROM ec_ai_insights WHERE company_id = cid LIMIT 1);

END $$;
