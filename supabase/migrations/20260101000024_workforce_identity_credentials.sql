-- Hope Design Group Ltd — Workforce Identity & Credential Management Platform
-- Digital identity · smart badges · access control · card design · print · biometrics (status)

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Workforce Identity', 'wid.view', 'workforce_id', 'View credentials, cards, and access'),
  ('Manage Workforce Identity', 'wid.manage', 'workforce_id', 'Create and manage identities and cards'),
  ('Design ID Cards', 'wid.design', 'workforce_id', 'Card design studio and templates'),
  ('Print ID Cards', 'wid.print', 'workforce_id', 'Card print queue and printers'),
  ('Manage Access Control', 'wid.access', 'workforce_id', 'Zones, profiles, and access assignment'),
  ('Security Identity Ops', 'wid.security', 'workforce_id', 'Lost/stolen, suspend, security centre'),
  ('Verify Workforce Identity', 'wid.verify', 'workforce_id', 'Scan and verify employee credentials'),
  ('Biometrics Enrollment', 'wid.biometrics', 'workforce_id', 'Biometric enrollment status (no raw templates)')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

-- Grant to super_administrator and operations-style roles if present
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.slug LIKE 'wid.%'
  AND r.slug IN (
    'super_administrator', 'managing_director', 'operations_manager',
    'warehouse_manager', 'production_manager', 'auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- ID NUMBER ENGINE
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_id_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  prefix VARCHAR(30) NOT NULL DEFAULT 'HDG',
  category_code VARCHAR(30) NOT NULL DEFAULT 'EMP', -- EMP | PROD | SEC | VIS | CTR
  include_year BOOLEAN DEFAULT true,
  include_location BOOLEAN DEFAULT false,
  location_code VARCHAR(20),
  pad_length INTEGER DEFAULT 6,
  next_value BIGINT DEFAULT 1,
  check_digit BOOLEAN DEFAULT false,
  separator VARCHAR(5) DEFAULT '-',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sequence_code)
);

-- ============================================================
-- BRAND / COMPANY CARD STYLING
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_card_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  company_display_name VARCHAR(255),
  logo_url TEXT,
  primary_color VARCHAR(20) DEFAULT '#0f766e',
  secondary_color VARCHAR(20) DEFAULT '#0f172a',
  accent_color VARCHAR(20) DEFAULT '#f59e0b',
  text_color VARCHAR(20) DEFAULT '#0f172a',
  background_color VARCHAR(20) DEFAULT '#ffffff',
  font_family VARCHAR(100) DEFAULT 'system-ui',
  watermark_text VARCHAR(100),
  signature_name VARCHAR(150),
  signature_title VARCHAR(150),
  footer_text TEXT,
  branch_name VARCHAR(150),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, brand_code)
);

-- ============================================================
-- CARD TEMPLATES (design studio)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES wid_card_brands(id) ON DELETE SET NULL,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'employee',
  -- executive | factory | security | visitor | contractor | intern | custom
  card_format VARCHAR(30) DEFAULT 'CR80', -- CR80 | CR79 | custom
  orientation VARCHAR(20) DEFAULT 'landscape', -- landscape | portrait
  width_mm DECIMAL(8,2) DEFAULT 85.60,
  height_mm DECIMAL(8,2) DEFAULT 53.98,
  sides INTEGER DEFAULT 2,
  -- canvas: { front: Element[], back: Element[] }
  design_json JSONB NOT NULL DEFAULT '{"front":[],"back":[]}'::jsonb,
  security_features JSONB DEFAULT '[]'::jsonb,
  default_access_profile_code VARCHAR(50),
  language VARCHAR(10) DEFAULT 'en',
  version INTEGER DEFAULT 1,
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  cloned_from UUID REFERENCES wid_card_templates(id),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

CREATE TABLE IF NOT EXISTS wid_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES wid_card_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  design_json JSONB NOT NULL,
  change_note TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- ============================================================
-- MULTI-IDENTITY (person may have several)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  identity_number VARCHAR(80) NOT NULL,
  identity_type VARCHAR(40) NOT NULL DEFAULT 'employee',
  -- employee | permanent | temporary | intern | contractor | consultant | volunteer
  -- factory_operator | machine_operator | technician | security_officer | driver | warehouse_operator
  -- digital | visitor
  operational_role VARCHAR(80),
  full_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  photo_url TEXT,
  department VARCHAR(100),
  division VARCHAR(100),
  branch_name VARCHAR(100),
  job_title VARCHAR(150),
  grade VARCHAR(50),
  employment_type VARCHAR(50),
  manager_name VARCHAR(150),
  location_name VARCHAR(150),
  blood_group VARCHAR(10),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(50),
  hire_date DATE,
  expiry_date DATE,
  -- digital accounts
  username VARCHAR(100),
  erp_account VARCHAR(100),
  vpn_account VARCHAR(100),
  api_identity VARCHAR(100),
  -- status lifecycle
  status VARCHAR(30) DEFAULT 'created',
  -- created | pending_hr | verified | active | suspended | expired | terminated | archived
  security_clearance VARCHAR(50) DEFAULT 'standard',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, identity_number)
);

CREATE INDEX IF NOT EXISTS idx_wid_identities_employee ON wid_identities(employee_id);
CREATE INDEX IF NOT EXISTS idx_wid_identities_status ON wid_identities(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wid_identities_type ON wid_identities(company_id, identity_type);

-- ============================================================
-- PHYSICAL / DIGITAL CREDENTIALS (ID CARDS)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES wid_identities(id) ON DELETE CASCADE,
  template_id UUID REFERENCES wid_card_templates(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES wid_card_brands(id) ON DELETE SET NULL,
  credential_number VARCHAR(80) NOT NULL,
  card_serial VARCHAR(80),
  credential_type VARCHAR(40) DEFAULT 'pvc',
  -- pvc | rfid | nfc | smart_card | mobile | visitor
  status VARCHAR(30) DEFAULT 'created',
  -- created | pending_approval | approved | printing | printed | issued | active
  -- suspended | lost | stolen | damaged | expired | returned | destroyed | archived
  issue_date DATE,
  activation_date TIMESTAMPTZ,
  expiry_date DATE,
  printed_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  destroyed_at TIMESTAMPTZ,
  -- security tokens
  qr_token VARCHAR(500),
  qr_public_id VARCHAR(100),
  barcode_value VARCHAR(100),
  rfid_uid VARCHAR(100),
  nfc_uid VARCHAR(100),
  security_seal VARCHAR(100),
  hologram_zone BOOLEAN DEFAULT true,
  anti_copy_nonce VARCHAR(64),
  -- rendered snapshot of fields at issue time
  snapshot_json JSONB DEFAULT '{}'::jsonb,
  design_override_json JSONB,
  access_profile_code VARCHAR(50),
  print_count INTEGER DEFAULT 0,
  replacement_of UUID REFERENCES wid_credentials(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  issued_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, credential_number)
);

CREATE INDEX IF NOT EXISTS idx_wid_credentials_identity ON wid_credentials(identity_id);
CREATE INDEX IF NOT EXISTS idx_wid_credentials_status ON wid_credentials(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wid_credentials_qr ON wid_credentials(qr_public_id);
CREATE INDEX IF NOT EXISTS idx_wid_credentials_rfid ON wid_credentials(rfid_uid) WHERE rfid_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wid_credentials_expiry ON wid_credentials(company_id, expiry_date) WHERE deleted_at IS NULL;

-- ============================================================
-- ACCESS ZONES & PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_access_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  zone_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  zone_level INTEGER DEFAULT 1,
  building VARCHAR(100),
  floor_label VARCHAR(50),
  is_restricted BOOLEAN DEFAULT false,
  requires_escort BOOLEAN DEFAULT false,
  color VARCHAR(20) DEFAULT '#0f766e',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, zone_code)
);

CREATE TABLE IF NOT EXISTS wid_access_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  -- zone_codes granted
  zone_codes TEXT[] DEFAULT '{}',
  -- time rules
  time_start VARCHAR(5) DEFAULT '00:00',
  time_end VARCHAR(5) DEFAULT '23:59',
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],
  -- auto-provision rules
  auto_departments TEXT[] DEFAULT '{}',
  auto_roles TEXT[] DEFAULT '{}',
  auto_identity_types TEXT[] DEFAULT '{}',
  erp_permissions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, profile_code)
);

CREATE TABLE IF NOT EXISTS wid_access_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES wid_identities(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES wid_credentials(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES wid_access_profiles(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES wid_access_zones(id) ON DELETE SET NULL,
  grant_type VARCHAR(30) DEFAULT 'profile', -- profile | zone | temporary
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'active', -- active | suspended | expired | revoked
  reason TEXT,
  assigned_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wid_access_assign_identity ON wid_access_assignments(identity_id);
CREATE INDEX IF NOT EXISTS idx_wid_access_assign_status ON wid_access_assignments(company_id, status);

CREATE TABLE IF NOT EXISTS wid_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES wid_identities(id) ON DELETE SET NULL,
  credential_id UUID REFERENCES wid_credentials(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES wid_access_zones(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL DEFAULT 'access_attempt',
  -- access_granted | access_denied | door_open | turnstile | parking | attendance
  result VARCHAR(20) DEFAULT 'granted', -- granted | denied | error
  reader_id VARCHAR(100),
  reader_name VARCHAR(150),
  direction VARCHAR(20), -- in | out
  reason TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_wid_access_events_time ON wid_access_events(company_id, occurred_at DESC);

-- ============================================================
-- BIOMETRICS (enrollment status only — no raw biometric templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_biometric_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES wid_identities(id) ON DELETE CASCADE,
  modality VARCHAR(40) NOT NULL,
  -- fingerprint | face | iris | palm
  device_name VARCHAR(150),
  device_id VARCHAR(100),
  enrollment_status VARCHAR(30) DEFAULT 'pending',
  -- pending | enrolled | failed | expired | revoked
  template_ref VARCHAR(100), -- external system reference only
  enrolled_at TIMESTAMPTZ,
  enrolled_by UUID REFERENCES user_profiles(id),
  last_verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wid_bio_identity ON wid_biometric_enrollments(identity_id);

-- ============================================================
-- CARD INVENTORY (blank stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_card_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(80) NOT NULL,
  card_type VARCHAR(40) DEFAULT 'pvc_blank',
  -- pvc_blank | rfid_blank | nfc_blank | smart_blank | ribbon | laminate
  supplier_name VARCHAR(150),
  purchase_date DATE,
  quantity_received INTEGER DEFAULT 0,
  quantity_available INTEGER DEFAULT 0,
  quantity_used INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  unit_cost DECIMAL(14,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  location_name VARCHAR(150),
  serial_from VARCHAR(80),
  serial_to VARCHAR(80),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'available',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

-- ============================================================
-- PRINT QUEUE & HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES wid_credentials(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  printer_name VARCHAR(150),
  printer_model VARCHAR(100),
  -- zebra | evolis | fargo | hid | magicard | standard | browser
  printer_brand VARCHAR(50) DEFAULT 'browser',
  priority INTEGER DEFAULT 5,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | approved | queued | printing | completed | failed | cancelled | retrying
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  requested_by UUID REFERENCES user_profiles(id),
  sides VARCHAR(20) DEFAULT 'both', -- front | back | both
  copies INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

CREATE INDEX IF NOT EXISTS idx_wid_print_status ON wid_print_jobs(company_id, status);

CREATE TABLE IF NOT EXISTS wid_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  print_job_id UUID REFERENCES wid_print_jobs(id) ON DELETE SET NULL,
  credential_id UUID REFERENCES wid_credentials(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  message TEXT,
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOST / STOLEN / INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_card_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES wid_credentials(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES wid_identities(id) ON DELETE SET NULL,
  incident_number VARCHAR(50) NOT NULL,
  incident_type VARCHAR(30) NOT NULL,
  -- lost | stolen | damaged | found | misuse
  description TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  reported_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'reported',
  -- reported | manager_review | security_review | card_disabled | replacement_issued | closed
  manager_approved_by UUID REFERENCES user_profiles(id),
  manager_approved_at TIMESTAMPTZ,
  security_reviewed_by UUID REFERENCES user_profiles(id),
  security_reviewed_at TIMESTAMPTZ,
  replacement_credential_id UUID REFERENCES wid_credentials(id),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, incident_number)
);

-- ============================================================
-- VERIFICATION LOGS (QR / scan)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES wid_credentials(id) ON DELETE SET NULL,
  identity_id UUID REFERENCES wid_identities(id) ON DELETE SET NULL,
  qr_public_id VARCHAR(100),
  result VARCHAR(30) NOT NULL,
  -- valid | expired | suspended | revoked | not_found | invalid_token | suspicious
  scanner_context VARCHAR(100),
  location_name VARCHAR(150),
  ip_address VARCHAR(50),
  user_agent TEXT,
  scanned_by UUID REFERENCES user_profiles(id),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wid_verify_time ON wid_verification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wid_verify_result ON wid_verification_logs(company_id, result);

-- ============================================================
-- MOBILE DIGITAL BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_mobile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES wid_identities(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES wid_credentials(id) ON DELETE SET NULL,
  badge_token VARCHAR(200) NOT NULL,
  device_label VARCHAR(150),
  wallet_type VARCHAR(40), -- apple_wallet | google_wallet | in_app
  status VARCHAR(30) DEFAULT 'active',
  offline_until TIMESTAMPTZ,
  share_enabled BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, badge_token)
);

-- ============================================================
-- WORKFLOW DEFINITIONS (onboarding → print → activate)
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(80) NOT NULL,
  -- employee.created | identity.verified | card.approved | incident.lost | expiry.approaching
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, workflow_code)
);

CREATE TABLE IF NOT EXISTS wid_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES wid_workflows(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  status VARCHAR(30) DEFAULT 'running',
  current_step INTEGER DEFAULT 0,
  step_log JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- AI DESIGN SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS wid_ai_design_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  result_summary TEXT,
  design_json JSONB,
  template_id UUID REFERENCES wid_card_templates(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (company-scoped via helpers used across Hope SecureTrack)
-- ============================================================
ALTER TABLE wid_id_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_card_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_access_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_biometric_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_card_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_print_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_card_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_mobile_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wid_ai_design_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wid_id_sequences','wid_card_brands','wid_card_templates','wid_template_versions',
    'wid_identities','wid_credentials','wid_access_zones','wid_access_profiles',
    'wid_access_assignments','wid_access_events','wid_biometric_enrollments',
    'wid_card_inventory','wid_print_jobs','wid_print_history','wid_card_incidents',
    'wid_verification_logs','wid_mobile_badges','wid_workflows','wid_workflow_runs',
    'wid_ai_design_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
         company_id = public.user_company_id() OR public.is_super_admin()
       ) WITH CHECK (
         company_id = public.user_company_id() OR public.is_super_admin()
       )',
      t || '_all', t
    );
  END LOOP;
END $$;

-- ============================================================
-- SEED: sequences, brands, zones, profiles, templates, workflows
-- ============================================================
DO $$
DECLARE
  cid UUID;
  brand_id UUID;
  tpl_exec UUID;
  tpl_fact UUID;
  tpl_sec UUID;
  tpl_vis UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO wid_id_sequences (company_id, sequence_code, name, prefix, category_code, pad_length)
  VALUES
    (cid, 'EMP', 'Employee IDs', 'HDG', 'EMP', 6),
    (cid, 'PROD', 'Production / Factory', 'HDG', 'PROD', 6),
    (cid, 'SEC', 'Security Officers', 'HDG', 'SEC', 6),
    (cid, 'VIS', 'Visitors', 'HDG', 'VIS', 6),
    (cid, 'CTR', 'Contractors', 'HDG', 'CTR', 6)
  ON CONFLICT (company_id, sequence_code) DO NOTHING;

  INSERT INTO wid_card_brands (
    company_id, brand_code, name, company_display_name,
    primary_color, secondary_color, accent_color, is_default, watermark_text,
    signature_name, signature_title, footer_text, branch_name
  )
  VALUES (
    cid, 'HDG-MAIN', 'Hope Design Group Main', 'Hope Design Group Ltd',
    '#0f766e', '#0f172a', '#f59e0b', true, 'HOPE DESIGN',
    'Managing Director', 'Authorised Signatory',
    'Security Printing · Paper Manufacturing · Engineering · Kampala, Uganda',
    'Head Office'
  )
  ON CONFLICT (company_id, brand_code) DO NOTHING
  RETURNING id INTO brand_id;

  IF brand_id IS NULL THEN
    SELECT id INTO brand_id FROM wid_card_brands WHERE company_id = cid AND brand_code = 'HDG-MAIN';
  END IF;

  INSERT INTO wid_access_zones (company_id, zone_code, name, zone_level, is_restricted, color)
  VALUES
    (cid, 'Z1-ADMIN', 'Administration', 1, false, '#3b82f6'),
    (cid, 'Z2-PROD', 'Production Floor', 2, false, '#0f766e'),
    (cid, 'Z3-WH', 'Warehouse', 2, false, '#8b5cf6'),
    (cid, 'Z4-FIN', 'Finance', 3, true, '#f59e0b'),
    (cid, 'Z5-SRV', 'Server Room', 4, true, '#ef4444'),
    (cid, 'Z6-REST', 'Restricted Area', 5, true, '#dc2626')
  ON CONFLICT (company_id, zone_code) DO NOTHING;

  INSERT INTO wid_access_profiles (
    company_id, profile_code, name, description, zone_codes,
    auto_departments, auto_identity_types, time_start, time_end
  )
  VALUES
    (cid, 'PROD-STD', 'Production Standard', 'Factory floor + attendance',
     ARRAY['Z2-PROD','Z3-WH'], ARRAY['Production','Manufacturing'],
     ARRAY['employee','factory_operator','machine_operator'], '06:00', '20:00'),
    (cid, 'FIN-STD', 'Finance Access', 'Admin + Finance offices',
     ARRAY['Z1-ADMIN','Z4-FIN'], ARRAY['Finance','Accounts'],
     ARRAY['employee'], '08:00', '18:00'),
    (cid, 'SEC-ALL', 'Security Patrol', 'All zones (escorted restricted)',
     ARRAY['Z1-ADMIN','Z2-PROD','Z3-WH','Z4-FIN','Z5-SRV','Z6-REST'],
     ARRAY['Security'], ARRAY['security_officer'], '00:00', '23:59'),
    (cid, 'EXEC', 'Executive Access', 'Admin + Finance + Production overview',
     ARRAY['Z1-ADMIN','Z2-PROD','Z3-WH','Z4-FIN'], ARRAY['Executive','Management'],
     ARRAY['employee'], '00:00', '23:59'),
    (cid, 'VISITOR', 'Visitor Temporary', 'Admin only with host',
     ARRAY['Z1-ADMIN'], ARRAY[]::TEXT[], ARRAY['visitor'], '08:00', '17:00')
  ON CONFLICT (company_id, profile_code) DO NOTHING;

  -- Executive template
  INSERT INTO wid_card_templates (
    company_id, brand_id, template_code, name, description, category,
    design_json, security_features, default_access_profile_code, is_system
  )
  VALUES (
    cid, brand_id, 'TPL-EXEC', 'Executive Card', 'Premium design for leadership',
    'executive',
    '{
      "front": [
        {"id":"bg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#0f172a","z":0},
        {"id":"accent","type":"rect","x":0,"y":0,"w":100,"h":18,"fill":"#0f766e","z":1},
        {"id":"logo","type":"text","x":4,"y":4,"w":50,"h":10,"text":"HOPE DESIGN GROUP","fontSize":9,"color":"#fff","bold":true,"z":2},
        {"id":"photo","type":"photo","x":4,"y":24,"w":28,"h":48,"label":"Photo","z":3},
        {"id":"name","type":"field","x":36,"y":26,"w":60,"h":12,"field":"full_name","fontSize":14,"color":"#fff","bold":true,"z":4},
        {"id":"title","type":"field","x":36,"y":40,"w":60,"h":8,"field":"job_title","fontSize":10,"color":"#94a3b8","z":5},
        {"id":"dept","type":"field","x":36,"y":50,"w":60,"h":8,"field":"department","fontSize":9,"color":"#5eead4","z":6},
        {"id":"idnum","type":"field","x":36,"y":62,"w":60,"h":8,"field":"identity_number","fontSize":10,"color":"#fbbf24","fontFamily":"monospace","z":7},
        {"id":"qr","type":"qr","x":72,"y":70,"w":22,"h":22,"z":8},
        {"id":"sec","type":"text","x":4,"y":90,"w":60,"h":6,"text":"EXECUTIVE ACCESS","fontSize":8,"color":"#f59e0b","bold":true,"z":9}
      ],
      "back": [
        {"id":"bbg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#f8fafc","z":0},
        {"id":"bh","type":"text","x":4,"y":6,"w":90,"h":8,"text":"Hope Design Group Ltd — Official ID","fontSize":9,"color":"#0f172a","bold":true,"z":1},
        {"id":"b1","type":"field","x":4,"y":20,"w":90,"h":8,"field":"emergency_contact","label":"Emergency","fontSize":9,"z":2},
        {"id":"b2","type":"field","x":4,"y":32,"w":45,"h":8,"field":"blood_group","label":"Blood","fontSize":9,"z":3},
        {"id":"b3","type":"field","x":50,"y":32,"w":45,"h":8,"field":"expiry_date","label":"Expires","fontSize":9,"z":4},
        {"id":"b4","type":"text","x":4,"y":50,"w":90,"h":20,"text":"If found return to Hope Design Group, Kampala. Unauthorized use is prohibited.","fontSize":8,"color":"#64748b","z":5},
        {"id":"seal","type":"text","x":4,"y":85,"w":90,"h":8,"text":"SECURITY SEAL · HOLOGRAM ZONE","fontSize":8,"color":"#0f766e","bold":true,"z":6}
      ]
    }'::jsonb,
    '["qr","hologram","watermark","security_seal"]'::jsonb,
    'EXEC', true
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO wid_card_templates (
    company_id, brand_id, template_code, name, description, category,
    design_json, security_features, default_access_profile_code, is_system
  )
  VALUES (
    cid, brand_id, 'TPL-FACT', 'Factory Worker Card', 'Production floor credentials',
    'factory',
    '{
      "front": [
        {"id":"bg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#ffffff","z":0},
        {"id":"bar","type":"rect","x":0,"y":0,"w":100,"h":22,"fill":"#0f766e","z":1},
        {"id":"logo","type":"text","x":3,"y":5,"w":55,"h":12,"text":"HOPE DESIGN · PRODUCTION","fontSize":9,"color":"#fff","bold":true,"z":2},
        {"id":"photo","type":"photo","x":4,"y":28,"w":26,"h":42,"z":3},
        {"id":"name","type":"field","x":34,"y":28,"w":42,"h":10,"field":"full_name","fontSize":12,"bold":true,"z":4},
        {"id":"title","type":"field","x":34,"y":40,"w":42,"h":8,"field":"job_title","fontSize":9,"color":"#475569","z":5},
        {"id":"dept","type":"field","x":34,"y":50,"w":42,"h":8,"field":"department","fontSize":9,"z":6},
        {"id":"idnum","type":"field","x":34,"y":60,"w":42,"h":8,"field":"identity_number","fontSize":9,"fontFamily":"monospace","color":"#0f766e","z":7},
        {"id":"qr","type":"qr","x":76,"y":28,"w":20,"h":20,"z":8},
        {"id":"zone","type":"text","x":4,"y":78,"w":92,"h":8,"text":"ACCESS: Factory Zone A · Warehouse","fontSize":8,"color":"#0f766e","z":9},
        {"id":"shift","type":"field","x":4,"y":88,"w":50,"h":8,"field":"operational_role","label":"Role","fontSize":8,"z":10}
      ],
      "back": [
        {"id":"bbg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#f1f5f9","z":0},
        {"id":"rules","type":"text","x":4,"y":10,"w":92,"h":40,"text":"Wear badge visibly at all times. Report loss immediately to Security. PPE required on production floor.","fontSize":9,"color":"#334155","z":1},
        {"id":"barcode","type":"barcode","x":10,"y":60,"w":80,"h":20,"field":"credential_number","z":2},
        {"id":"exp","type":"field","x":4,"y":88,"w":90,"h":8,"field":"expiry_date","label":"Valid until","fontSize":9,"z":3}
      ]
    }'::jsonb,
    '["qr","barcode","microtext"]'::jsonb,
    'PROD-STD', true
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO wid_card_templates (
    company_id, brand_id, template_code, name, description, category,
    design_json, security_features, default_access_profile_code, is_system
  )
  VALUES (
    cid, brand_id, 'TPL-SEC', 'Security Badge', 'Security officers & patrol',
    'security',
    '{
      "front": [
        {"id":"bg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#111827","z":0},
        {"id":"stripe","type":"rect","x":0,"y":0,"w":8,"h":100,"fill":"#dc2626","z":1},
        {"id":"title","type":"text","x":12,"y":6,"w":80,"h":10,"text":"SECURITY","fontSize":14,"color":"#fef2f2","bold":true,"z":2},
        {"id":"photo","type":"photo","x":12,"y":22,"w":28,"h":45,"z":3},
        {"id":"name","type":"field","x":44,"y":24,"w":52,"h":12,"field":"full_name","fontSize":13,"color":"#fff","bold":true,"z":4},
        {"id":"idnum","type":"field","x":44,"y":40,"w":52,"h":8,"field":"identity_number","fontSize":10,"color":"#fca5a5","fontFamily":"monospace","z":5},
        {"id":"clear","type":"field","x":44,"y":52,"w":52,"h":8,"field":"security_clearance","label":"Clearance","fontSize":9,"color":"#fbbf24","z":6},
        {"id":"qr","type":"qr","x":70,"y":68,"w":22,"h":22,"z":7},
        {"id":"auth","type":"text","x":12,"y":88,"w":55,"h":8,"text":"AUTHORIZED PERSONNEL","fontSize":8,"color":"#ef4444","bold":true,"z":8}
      ],
      "back": [
        {"id":"bbg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#1f2937","z":0},
        {"id":"bt","type":"text","x":4,"y":10,"w":92,"h":12,"text":"Patrol & Access Authorization","fontSize":11,"color":"#fff","bold":true,"z":1},
        {"id":"zones","type":"text","x":4,"y":30,"w":92,"h":30,"text":"Zones: Admin · Production · Warehouse · Finance · Server · Restricted (escort)","fontSize":9,"color":"#d1d5db","z":2},
        {"id":"hotline","type":"text","x":4,"y":70,"w":92,"h":10,"text":"Security Control: report incidents immediately","fontSize":9,"color":"#fca5a5","z":3}
      ]
    }'::jsonb,
    '["qr","hologram","security_seal","uv_pattern"]'::jsonb,
    'SEC-ALL', true
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO wid_card_templates (
    company_id, brand_id, template_code, name, description, category,
    design_json, security_features, default_access_profile_code, is_system
  )
  VALUES (
    cid, brand_id, 'TPL-VIS', 'Visitor Badge', 'Temporary visitor credentials',
    'visitor',
    '{
      "front": [
        {"id":"bg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#fff7ed","z":0},
        {"id":"hdr","type":"rect","x":0,"y":0,"w":100,"h":28,"fill":"#ea580c","z":1},
        {"id":"vt","type":"text","x":4,"y":8,"w":90,"h":12,"text":"VISITOR","fontSize":16,"color":"#fff","bold":true,"z":2},
        {"id":"name","type":"field","x":4,"y":36,"w":70,"h":12,"field":"full_name","fontSize":14,"bold":true,"z":3},
        {"id":"host","type":"field","x":4,"y":52,"w":70,"h":8,"field":"manager_name","label":"Host","fontSize":10,"z":4},
        {"id":"purp","type":"field","x":4,"y":64,"w":70,"h":8,"field":"notes","label":"Purpose","fontSize":9,"z":5},
        {"id":"qr","type":"qr","x":76,"y":36,"w":20,"h":20,"z":6},
        {"id":"exp","type":"field","x":4,"y":84,"w":90,"h":10,"field":"expiry_date","label":"Valid until","fontSize":10,"color":"#c2410c","bold":true,"z":7}
      ],
      "back": [
        {"id":"bbg","type":"rect","x":0,"y":0,"w":100,"h":100,"fill":"#ffedd5","z":0},
        {"id":"rules","type":"text","x":4,"y":15,"w":92,"h":50,"text":"Escort required outside Admin. Badge must be returned at exit. Photography restricted.","fontSize":10,"color":"#7c2d12","z":1}
      ]
    }'::jsonb,
    '["qr","expiry"]'::jsonb,
    'VISITOR', true
  )
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO wid_workflows (company_id, workflow_code, name, description, trigger_event, steps)
  VALUES
    (cid, 'ONBOARD-CARD', 'New Employee Card Issuance',
     'HR verify → generate ID → manager approve → print → activate',
     'employee.created',
     '[
       {"step":1,"name":"HR Verification","action":"hr_verify"},
       {"step":2,"name":"Generate Identity Number","action":"generate_id"},
       {"step":3,"name":"Create Credential","action":"create_credential"},
       {"step":4,"name":"Manager Approval","action":"manager_approve"},
       {"step":5,"name":"Queue Print","action":"queue_print"},
       {"step":6,"name":"Activate & Provision Access","action":"activate_access"}
     ]'::jsonb),
    (cid, 'LOST-REPLACE', 'Lost/Stolen Replacement',
     'Report → approve → disable old → print new',
     'incident.lost',
     '[
       {"step":1,"name":"Report Loss","action":"report"},
       {"step":2,"name":"Manager Approval","action":"manager_approve"},
       {"step":3,"name":"Security Review","action":"security_review"},
       {"step":4,"name":"Disable Old Card","action":"disable_card"},
       {"step":5,"name":"Generate Replacement","action":"replace"},
       {"step":6,"name":"Print & Issue","action":"print_issue"}
     ]'::jsonb),
    (cid, 'TERMINATE', 'Termination Offboarding',
     'Suspend credentials and revoke access',
     'employee.terminated',
     '[
       {"step":1,"name":"Suspend Identity","action":"suspend_identity"},
       {"step":2,"name":"Disable Credentials","action":"disable_cards"},
       {"step":3,"name":"Revoke Access","action":"revoke_access"},
       {"step":4,"name":"Revoke Mobile Badge","action":"revoke_mobile"},
       {"step":5,"name":"Archive","action":"archive"}
     ]'::jsonb)
  ON CONFLICT (company_id, workflow_code) DO NOTHING;

  INSERT INTO wid_card_inventory (
    company_id, batch_number, card_type, supplier_name, purchase_date,
    quantity_received, quantity_available, unit_cost, location_name, status
  )
  VALUES
    (cid, 'PVC-2026-001', 'pvc_blank', 'SecureCard Supplies UG', CURRENT_DATE - 30,
     500, 480, 3500, 'Security Office', 'available'),
    (cid, 'RFID-2026-001', 'rfid_blank', 'HID Global Partner', CURRENT_DATE - 14,
     200, 195, 12000, 'Security Office', 'available')
  ON CONFLICT (company_id, batch_number) DO NOTHING;

END $$;
