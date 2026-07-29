-- Hope SecureTrack ERP — Enterprise Supplier Relationship Management (SRM)
-- Lifecycle: Register → Qualify → Approve → Contract → RFQ → PO → Delivery
--            → QC → Invoice Match → Payment → Performance → Renew/Offboard
-- Multi-company RLS · Soft-delete · Full CRUD+

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE srm_supplier_status AS ENUM (
  'registered','qualifying','pending_approval','approved','active','preferred',
  'strategic','suspended','blacklisted','inactive','offboarded'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE srm_supplier_class AS ENUM (
  'strategic','preferred','approved','temporary','one_time','high_risk',
  'critical','international','local','manufacturer','distributor','wholesaler'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE srm_onboarding_status AS ENUM (
  'draft','submitted','under_review','documents_pending','approved','rejected','expired'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE srm_ncr_status AS ENUM (
  'open','investigating','capa_pending','closed','disputed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE srm_timeline_kind AS ENUM (
  'note','call','email','whatsapp','meeting','document','rfq','po','delivery',
  'qc','invoice','payment','contract','onboarding','performance','risk','system','portal'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND SUPPLIERS → Full SRM Master
-- ============================================================
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS trading_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(80) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS supplier_class VARCHAR(40) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS supplier_status VARCHAR(40) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS designation VARCHAR(150),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS physical_address TEXT,
  ADD COLUMN IF NOT EXISTS postal_address TEXT,
  ADD COLUMN IF NOT EXISTS region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS time_zone VARCHAR(80) DEFAULT 'Africa/Kampala',
  ADD COLUMN IF NOT EXISTS business_license VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100),
  ADD COLUMN IF NOT EXISTS spend_ytd DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_lifetime DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sustainability_score DECIMAL(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS compliance_score DECIMAL(5,2) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS response_time_hrs DECIMAL(8,2) DEFAULT 24,
  ADD COLUMN IF NOT EXISTS invoice_accuracy_pct DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS defect_rate_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_risk INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS supply_risk INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS country_risk INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS esg_risk INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS disruption_risk INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS territory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS business_unit VARCHAR(100),
  ADD COLUMN IF NOT EXISTS spend_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_review_at DATE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(company_id, supplier_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_class ON suppliers(company_id, supplier_class) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(company_id, category) WHERE deleted_at IS NULL;

-- ============================================================
-- CATEGORIES (unlimited custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  parent_id UUID REFERENCES srm_categories(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  role_title VARCHAR(150),
  contact_role VARCHAR(50) DEFAULT 'sales', -- sales|kam|technical|finance|ar|md|operations|emergency
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  whatsapp VARCHAR(50),
  preferred_channel VARCHAR(40) DEFAULT 'email',
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_contacts_supplier ON srm_contacts(supplier_id) WHERE deleted_at IS NULL;

-- ============================================================
-- ONBOARDING
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  application_number VARCHAR(50) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  category VARCHAR(100),
  contact_name VARCHAR(150),
  email VARCHAR(255),
  phone VARCHAR(50),
  status srm_onboarding_status DEFAULT 'draft',
  tin_number VARCHAR(100),
  vat_number VARCHAR(100),
  registration_number VARCHAR(100),
  bank_details JSONB DEFAULT '{}',
  directors JSONB DEFAULT '[]',
  documents_checklist JSONB DEFAULT '{}',
  risk_assessment TEXT,
  due_diligence_notes TEXT,
  reviewer_id UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  submitted_at TIMESTAMPTZ,
  expires_at DATE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, application_number)
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES procurement_contracts(id) ON DELETE SET NULL,
  onboarding_id UUID REFERENCES srm_onboarding(id) ON DELETE SET NULL,
  doc_type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  issued_at DATE,
  expires_at DATE,
  reminder_days INTEGER DEFAULT 30,
  status VARCHAR(30) DEFAULT 'valid',
  uploaded_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_docs_supplier ON srm_documents(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_srm_docs_expiry ON srm_documents(expires_at) WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- ============================================================
-- TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  kind srm_timeline_kind NOT NULL DEFAULT 'note',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  channel VARCHAR(50),
  ref_type VARCHAR(50),
  ref_id UUID,
  amount DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  actor_id UUID REFERENCES user_profiles(id),
  actor_name VARCHAR(150),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_timeline_supplier ON srm_timeline(supplier_id, occurred_at DESC);

-- ============================================================
-- QUALITY / NCR / CAPA
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  grn_id UUID,
  inspection_number VARCHAR(50) NOT NULL,
  result VARCHAR(30) DEFAULT 'pass', -- pass|fail|conditional|partial
  defect_count INTEGER DEFAULT 0,
  defect_rate_pct DECIMAL(5,2) DEFAULT 0,
  inspector_id UUID REFERENCES user_profiles(id),
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, inspection_number)
);

CREATE TABLE IF NOT EXISTS srm_ncrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ncr_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  inspection_id UUID REFERENCES srm_quality_inspections(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  status srm_ncr_status DEFAULT 'open',
  defect_type VARCHAR(100),
  quantity_affected DECIMAL(18,4) DEFAULT 0,
  capa_required BOOLEAN DEFAULT true,
  capa_description TEXT,
  capa_due_date DATE,
  capa_completed_at TIMESTAMPTZ,
  rts_required BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES user_profiles(id),
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, ncr_number)
);

-- ============================================================
-- PERFORMANCE SCORECARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  on_time_delivery DECIMAL(5,2) DEFAULT 0,
  delivery_accuracy DECIMAL(5,2) DEFAULT 0,
  product_quality DECIMAL(5,2) DEFAULT 0,
  defect_rate DECIMAL(5,2) DEFAULT 0,
  cost_competitiveness DECIMAL(5,2) DEFAULT 0,
  invoice_accuracy DECIMAL(5,2) DEFAULT 0,
  response_time DECIMAL(5,2) DEFAULT 0,
  contract_compliance DECIMAL(5,2) DEFAULT 0,
  sustainability DECIMAL(5,2) DEFAULT 0,
  overall_score DECIMAL(5,2) DEFAULT 0,
  grade VARCHAR(5),
  comments TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, supplier_id, period_year, period_month)
);

-- ============================================================
-- RISK REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  risk_type VARCHAR(50) NOT NULL, -- financial|compliance|supply|country|operational|cyber|esg
  title VARCHAR(255) NOT NULL,
  description TEXT,
  likelihood INTEGER DEFAULT 3 CHECK (likelihood BETWEEN 1 AND 5),
  impact INTEGER DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
  status VARCHAR(30) DEFAULT 'open',
  mitigation TEXT,
  owner_id UUID REFERENCES user_profiles(id),
  review_date DATE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_risks_supplier ON srm_risks(supplier_id, status);

-- ============================================================
-- AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT NOT NULL,
  score DECIMAL(8,2),
  status VARCHAR(30) DEFAULT 'open',
  metadata JSONB DEFAULT '{}',
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  channel VARCHAR(40) NOT NULL DEFAULT 'email',
  direction VARCHAR(20) DEFAULT 'outbound',
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(40) DEFAULT 'sent',
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTAL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_portal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL DEFAULT 'profile_update',
  subject VARCHAR(255) NOT NULL,
  body TEXT,
  status VARCHAR(40) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  handled_by UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTRACT ENHANCEMENTS
-- ============================================================
ALTER TABLE procurement_contracts
  ADD COLUMN IF NOT EXISTS sla_terms TEXT,
  ADD COLUMN IF NOT EXISTS spend_to_date DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notice_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS price_agreement JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS volume_commitment DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- RFQ EVALUATION ROUNDS
-- ============================================================
ALTER TABLE rfqs
  ADD COLUMN IF NOT EXISTS evaluation_method VARCHAR(50) DEFAULT 'technical_commercial',
  ADD COLUMN IF NOT EXISTS blind_bidding BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_round BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS technical_weight DECIMAL(5,2) DEFAULT 40,
  ADD COLUMN IF NOT EXISTS commercial_weight DECIMAL(5,2) DEFAULT 60,
  ADD COLUMN IF NOT EXISTS committee_notes TEXT,
  ADD COLUMN IF NOT EXISTS award_recommendation TEXT;

CREATE TABLE IF NOT EXISTS srm_rfq_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES supplier_quotations(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  evaluator_id UUID REFERENCES user_profiles(id),
  round_number INTEGER DEFAULT 1,
  technical_score DECIMAL(5,2) DEFAULT 0,
  commercial_score DECIMAL(5,2) DEFAULT 0,
  total_score DECIMAL(5,2) DEFAULT 0,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- THREE-WAY MATCH LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_match_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  grn_id UUID,
  ap_invoice_id UUID,
  match_status VARCHAR(30) DEFAULT 'pending', -- matched|partial|exception|pending
  po_amount DECIMAL(18,2),
  grn_amount DECIMAL(18,2),
  invoice_amount DECIMAL(18,2),
  variance DECIMAL(18,2) DEFAULT 0,
  notes TEXT,
  matched_by UUID REFERENCES user_profiles(id),
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS srm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srm_audit ON srm_audit_log(company_id, created_at DESC);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View SRM', 'srm.view', 'srm', 'View supplier relationship management'),
  ('Manage SRM', 'srm.manage', 'srm', 'Manage suppliers and onboarding'),
  ('SRM Approve', 'srm.approve', 'srm', 'Approve suppliers and onboarding'),
  ('SRM Contracts', 'srm.contracts', 'srm', 'Manage supplier contracts'),
  ('SRM Quality', 'srm.quality', 'srm', 'Quality inspections and NCRs'),
  ('SRM AI', 'srm.ai', 'srm', 'AI procurement intelligence'),
  ('SRM Portal', 'srm.portal', 'srm', 'Supplier portal administration'),
  ('SRM Admin', 'srm.admin', 'srm', 'SRM administration')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'srm.%' OR slug LIKE 'procurement.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000010', id FROM permissions
WHERE slug IN ('srm.view','srm.manage','srm.quality','procurement.view','procurement.manage','procurement.suppliers')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE srm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_ncrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_portal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_rfq_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_match_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY srm_categories_all ON srm_categories FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_contacts_all ON srm_contacts FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_onboarding_all ON srm_onboarding FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_documents_all ON srm_documents FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_timeline_all ON srm_timeline FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_quality_all ON srm_quality_inspections FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_ncrs_all ON srm_ncrs FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_scorecards_all ON srm_scorecards FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_risks_all ON srm_risks FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_insights_all ON srm_insights FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_comms_all ON srm_communications FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_portal_all ON srm_portal_requests FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_eval_all ON srm_rfq_evaluations FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_match_all ON srm_match_logs FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY srm_audit_all ON srm_audit_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED — Hope Design Group
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
  sup1 UUID;
  sup2 UUID;
  sup3 UUID;
  onb1 UUID;
BEGIN
  -- Categories
  INSERT INTO srm_categories (company_id, code, name, sort_order) VALUES
    (cid, 'RAW', 'Raw Materials', 1),
    (cid, 'PKG', 'Packaging Materials', 2),
    (cid, 'MCH', 'Machinery', 3),
    (cid, 'PRT', 'Printing Equipment', 4),
    (cid, 'OFF', 'Office Supplies', 5),
    (cid, 'ICT', 'ICT Equipment', 6),
    (cid, 'SFT', 'Software Vendors', 7),
    (cid, 'LOG', 'Logistics Providers', 8),
    (cid, 'MNT', 'Maintenance Contractors', 9),
    (cid, 'SEC', 'Security Services', 10),
    (cid, 'CLN', 'Cleaning Services', 11),
    (cid, 'PRO', 'Professional Services', 12),
    (cid, 'UTL', 'Utilities', 13),
    (cid, 'MKT', 'Marketing Agencies', 14),
    (cid, 'MFG', 'Manufacturing Partners', 15)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Suppliers
  SELECT id INTO sup1 FROM suppliers WHERE company_id = cid AND code = 'SUP-PULP-01' LIMIT 1;
  IF sup1 IS NULL THEN
    INSERT INTO suppliers (
      company_id, code, name, trading_name, category, supplier_type, supplier_class, supplier_status,
      contact_person, email, phone, whatsapp, country, city, region, currency, preferred_currency,
      payment_terms_days, is_approved_vendor, is_active, on_time_delivery_pct, quality_score,
      overall_score, risk_score, sustainability_score, compliance_score, spend_ytd, spend_category,
      tin_vat, registration_number, portal_enabled
    ) VALUES (
      cid, 'SUP-PULP-01', 'East African Pulp & Paper Ltd', 'EAPP',
      'raw_materials', 'manufacturer', 'strategic', 'strategic',
      'James Okello', 'sales@eapp.ug', '+256414220100', '+256772100200',
      'Uganda', 'Jinja', 'Eastern', 'UGX', 'UGX', 45, true, true,
      96.5, 94.0, 93.0, 25, 72, 88, 420000000, 'Paper raw materials',
      '1000123456', 'REG-UG-2018-441', true
    ) RETURNING id INTO sup1;
  ELSE
    UPDATE suppliers SET
      supplier_class = COALESCE(supplier_class, 'strategic'),
      supplier_status = COALESCE(supplier_status, 'strategic'),
      overall_score = COALESCE(overall_score, 93),
      portal_enabled = true
    WHERE id = sup1;
  END IF;

  SELECT id INTO sup2 FROM suppliers WHERE company_id = cid AND code = 'SUP-INK-01' LIMIT 1;
  IF sup2 IS NULL THEN
    INSERT INTO suppliers (
      company_id, code, name, trading_name, category, supplier_type, supplier_class, supplier_status,
      contact_person, email, phone, country, city, currency, payment_terms_days,
      is_approved_vendor, is_active, on_time_delivery_pct, quality_score, overall_score, risk_score,
      spend_ytd, spend_category, portal_enabled
    ) VALUES (
      cid, 'SUP-INK-01', 'Security Ink Solutions GmbH', 'SIS',
      'raw_materials', 'manufacturer', 'preferred', 'preferred',
      'Hans Mueller', 'export@sis-ink.de', '+491511234567', 'Germany', 'Frankfurt', 'EUR', 30,
      true, true, 91.0, 98.0, 94.0, 35, 180000000, 'Security inks', true
    ) RETURNING id INTO sup2;
  END IF;

  SELECT id INTO sup3 FROM suppliers WHERE company_id = cid AND code = 'SUP-LOG-01' LIMIT 1;
  IF sup3 IS NULL THEN
    INSERT INTO suppliers (
      company_id, code, name, category, supplier_type, supplier_class, supplier_status,
      contact_person, email, phone, country, city, currency, payment_terms_days,
      is_approved_vendor, is_active, on_time_delivery_pct, quality_score, overall_score, risk_score,
      spend_ytd, spend_category
    ) VALUES (
      cid, 'SUP-LOG-01', 'Kampala Freight Express Ltd',
      'logistics', 'service', 'approved', 'active',
      'Sarah Nambi', 'ops@kfe.ug', '+256700334455', 'Uganda', 'Kampala', 'UGX', 15,
      true, true, 88.0, 90.0, 86.0, 45, 65000000, 'Inbound logistics'
    ) RETURNING id INTO sup3;
  END IF;

  -- Contacts
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_contacts WHERE company_id = cid AND supplier_id = sup1 LIMIT 1) THEN
    INSERT INTO srm_contacts (company_id, supplier_id, first_name, last_name, role_title, contact_role, email, mobile, is_primary) VALUES
      (cid, sup1, 'James', 'Okello', 'Key Account Manager', 'kam', 'james.okello@eapp.ug', '+256772100200', true),
      (cid, sup1, 'Grace', 'Auma', 'Accounts Receivable', 'ar', 'ar@eapp.ug', '+256772100201', false),
      (cid, sup1, 'Peter', 'Mugisha', 'Technical Support', 'technical', 'tech@eapp.ug', '+256772100202', false);
  END IF;

  -- Onboarding
  IF NOT EXISTS (SELECT 1 FROM srm_onboarding WHERE company_id = cid AND application_number = 'ONB-SRM-001' LIMIT 1) THEN
    INSERT INTO srm_onboarding (
      company_id, supplier_id, application_number, company_name, category, contact_name, email, phone,
      status, tin_number, registration_number, documents_checklist, submitted_at, approved_at
    ) VALUES (
      cid, sup1, 'ONB-SRM-001', 'East African Pulp & Paper Ltd', 'raw_materials',
      'James Okello', 'sales@eapp.ug', '+256414220100',
      'approved', '1000123456', 'REG-UG-2018-441',
      '{"registration":true,"tin":true,"vat":true,"tax_clearance":true,"bank":true,"iso":true,"insurance":true}',
      NOW() - INTERVAL '120 days', NOW() - INTERVAL '100 days'
    ) RETURNING id INTO onb1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM srm_onboarding WHERE company_id = cid AND application_number = 'ONB-SRM-002' LIMIT 1) THEN
    INSERT INTO srm_onboarding (
      company_id, application_number, company_name, category, contact_name, email, phone,
      status, tin_number, documents_checklist, submitted_at
    ) VALUES (
      cid, 'ONB-SRM-002', 'Nile Packaging Industries', 'packaging',
      'Mary Atim', 'mary@nilepack.ug', '+256753998877',
      'under_review', '1000987654',
      '{"registration":true,"tin":true,"vat":false,"tax_clearance":true,"bank":true,"iso":false,"insurance":true}',
      NOW() - INTERVAL '3 days'
    );
  END IF;

  -- Timeline
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_timeline WHERE company_id = cid AND title = 'Strategic supplier agreement renewed' LIMIT 1) THEN
    INSERT INTO srm_timeline (company_id, supplier_id, kind, title, body, actor_name, occurred_at) VALUES
      (cid, sup1, 'contract', 'Strategic supplier agreement renewed', 'Framework for pulp supply 2026–2027 signed.', 'Procurement', NOW() - INTERVAL '30 days'),
      (cid, sup1, 'delivery', 'On-time delivery of pulp batch #4412', 'GRN matched PO-2026-0188 fully.', 'Warehouse', NOW() - INTERVAL '12 days'),
      (cid, sup1, 'qc', 'Quality inspection passed', 'Moisture and gsm within tolerance.', 'QC Lead', NOW() - INTERVAL '11 days'),
      (cid, sup2, 'rfq', 'Security ink RFQ response received', 'Quote within 2% of last price agreement.', 'Buyer', NOW() - INTERVAL '5 days'),
      (cid, sup3, 'risk', 'Carrier delay risk elevated', 'Road corridor congestion — alternate carrier recommended.', 'AI SRM', NOW() - INTERVAL '2 days');
  END IF;

  -- Documents
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_documents WHERE company_id = cid AND title = 'ISO 9001 Certificate — EAPP' LIMIT 1) THEN
    INSERT INTO srm_documents (company_id, supplier_id, doc_type, title, file_name, expires_at, status) VALUES
      (cid, sup1, 'certificate', 'ISO 9001 Certificate — EAPP', 'iso9001-eapp.pdf', CURRENT_DATE + 200, 'valid'),
      (cid, sup1, 'insurance', 'Public liability insurance — EAPP', 'insurance-eapp.pdf', CURRENT_DATE + 90, 'valid'),
      (cid, sup1, 'tax_clearance', 'Tax clearance certificate', 'tax-eapp.pdf', CURRENT_DATE + 45, 'valid'),
      (cid, sup2, 'certificate', 'REACH compliance certificate', 'reach-sis.pdf', CURRENT_DATE + 300, 'valid');
  END IF;

  -- Quality / NCR
  IF sup3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_ncrs WHERE company_id = cid AND ncr_number = 'NCR-SRM-001' LIMIT 1) THEN
    INSERT INTO srm_quality_inspections (
      company_id, supplier_id, inspection_number, result, defect_count, defect_rate_pct, notes
    ) VALUES (
      cid, sup3, 'QI-SRM-001', 'conditional', 2, 1.5, 'Minor packaging damage on 2 cartons.'
    );

    INSERT INTO srm_ncrs (
      company_id, ncr_number, supplier_id, title, description, severity, status,
      defect_type, quantity_affected, capa_required, capa_description, capa_due_date
    ) VALUES (
      cid, 'NCR-SRM-001', sup3, 'Transit packaging damage',
      'Two cartons arrived with crushed corners during inbound transfer.',
      'low', 'capa_pending', 'packaging', 2, true,
      'Improve wrap and corner protectors for road freights.', CURRENT_DATE + 14
    );
  END IF;

  -- Scorecards
  IF sup1 IS NOT NULL THEN
    INSERT INTO srm_scorecards (
      company_id, supplier_id, period_year, period_month,
      on_time_delivery, delivery_accuracy, product_quality, defect_rate,
      cost_competitiveness, invoice_accuracy, response_time, contract_compliance,
      sustainability, overall_score, grade
    ) VALUES (
      cid, sup1, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
      96.5, 98, 94, 0.8, 88, 99, 92, 95, 72, 93.2, 'A'
    ) ON CONFLICT (company_id, supplier_id, period_year, period_month) DO UPDATE SET
      overall_score = 93.2, grade = 'A', generated_at = NOW();
  END IF;

  IF sup2 IS NOT NULL THEN
    INSERT INTO srm_scorecards (
      company_id, supplier_id, period_year, period_month,
      on_time_delivery, delivery_accuracy, product_quality, defect_rate,
      cost_competitiveness, invoice_accuracy, response_time, contract_compliance,
      sustainability, overall_score, grade
    ) VALUES (
      cid, sup2, EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int,
      91, 97, 98, 0.2, 85, 100, 88, 96, 80, 94.1, 'A'
    ) ON CONFLICT (company_id, supplier_id, period_year, period_month) DO NOTHING;
  END IF;

  -- Risks
  IF sup2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_risks WHERE company_id = cid AND title LIKE 'FX exposure%' LIMIT 1) THEN
    INSERT INTO srm_risks (company_id, supplier_id, risk_type, title, description, likelihood, impact, status, mitigation) VALUES
      (cid, sup2, 'financial', 'FX exposure on EUR ink contracts',
       'EUR/UGX volatility may inflate landed cost by >8%.', 3, 4, 'open',
       'Hedge via forward contracts; dual-source secondary ink vendor.'),
      (cid, sup3, 'supply', 'Single-carrier dependency on Kampala corridor',
       'High concentration of inbound freight on one logistics partner.', 4, 3, 'open',
       'Qualify alternate carrier; dual-award logistics RFQ.'),
      (cid, sup1, 'compliance', 'Tax clearance expiring within 60 days',
       'EAPP tax clearance near expiry — block new POs if lapsed.', 2, 4, 'open',
       'Request renewed clearance; calendar reminder at T-30.');
  END IF;

  -- Insights
  INSERT INTO srm_insights (company_id, supplier_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, sup1, 'negotiation', 'medium',
    'Volume rebate opportunity — EAPP pulp',
    'YTD spend supports Tier-2 rebate negotiation (~2.5%). Schedule Q3 commercial review.',
    78, 'open'
  WHERE sup1 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM srm_insights WHERE company_id = cid AND title LIKE 'Volume rebate%' LIMIT 1);

  INSERT INTO srm_insights (company_id, supplier_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, sup3, 'delay_risk', 'high',
    'Predicted delivery delays — Eastern corridor',
    'AI predicts 18% higher delay probability next 14 days. Pre-book alternate capacity.',
    82, 'open'
  WHERE sup3 IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM srm_insights WHERE company_id = cid AND title LIKE 'Predicted delivery%' LIMIT 1);

  INSERT INTO srm_insights (company_id, insight_type, severity, title, recommendation, score, status)
  SELECT cid, 'duplicate_risk', 'low',
    'Potential duplicate supplier records',
    'Review suppliers with similar names/TINs before next master data cleanup cycle.',
    55, 'open'
  WHERE NOT EXISTS (SELECT 1 FROM srm_insights WHERE company_id = cid AND title LIKE 'Potential duplicate%' LIMIT 1);

  -- Match log sample
  IF sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM srm_match_logs WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO srm_match_logs (
      company_id, supplier_id, match_status, po_amount, grn_amount, invoice_amount, variance, notes, matched_at
    ) VALUES (
      cid, sup1, 'matched', 45000000, 45000000, 45000000, 0, 'Three-way match clean for PO pulp batch.', NOW() - INTERVAL '10 days'
    );
  END IF;

END $$;
