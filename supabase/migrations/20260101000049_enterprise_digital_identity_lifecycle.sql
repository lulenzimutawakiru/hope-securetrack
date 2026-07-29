-- Hope SecureTrack ERP — Enterprise Digital Identity Lifecycle
-- Single source of truth: Master Identity (UPID) → HR, Users, Payroll, Workforce,
-- Attendance, Leave, Assets, ID Cards, Biometrics, Portals, Approvals, Audit
-- Builds on 00048 (uw_persons). HR is authoritative for workforce data.

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE di_lifecycle_stage AS ENUM (
  'recruitment','interview','offer','hiring','onboarding','probation',
  'confirmation','active','promotion','transfer','training','performance',
  'discipline','leave','suspension','exit','offboarding','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_provision_job_status AS ENUM (
  'draft','queued','running','partial','completed','failed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_checklist_status AS ENUM (
  'pending','running','done','skipped','failed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_org_unit_type AS ENUM (
  'company','branch','plant','factory','warehouse','department',
  'team','cost_center','business_unit','division','section'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_clearance_level AS ENUM (
  'visitor','employee','supervisor','manager','finance','hr',
  'executive','administrator','system_owner'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_card_template AS ENUM (
  'staff','management','contractor','visitor','temporary','intern','driver'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE di_biometric_modality AS ENUM (
  'fingerprint','face','iris','palm','voice'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND MASTER PERSON (full profile fields)
-- ============================================================
ALTER TABLE uw_persons
  ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS staff_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS national_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS driving_permit VARCHAR(80),
  ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tin_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payroll_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS social_security VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS disability_info TEXT,
  ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS physical_address TEXT,
  ADD COLUMN IF NOT EXISTS postal_address TEXT,
  ADD COLUMN IF NOT EXISTS gps_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS gps_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS division_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS section_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS position_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS grade VARCHAR(50),
  ADD COLUMN IF NOT EXISTS job_family VARCHAR(100),
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS confirmation_date DATE,
  ADD COLUMN IF NOT EXISTS exit_date DATE,
  ADD COLUMN IF NOT EXISTS lifecycle_stage di_lifecycle_stage DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS clearance_level di_clearance_level DEFAULT 'employee',
  ADD COLUMN IF NOT EXISTS org_unit_id UUID,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50),
  ADD COLUMN IF NOT EXISTS medical_clearance_status VARCHAR(30) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS biometric_enrolled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_enrolled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS digital_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_identity_token VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_uw_persons_lifecycle
  ON uw_persons(company_id, lifecycle_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uw_persons_clearance
  ON uw_persons(company_id, clearance_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_uw_persons_employee_number
  ON uw_persons(company_id, employee_number) WHERE employee_number IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- ORGANIZATION STRUCTURE (unlimited hierarchy)
-- ============================================================
CREATE TABLE IF NOT EXISTS di_org_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES di_org_units(id) ON DELETE SET NULL,
  unit_type di_org_unit_type NOT NULL DEFAULT 'department',
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  manager_person_id UUID REFERENCES uw_persons(id) ON DELETE SET NULL,
  cost_center VARCHAR(80),
  branch_name VARCHAR(150),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_di_org_parent ON di_org_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_di_org_company ON di_org_units(company_id) WHERE deleted_at IS NULL;

ALTER TABLE uw_persons
  DROP CONSTRAINT IF EXISTS uw_persons_org_unit_id_fkey;
ALTER TABLE uw_persons
  ADD CONSTRAINT uw_persons_org_unit_id_fkey
  FOREIGN KEY (org_unit_id) REFERENCES di_org_units(id) ON DELETE SET NULL;

-- ============================================================
-- LIFECYCLE STAGE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS di_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  from_stage di_lifecycle_stage,
  to_stage di_lifecycle_stage NOT NULL,
  reason TEXT,
  effective_date DATE DEFAULT CURRENT_DATE,
  actor_id UUID REFERENCES user_profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_lifecycle_person
  ON di_lifecycle_events(person_id, created_at DESC);

-- ============================================================
-- ENTERPRISE PROVISIONING ENGINE (HR hire → all modules)
-- ============================================================
CREATE TABLE IF NOT EXISTS di_provision_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  employment_type VARCHAR(50) DEFAULT 'permanent',
  -- checklist of provision steps as JSON array of {step_key, label, module, required}
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  default_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  default_clearance di_clearance_level DEFAULT 'employee',
  card_template di_card_template DEFAULT 'staff',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS di_provision_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  person_id UUID REFERENCES uw_persons(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  template_id UUID REFERENCES di_provision_templates(id) ON DELETE SET NULL,
  status di_provision_job_status NOT NULL DEFAULT 'draft',
  trigger_source VARCHAR(50) DEFAULT 'hr_hire',
  -- hr_hire | manual | bulk | rehire | transfer | exit
  display_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  department VARCHAR(100),
  job_title VARCHAR(150),
  employment_type VARCHAR(50),
  hire_date DATE,
  requested_by UUID REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  result_summary JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

CREATE INDEX IF NOT EXISTS idx_di_jobs_status
  ON di_provision_jobs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_di_jobs_person
  ON di_provision_jobs(person_id);

CREATE TABLE IF NOT EXISTS di_provision_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES di_provision_jobs(id) ON DELETE CASCADE,
  step_key VARCHAR(80) NOT NULL,
  step_label VARCHAR(200) NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  required BOOLEAN DEFAULT true,
  status di_checklist_status NOT NULL DEFAULT 'pending',
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(job_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_di_checklist_job ON di_provision_checklist(job_id, sort_order);

-- Job number sequence
CREATE TABLE IF NOT EXISTS di_job_sequences (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.next_di_job_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
  y TEXT := to_char(CURRENT_DATE, 'YYYY');
BEGIN
  INSERT INTO di_job_sequences (company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE
    SET last_number = di_job_sequences.last_number + 1,
        updated_at = NOW()
  RETURNING last_number INTO n;
  RETURN 'HDG-DI-' || y || '-' || lpad(n::text, 6, '0');
END;
$$;

-- ============================================================
-- HR ↔ MODULE SYNC RULES & LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS di_sync_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_key VARCHAR(80) NOT NULL,
  -- department | job_title | manager | cost_center | branch | email | status | clearance
  target_modules TEXT[] NOT NULL DEFAULT ARRAY['identity','payroll','hopechat','service_desk','credentials']::TEXT[],
  auto_sync BOOLEAN DEFAULT true,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(company_id, field_key)
);

CREATE TABLE IF NOT EXISTS di_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID REFERENCES uw_persons(id) ON DELETE SET NULL,
  field_key VARCHAR(80) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  targets_updated TEXT[] DEFAULT ARRAY[]::TEXT[],
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_sync_log_person ON di_sync_log(person_id, created_at DESC);

-- ============================================================
-- SECURITY CLEARANCE ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS di_clearance_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  clearance_level di_clearance_level NOT NULL,
  reason TEXT,
  granted_by UUID REFERENCES user_profiles(id),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_clearance_person
  ON di_clearance_assignments(person_id) WHERE is_active;

-- Module access by clearance
CREATE TABLE IF NOT EXISTS di_clearance_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  clearance_level di_clearance_level NOT NULL,
  module_code VARCHAR(50) NOT NULL,
  can_view BOOLEAN DEFAULT true,
  can_create BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_admin BOOLEAN DEFAULT false,
  UNIQUE(company_id, clearance_level, module_code)
);

-- ============================================================
-- COMPANY ID CARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS di_id_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  card_type di_card_template NOT NULL DEFAULT 'staff',
  front_layout JSONB DEFAULT '{}'::jsonb,
  back_layout JSONB DEFAULT '{}'::jsonb,
  include_qr BOOLEAN DEFAULT true,
  include_barcode BOOLEAN DEFAULT true,
  include_nfc BOOLEAN DEFAULT false,
  include_blood_group BOOLEAN DEFAULT true,
  include_emergency BOOLEAN DEFAULT true,
  validity_months INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS di_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  template_id UUID REFERENCES di_id_card_templates(id) ON DELETE SET NULL,
  card_number VARCHAR(50) NOT NULL,
  card_type di_card_template DEFAULT 'staff',
  qr_payload TEXT,
  barcode_value VARCHAR(80),
  nfc_uid VARCHAR(80),
  issue_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'active',
  -- active | expired | reissued | replaced | lost | revoked
  print_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  digital_signature_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, card_number)
);

CREATE INDEX IF NOT EXISTS idx_di_cards_person ON di_id_cards(person_id);

-- ============================================================
-- BIOMETRIC IDENTITY
-- ============================================================
CREATE TABLE IF NOT EXISTS di_biometric_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  modality di_biometric_modality NOT NULL,
  vendor VARCHAR(50) DEFAULT 'generic',
  -- zkteco | suprema | hikvision | anviz | dahua | generic
  template_hash VARCHAR(128),
  device_id VARCHAR(100),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(person_id, modality, vendor)
);

CREATE TABLE IF NOT EXISTS di_biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  vendor VARCHAR(50) DEFAULT 'generic',
  location VARCHAR(150),
  modalities TEXT[] DEFAULT ARRAY['fingerprint']::TEXT[],
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

-- ============================================================
-- DOCUMENT VAULT (employment docs linked to person)
-- ============================================================
CREATE TABLE IF NOT EXISTS di_document_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  doc_type VARCHAR(80) NOT NULL,
  -- contract | offer | academic | national_id | passport | medical
  -- training | appraisal | disciplinary | promotion | exit | other
  title VARCHAR(255) NOT NULL,
  file_url TEXT,
  version INTEGER DEFAULT 1,
  is_encrypted BOOLEAN DEFAULT true,
  sensitivity VARCHAR(30) DEFAULT 'confidential',
  uploaded_by UUID REFERENCES user_profiles(id),
  valid_from DATE,
  valid_to DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_docs_person ON di_document_vault(person_id) WHERE deleted_at IS NULL;

-- ============================================================
-- ASSET ASSIGNMENT LINKS (person-centric)
-- ============================================================
CREATE TABLE IF NOT EXISTS di_asset_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES uw_persons(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL,
  -- laptop | desktop | phone | vehicle | uniform | tools | printer
  -- id_card | access_card | sim | software_license
  asset_code VARCHAR(80),
  asset_name VARCHAR(200),
  serial_number VARCHAR(100),
  status VARCHAR(30) DEFAULT 'issued',
  -- issued | returned | maintenance | replacement | lost | damaged
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_di_assets_person ON di_asset_assignments(person_id);

-- ============================================================
-- WORKFORCE AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS di_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  person_id UUID REFERENCES uw_persons(id) ON DELETE SET NULL,
  insight_type VARCHAR(50) NOT NULL,
  -- turnover_risk | promotion | overtime_abuse | staffing_forecast
  -- training_gap | absenteeism | shift_optimize | policy_answer | performance_summary
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  score DECIMAL(5,2),
  recommendations JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_di_ai_company ON di_ai_insights(company_id, status);

-- ============================================================
-- UNIFIED APPROVAL ROUTING (identity-aware)
-- ============================================================
CREATE TABLE IF NOT EXISTS di_approval_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  process_code VARCHAR(50) NOT NULL,
  -- leave | payroll | recruitment | purchase | expense | project
  -- asset | promotion | transfer | finance
  name VARCHAR(150) NOT NULL,
  route_type VARCHAR(30) DEFAULT 'sequential',
  -- sequential | parallel | conditional
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{order, role, clearance_min, org_level, can_delegate}]
  escalation_hours INTEGER DEFAULT 48,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, process_code)
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Digital Identity Lifecycle', 'di.view', 'digital_identity', 'View lifecycle, org, clearance, ID cards'),
  ('Manage Digital Identity', 'di.manage', 'digital_identity', 'Hire orchestration, provision jobs, sync'),
  ('Provision Accounts from HR', 'di.provision', 'digital_identity', 'Run enterprise provisioning engine'),
  ('Manage Org Structure', 'di.org', 'digital_identity', 'Companies, branches, departments hierarchy'),
  ('Manage Security Clearance', 'di.clearance', 'digital_identity', 'Clearance levels and matrix'),
  ('Manage Company ID Cards', 'di.cards', 'digital_identity', 'Issue, print, reissue company IDs'),
  ('Manage Biometrics', 'di.biometrics', 'digital_identity', 'Biometric enrollment and devices'),
  ('Digital Identity Admin', 'di.admin', 'digital_identity', 'Full digital identity administration'),
  ('View Workforce AI', 'di.ai', 'digital_identity', 'AI workforce insights and recommendations')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'di.%' OR slug LIKE 'uw.%' OR slug LIKE 'hr.%' OR slug LIKE 'iam.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE di_org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_provision_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_provision_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_provision_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_job_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_sync_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_clearance_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_clearance_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_id_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_biometric_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_biometric_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_document_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE di_approval_routes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY di_org_all ON di_org_units FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_life_all ON di_lifecycle_events FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_pt_all ON di_provision_templates FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_jobs_all ON di_provision_jobs FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_check_all ON di_provision_checklist FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_jseq_all ON di_job_sequences FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_sr_all ON di_sync_rules FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_sl_all ON di_sync_log FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_ca_all ON di_clearance_assignments FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_cm_all ON di_clearance_matrix FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_ict_all ON di_id_card_templates FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_cards_all ON di_id_cards FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_bio_all ON di_biometric_profiles FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_dev_all ON di_biometric_devices FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_docs_all ON di_document_vault FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_ast_all ON di_asset_assignments FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_ai_all ON di_ai_insights FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY di_ar_all ON di_approval_routes FOR ALL
    USING (company_id = public.user_company_id()) WITH CHECK (company_id = public.user_company_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 360 VIEW EXTENSION (drop first: p.* column set grew in this migration)
-- ============================================================
DROP VIEW IF EXISTS uw_person_360;
CREATE VIEW uw_person_360 AS
SELECT
  p.*,
  (SELECT count(*) FROM uw_person_links l WHERE l.person_id = p.id) AS link_count,
  (SELECT count(*) FROM uw_module_entitlements e WHERE e.person_id = p.id AND e.granted) AS entitlement_count,
  (SELECT count(*) FROM di_id_cards c WHERE c.person_id = p.id AND c.status = 'active') AS active_cards,
  (SELECT count(*) FROM di_biometric_profiles b WHERE b.person_id = p.id AND b.is_active) AS biometric_count,
  (SELECT count(*) FROM di_asset_assignments a WHERE a.person_id = p.id AND a.status = 'issued') AS assets_issued,
  ou.name AS org_unit_name,
  ou.unit_type AS org_unit_type
FROM uw_persons p
LEFT JOIN di_org_units ou ON ou.id = p.org_unit_id
WHERE p.deleted_at IS NULL;

-- ============================================================
-- SEED DATA (per company)
-- ============================================================
DO $$
DECLARE
  cid UUID;
  steps_json JSONB;
BEGIN
  SELECT id INTO cid FROM companies LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  steps_json := '[
    {"step_key":"master_identity","label":"Create Master Identity (UPID)","module":"identity","required":true},
    {"step_key":"hr_employee","label":"HR Employee Record","module":"hr","required":true},
    {"step_key":"erp_user","label":"ERP User Account","module":"identity","required":true},
    {"step_key":"login_credentials","label":"Login Credentials","module":"identity","required":true},
    {"step_key":"company_email","label":"Company Email Profile","module":"identity","required":true},
    {"step_key":"hopechat","label":"HopeChat Account","module":"hopechat","required":true},
    {"step_key":"service_desk","label":"Service Desk Account","module":"service_desk","required":true},
    {"step_key":"employee_portal","label":"Employee Portal Access","module":"portal","required":true},
    {"step_key":"payroll_profile","label":"Payroll Profile","module":"payroll","required":true},
    {"step_key":"attendance_profile","label":"Attendance Profile","module":"hr","required":true},
    {"step_key":"leave_profile","label":"Leave Profile","module":"hr","required":true},
    {"step_key":"performance_profile","label":"Performance Profile","module":"hr","required":false},
    {"step_key":"asset_profile","label":"Asset Assignment Profile","module":"assets","required":false},
    {"step_key":"company_id_card","label":"Company ID Card","module":"credentials","required":true},
    {"step_key":"qr_identity","label":"QR Identity Token","module":"credentials","required":true},
    {"step_key":"digital_signature","label":"Digital Signature Placeholder","module":"identity","required":false},
    {"step_key":"mfa_enrollment","label":"MFA Enrollment Flag","module":"identity","required":true}
  ]'::jsonb;

  INSERT INTO di_provision_templates (company_id, code, name, employment_type, steps, default_modules, default_clearance, card_template)
  VALUES
    (cid, 'PERM-STAFF', 'Permanent Staff Onboarding', 'permanent', steps_json,
     ARRAY['identity','hr','payroll','hopechat','service_desk','portal','credentials','assets'],
     'employee', 'staff'),
    (cid, 'CONTRACTOR', 'Contractor Onboarding', 'contractor', steps_json,
     ARRAY['identity','hr','hopechat','service_desk','portal','credentials'],
     'employee', 'contractor'),
    (cid, 'INTERN', 'Intern Onboarding', 'intern', steps_json,
     ARRAY['identity','hr','hopechat','portal','credentials'],
     'employee', 'intern'),
    (cid, 'MGMT', 'Management Onboarding', 'permanent', steps_json,
     ARRAY['identity','hr','payroll','hopechat','service_desk','portal','credentials','assets','finance'],
     'manager', 'management')
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Org structure seed
  INSERT INTO di_org_units (company_id, unit_type, code, name, sort_order)
  VALUES
    (cid, 'company', 'HOPE-HQ', 'Hope Design Group HQ', 0),
    (cid, 'branch', 'BR-KLA', 'Kampala Branch', 1),
    (cid, 'plant', 'PLT-PRT', 'Secure Print Plant', 2),
    (cid, 'warehouse', 'WH-MAIN', 'Main Warehouse', 3),
    (cid, 'department', 'DEPT-HR', 'Human Resources', 10),
    (cid, 'department', 'DEPT-FIN', 'Finance & Accounts', 11),
    (cid, 'department', 'DEPT-PROD', 'Production', 12),
    (cid, 'department', 'DEPT-IT', 'Information Technology', 13),
    (cid, 'department', 'DEPT-OPS', 'Operations', 14),
    (cid, 'division', 'DIV-SEC', 'Security Printing Division', 20),
    (cid, 'cost_center', 'CC-1000', 'Cost Center 1000 — Admin', 30),
    (cid, 'cost_center', 'CC-2000', 'Cost Center 2000 — Production', 31)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Link departments under branch
  UPDATE di_org_units d SET parent_id = (
    SELECT id FROM di_org_units WHERE company_id = cid AND code = 'BR-KLA' LIMIT 1
  )
  WHERE company_id = cid AND unit_type = 'department' AND parent_id IS NULL;

  UPDATE di_org_units d SET parent_id = (
    SELECT id FROM di_org_units WHERE company_id = cid AND code = 'HOPE-HQ' LIMIT 1
  )
  WHERE company_id = cid AND code IN ('BR-KLA','PLT-PRT','WH-MAIN','DIV-SEC') AND parent_id IS NULL;

  -- Sync rules
  INSERT INTO di_sync_rules (company_id, field_key, target_modules, description) VALUES
    (cid, 'department', ARRAY['identity','payroll','hopechat','service_desk','credentials'], 'Department change propagates manager chain & cost centre'),
    (cid, 'job_title', ARRAY['identity','payroll','credentials'], 'Title drives role suggestions and ID card'),
    (cid, 'manager', ARRAY['identity','hopechat','service_desk'], 'Reporting manager for approvals'),
    (cid, 'cost_center', ARRAY['payroll','finance'], 'Payroll and GL cost centre'),
    (cid, 'branch_name', ARRAY['identity','credentials','assets'], 'Branch for access & asset location'),
    (cid, 'company_email', ARRAY['identity','hopechat','service_desk'], 'Directory email'),
    (cid, 'status', ARRAY['identity','payroll','hopechat','service_desk','credentials','portal'], 'Lifecycle status suspend/activate'),
    (cid, 'clearance_level', ARRAY['identity','credentials','audit'], 'Security clearance matrix')
  ON CONFLICT (company_id, field_key) DO NOTHING;

  -- Clearance matrix (sample modules)
  INSERT INTO di_clearance_matrix (company_id, clearance_level, module_code, can_view, can_create, can_approve, can_admin)
  SELECT cid, cl.lvl::di_clearance_level, m.mod,
    true,
    cl.lvl IN ('supervisor','manager','finance','hr','executive','administrator','system_owner'),
    cl.lvl IN ('manager','finance','hr','executive','administrator','system_owner'),
    cl.lvl IN ('administrator','system_owner')
  FROM (VALUES
    ('visitor'),('employee'),('supervisor'),('manager'),
    ('finance'),('hr'),('executive'),('administrator'),('system_owner')
  ) AS cl(lvl)
  CROSS JOIN (VALUES
    ('identity'),('hr'),('payroll'),('finance'),('production'),
    ('inventory'),('hopechat'),('service_desk'),('audit')
  ) AS m(mod)
  ON CONFLICT (company_id, clearance_level, module_code) DO NOTHING;

  -- Restrict visitor
  UPDATE di_clearance_matrix SET can_view = false, can_create = false, can_approve = false, can_admin = false
  WHERE company_id = cid AND clearance_level = 'visitor' AND module_code NOT IN ('portal','hopechat');
  UPDATE di_clearance_matrix SET can_view = true WHERE company_id = cid AND clearance_level = 'visitor' AND module_code = 'portal';

  -- Finance cannot modify payroll salaries (view only on payroll for finance)
  UPDATE di_clearance_matrix SET can_create = false, can_approve = false, can_admin = false
  WHERE company_id = cid AND clearance_level = 'finance' AND module_code = 'payroll';

  -- ID card templates
  INSERT INTO di_id_card_templates (company_id, code, name, card_type, validity_months) VALUES
    (cid, 'CARD-STAFF', 'Staff ID Card', 'staff', 24),
    (cid, 'CARD-MGMT', 'Management ID Card', 'management', 24),
    (cid, 'CARD-CTR', 'Contractor ID Card', 'contractor', 12),
    (cid, 'CARD-VIS', 'Visitor Badge', 'visitor', 1),
    (cid, 'CARD-TMP', 'Temporary Staff Card', 'temporary', 6),
    (cid, 'CARD-INT', 'Intern ID Card', 'intern', 12),
    (cid, 'CARD-DRV', 'Driver ID Card', 'driver', 24)
  ON CONFLICT (company_id, code) DO NOTHING;

  -- Biometric devices
  INSERT INTO di_biometric_devices (company_id, device_code, name, vendor, location, modalities) VALUES
    (cid, 'BIO-GATE-01', 'Main Gate Fingerprint', 'zkteco', 'Main Entrance', ARRAY['fingerprint']),
    (cid, 'BIO-PLT-01', 'Plant Face Terminal', 'hikvision', 'Print Plant', ARRAY['face','fingerprint']),
    (cid, 'BIO-HQ-01', 'HQ Multi-Modal', 'suprema', 'HQ Lobby', ARRAY['fingerprint','face','palm'])
  ON CONFLICT (company_id, device_code) DO NOTHING;

  -- Approval routes
  INSERT INTO di_approval_routes (company_id, process_code, name, route_type, steps, escalation_hours) VALUES
    (cid, 'leave', 'Leave Approval', 'sequential',
     '[{"order":1,"role":"manager","can_delegate":true},{"order":2,"role":"hr","can_delegate":false}]'::jsonb, 48),
    (cid, 'expense', 'Expense Approval', 'sequential',
     '[{"order":1,"role":"manager","can_delegate":true},{"order":2,"role":"finance","can_delegate":false}]'::jsonb, 72),
    (cid, 'payroll', 'Payroll Change Approval', 'sequential',
     '[{"order":1,"role":"hr","can_delegate":false},{"order":2,"role":"finance","can_delegate":false},{"order":3,"role":"executive","can_delegate":false}]'::jsonb, 24),
    (cid, 'promotion', 'Promotion Approval', 'sequential',
     '[{"order":1,"role":"manager","can_delegate":false},{"order":2,"role":"hr","can_delegate":false},{"order":3,"role":"executive","can_delegate":false}]'::jsonb, 96),
    (cid, 'asset', 'Asset Request Approval', 'sequential',
     '[{"order":1,"role":"manager","can_delegate":true},{"order":2,"role":"admin","can_delegate":false}]'::jsonb, 48),
    (cid, 'transfer', 'Transfer Approval', 'parallel',
     '[{"order":1,"role":"manager","can_delegate":false},{"order":1,"role":"hr","can_delegate":false}]'::jsonb, 72)
  ON CONFLICT (company_id, process_code) DO NOTHING;

  -- Sample AI insights
  INSERT INTO di_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations)
  SELECT cid, v.t, v.title, v.summary, v.sev, v.score, v.rec::jsonb
  FROM (VALUES
    ('turnover_risk', 'Elevated turnover risk in Production',
     'Absenteeism and overtime patterns suggest 3 operators may leave within 90 days.',
     'warning', 72.5,
     '["Schedule retention interviews","Review shift fairness","Offer skills upgrade"]'),
    ('staffing_forecast', 'Q3 print plant staffing forecast',
     'Based on order pipeline, add 2 temporary operators before peak season.',
     'info', 81.0,
     '["Open intern requisition","Enable contractor template","Cross-train packing team"]'),
    ('overtime_abuse', 'Overtime anomaly — Warehouse',
     'Two employees exceed 40% OT vs department average for 3 consecutive weeks.',
     'critical', 88.0,
     '["Audit timesheets","Review shift roster","Manager coaching"]'),
    ('training_gap', 'Safety induction gaps',
     '12 active staff lack current OSH induction certificate.',
     'warning', 65.0,
     '["Schedule OSH batch training","Block high-risk zones until complete"]')
  ) AS v(t, title, summary, sev, score, rec)
  WHERE NOT EXISTS (SELECT 1 FROM di_ai_insights WHERE company_id = cid LIMIT 1);

  -- Backfill lifecycle + profile fields from employees where linked
  UPDATE uw_persons p SET
    employee_number = coalesce(p.employee_number, e.employee_number),
    nssf_number = coalesce(p.nssf_number, e.nssf_number),
    tin_number = coalesce(p.tin_number, e.tin_number),
    gender = coalesce(p.gender, e.gender),
    date_of_birth = coalesce(p.date_of_birth, e.date_of_birth),
    nationality = coalesce(p.nationality, e.nationality),
    marital_status = coalesce(p.marital_status, e.marital_status),
    company_email = coalesce(p.company_email, e.email, p.primary_email),
    personal_email = coalesce(p.personal_email, e.email),
    grade = coalesce(p.grade, e.grade),
    employment_type = coalesce(p.employment_type, e.employment_type::text),
    employment_status = coalesce(p.employment_status, e.status::text),
    hire_date = coalesce(p.hire_date, e.hire_date),
    confirmation_date = coalesce(p.confirmation_date, e.confirmation_date),
    position_title = coalesce(p.position_title, e.job_title, p.job_title),
    lifecycle_stage = CASE
      WHEN e.status::text = 'terminated' THEN 'archived'::di_lifecycle_stage
      WHEN e.status::text IN ('on_leave', 'leave') THEN 'leave'::di_lifecycle_stage
      WHEN e.confirmation_date IS NOT NULL THEN 'active'::di_lifecycle_stage
      WHEN e.hire_date IS NOT NULL AND e.hire_date > CURRENT_DATE - INTERVAL '90 days' THEN 'probation'::di_lifecycle_stage
      ELSE coalesce(p.lifecycle_stage, 'active'::di_lifecycle_stage)
    END,
    qr_identity_token = coalesce(p.qr_identity_token, 'QR-' || p.upid)
  FROM employees e
  WHERE p.employee_id = e.id AND p.company_id = cid;

  UPDATE uw_persons SET lifecycle_stage = 'active'
  WHERE company_id = cid AND lifecycle_stage IS NULL AND status = 'active';

END $$;
