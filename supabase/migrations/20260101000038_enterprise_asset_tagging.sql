-- Hope Design Group — Enterprise Asset Tagging & Digital Identification
-- Register · tags · QR/RFID/NFC · assignments · audits · maintenance · AI

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Assets', 'ast.view', 'assets', 'View asset register and tags'),
  ('Manage Assets', 'ast.manage', 'assets', 'Create and edit assets and tags'),
  ('Assign Assets', 'ast.assign', 'assets', 'Assign assets to custodians'),
  ('Audit Assets', 'ast.audit', 'assets', 'Run inventory audits'),
  ('Print Asset Tags', 'ast.print', 'assets', 'Generate and print tags'),
  ('Asset AI', 'ast.ai', 'assets', 'AI asset assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'ast.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'warehouse_manager','auditor','finance_manager','hr_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND fixed_assets
-- ============================================================
ALTER TABLE fixed_assets
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150),
  ADD COLUMN IF NOT EXISTS model VARCHAR(150),
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(150),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS condition VARCHAR(40) DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS asset_domain VARCHAR(40) DEFAULT 'it',
  -- it | mfg | office | fleet | digital | other
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- CATEGORIES · NUMBERING · REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS ast_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  domain VARCHAR(40) DEFAULT 'it',
  type_code VARCHAR(40) NOT NULL DEFAULT 'GEN',
  -- LAP | PRN | MCH | RCK | VEH | SW | ...
  prefix_template VARCHAR(80) DEFAULT 'HDG-{DOM}-{TYPE}',
  icon VARCHAR(40),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, category_code)
);

CREATE TABLE IF NOT EXISTS ast_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sequence_key VARCHAR(80) NOT NULL,
  last_number INTEGER DEFAULT 0,
  pad_width INTEGER DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sequence_key)
);

CREATE TABLE IF NOT EXISTS ast_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_tag VARCHAR(80) NOT NULL,
  -- HDG-IT-LAP-000001
  name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES ast_categories(id) ON DELETE SET NULL,
  category_code VARCHAR(40),
  domain VARCHAR(40) DEFAULT 'it',
  type_code VARCHAR(40),
  status VARCHAR(30) DEFAULT 'active',
  -- draft | active | assigned | maintenance | missing | retired | disposed
  condition VARCHAR(40) DEFAULT 'good',
  -- new | good | fair | poor | damaged
  manufacturer VARCHAR(150),
  model VARCHAR(150),
  serial_number VARCHAR(150),
  photo_url TEXT,
  department VARCHAR(100),
  branch_name VARCHAR(150),
  warehouse_location VARCHAR(150),
  purchase_date DATE,
  purchase_cost DECIMAL(18,2) DEFAULT 0,
  current_value DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(5) DEFAULT 'UGX',
  supplier_name VARCHAR(150),
  po_number VARCHAR(80),
  warranty_start DATE,
  warranty_end DATE,
  amc_contract VARCHAR(100),
  insurance_policy VARCHAR(100),
  insurance_expiry DATE,
  calibration_due DATE,
  next_maintenance_date DATE,
  end_of_life_date DATE,
  fixed_asset_id UUID REFERENCES fixed_assets(id) ON DELETE SET NULL,
  employee_asset_id UUID,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, asset_tag)
);

CREATE INDEX IF NOT EXISTS idx_ast_assets_status ON ast_assets(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ast_assets_domain ON ast_assets(company_id, domain) WHERE deleted_at IS NULL;

-- ============================================================
-- IDENTIFIERS (QR, BARCODE, RFID, NFC, GPS, BLE)
-- ============================================================
CREATE TABLE IF NOT EXISTS ast_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES ast_assets(id) ON DELETE CASCADE,
  id_type VARCHAR(30) NOT NULL DEFAULT 'qr',
  -- qr | barcode | rfid | nfc | gps | ble
  id_value TEXT NOT NULL,
  symbology VARCHAR(40),
  -- code128 | code39 | ean | gs1 | uhf | hf | passive | active
  payload TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_encrypted BOOLEAN DEFAULT true,
  signature_hash VARCHAR(64),
  status VARCHAR(30) DEFAULT 'active',
  -- active | replaced | void | lost
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ast_id_value ON ast_identifiers(company_id, id_type, id_value);

CREATE TABLE IF NOT EXISTS ast_tag_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  width_mm DECIMAL(8,2) DEFAULT 50,
  height_mm DECIMAL(8,2) DEFAULT 30,
  layout_json JSONB DEFAULT '{}'::jsonb,
  media_type VARCHAR(40) DEFAULT 'polyester',
  -- polyester | metal | outdoor | security | paper
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

-- ============================================================
-- ASSIGNMENTS · TRANSFERS · LOCATION
-- ============================================================
CREATE TABLE IF NOT EXISTS ast_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES ast_assets(id) ON DELETE CASCADE,
  assignment_type VARCHAR(40) DEFAULT 'employee',
  -- employee | department | branch | warehouse | vehicle | production_line | project
  assignee_name VARCHAR(200),
  assignee_id UUID REFERENCES user_profiles(id),
  department VARCHAR(100),
  branch_name VARCHAR(150),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expected_return DATE,
  returned_at TIMESTAMPTZ,
  condition_out VARCHAR(40) DEFAULT 'good',
  condition_in VARCHAR(40),
  status VARCHAR(30) DEFAULT 'active',
  -- active | returned | overdue | cancelled
  approved_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ast_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES ast_assets(id) ON DELETE CASCADE,
  location_type VARCHAR(40) DEFAULT 'manual',
  -- manual | scan | gps | rfid | ble | nfc
  location_label VARCHAR(200),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES user_profiles(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ast_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES ast_assets(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) DEFAULT 'photo',
  -- photo | invoice | warranty | manual | certificate | other
  title VARCHAR(255) NOT NULL,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ast_maintenance_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES ast_assets(id) ON DELETE CASCADE,
  work_order_ref VARCHAR(100),
  maintenance_type VARCHAR(40) DEFAULT 'corrective',
  -- preventive | corrective | calibration | inspection
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'open',
  -- open | in_progress | completed | cancelled
  scheduled_date DATE,
  completed_date DATE,
  cost DECIMAL(14,2) DEFAULT 0,
  technician_name VARCHAR(150),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY AUDITS
-- ============================================================
CREATE TABLE IF NOT EXISTS ast_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  scope_type VARCHAR(40) DEFAULT 'department',
  -- company | branch | department | warehouse | category
  scope_value VARCHAR(150),
  method VARCHAR(40) DEFAULT 'qr',
  -- qr | barcode | rfid | nfc | mixed
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | in_progress | completed | cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  found_count INTEGER DEFAULT 0,
  missing_count INTEGER DEFAULT 0,
  damaged_count INTEGER DEFAULT 0,
  moved_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, audit_number)
);

CREATE TABLE IF NOT EXISTS ast_audit_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES ast_audits(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES ast_assets(id) ON DELETE SET NULL,
  asset_tag VARCHAR(80),
  result VARCHAR(30) DEFAULT 'found',
  -- found | missing | damaged | moved | retired
  scanned_value TEXT,
  notes TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  scanned_by UUID REFERENCES user_profiles(id)
);

CREATE TABLE IF NOT EXISTS ast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES ast_assets(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  -- created | tagged | printed | assigned | returned | moved | audit | maintenance | alert
  title VARCHAR(255) NOT NULL,
  details TEXT,
  actor_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ast_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES ast_assets(id) ON DELETE SET NULL,
  alert_type VARCHAR(40) NOT NULL,
  -- warranty | calibration | maintenance | license | missing | unauthorized_move | duplicate
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ast_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  detail TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ast_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(40),
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ast_categories','ast_number_sequences','ast_assets','ast_identifiers',
    'ast_tag_templates','ast_assignments','ast_locations','ast_documents',
    'ast_maintenance_links','ast_audits','ast_audit_lines','ast_events',
    'ast_alerts','ast_ai_insights','ast_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
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
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID;
  cat_lap UUID;
  cat_prn UUID;
  cat_mch UUID;
  aid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO ast_categories (company_id, category_code, name, domain, type_code, prefix_template)
  VALUES
    (cid, 'IT-LAP', 'Laptops', 'it', 'LAP', 'HDG-IT-LAP'),
    (cid, 'IT-PRN', 'Printers', 'it', 'PRN', 'HDG-IT-PRN'),
    (cid, 'IT-SRV', 'Servers', 'it', 'SRV', 'HDG-IT-SRV'),
    (cid, 'IT-NET', 'Network Gear', 'it', 'NET', 'HDG-IT-NET'),
    (cid, 'MFG-MCH', 'Production Machines', 'mfg', 'MCH', 'HDG-MFG-MCH'),
    (cid, 'WHS-RCK', 'Warehouse Racks', 'mfg', 'RCK', 'HDG-WHS-RCK'),
    (cid, 'OFF-FUR', 'Office Furniture', 'office', 'FUR', 'HDG-OFF-FUR'),
    (cid, 'FLT-VEH', 'Vehicles', 'fleet', 'VEH', 'HDG-FLT-VEH'),
    (cid, 'DIG-SW', 'Software Licenses', 'digital', 'SW', 'HDG-DIG-SW')
  ON CONFLICT (company_id, category_code) DO NOTHING;

  SELECT id INTO cat_lap FROM ast_categories WHERE company_id = cid AND category_code = 'IT-LAP';
  SELECT id INTO cat_prn FROM ast_categories WHERE company_id = cid AND category_code = 'IT-PRN';
  SELECT id INTO cat_mch FROM ast_categories WHERE company_id = cid AND category_code = 'MFG-MCH';

  INSERT INTO ast_number_sequences (company_id, sequence_key, last_number, pad_width)
  VALUES
    (cid, 'IT-LAP', 2, 6),
    (cid, 'IT-PRN', 1, 6),
    (cid, 'MFG-MCH', 1, 6)
  ON CONFLICT (company_id, sequence_key) DO NOTHING;

  INSERT INTO ast_tag_templates (company_id, template_code, name, width_mm, height_mm, media_type, layout_json, is_default)
  VALUES
    (cid, 'TAG-STD', 'Standard Asset Tag 50×30', 50, 30, 'polyester',
     '{"elements":[{"type":"logo"},{"type":"tag"},{"type":"qr"},{"type":"barcode"},{"type":"name"}]}'::jsonb, true),
    (cid, 'TAG-METAL', 'Metal Plate Tag', 70, 40, 'metal',
     '{"elements":[{"type":"tag"},{"type":"qr"},{"type":"serial"}]}'::jsonb, false)
  ON CONFLICT (company_id, template_code) DO NOTHING;

  -- Sample assets
  IF NOT EXISTS (SELECT 1 FROM ast_assets WHERE company_id = cid AND asset_tag = 'HDG-IT-LAP-000001') THEN
    INSERT INTO ast_assets (
      company_id, asset_tag, name, category_id, category_code, domain, type_code,
      status, condition, manufacturer, model, serial_number, department, branch_name,
      purchase_cost, current_value, warranty_end, next_maintenance_date
    ) VALUES
      (cid, 'HDG-IT-LAP-000001', 'Dell Latitude 5540', cat_lap, 'IT-LAP', 'it', 'LAP',
       'assigned', 'good', 'Dell', 'Latitude 5540', 'SN-DL5540-001', 'IT', 'Kampala HQ',
       4500000, 3800000, CURRENT_DATE + 365, CURRENT_DATE + 90),
      (cid, 'HDG-IT-LAP-000002', 'HP EliteBook 840', cat_lap, 'IT-LAP', 'it', 'LAP',
       'active', 'good', 'HP', 'EliteBook 840 G10', 'SN-HP840-002', 'Finance', 'Kampala HQ',
       5200000, 4800000, CURRENT_DATE + 400, CURRENT_DATE + 120),
      (cid, 'HDG-IT-PRN-000001', 'Warehouse Zebra ZT230', cat_prn, 'IT-PRN', 'it', 'PRN',
       'active', 'good', 'Zebra', 'ZT230', 'SN-ZB-ZT230-01', 'Warehouse', 'Kampala HQ',
       8500000, 7200000, CURRENT_DATE + 200, CURRENT_DATE + 60),
      (cid, 'HDG-MFG-MCH-000001', 'Paper Guillotine Press', cat_mch, 'MFG-MCH', 'mfg', 'MCH',
       'active', 'fair', 'Polar', 'N115', 'SN-POL-N115', 'Production', 'Kampala HQ',
       85000000, 62000000, CURRENT_DATE + 100, CURRENT_DATE + 30);
  END IF;

  -- Identifiers for seed assets
  FOR aid IN SELECT id FROM ast_assets WHERE company_id = cid
  LOOP
    IF NOT EXISTS (SELECT 1 FROM ast_identifiers i WHERE i.asset_id = aid) THEN
      INSERT INTO ast_identifiers (company_id, asset_id, id_type, id_value, symbology, payload, is_primary, is_encrypted, signature_hash, status)
      SELECT cid, a.id, 'qr', a.asset_tag, 'qr',
        'https://hope-securetrack.vercel.app/dashboard/assets/scan?tag=' || a.asset_tag,
        true, true, md5(a.asset_tag || a.id::text), 'active'
      FROM ast_assets a WHERE a.id = aid;

      INSERT INTO ast_identifiers (company_id, asset_id, id_type, id_value, symbology, is_primary, status)
      SELECT cid, a.id, 'barcode', a.asset_tag, 'code128', false, 'active'
      FROM ast_assets a WHERE a.id = aid;

      INSERT INTO ast_identifiers (company_id, asset_id, id_type, id_value, symbology, is_primary, status)
      SELECT cid, a.id, 'rfid', 'RFID-' || replace(a.asset_tag, '-', ''), 'uhf', false, 'active'
      FROM ast_assets a WHERE a.id = aid;
    END IF;
  END LOOP;

  INSERT INTO ast_alerts (company_id, asset_id, alert_type, severity, title, detail, status)
  SELECT cid, a.id, 'warranty', 'medium', 'Warranty expiring: ' || a.name,
    'Warranty ends ' || a.warranty_end::text, 'open'
  FROM ast_assets a
  WHERE a.company_id = cid AND a.warranty_end IS NOT NULL AND a.warranty_end < CURRENT_DATE + 120
  AND NOT EXISTS (SELECT 1 FROM ast_alerts x WHERE x.asset_id = a.id AND x.alert_type = 'warranty' AND x.status = 'open');

END $$;
