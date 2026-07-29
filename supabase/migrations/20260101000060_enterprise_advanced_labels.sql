-- Hope SecureTrack ERP — Enterprise Advanced Labels Platform
-- Templates · Formats · Materials · Batches · Barcodes · GS1 · Shipping · Security · AI

-- ============================================================
-- FORMATS / CATEGORIES / TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS lbl_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  format_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  width_mm DECIMAL(8,2) NOT NULL DEFAULT 50,
  height_mm DECIMAL(8,2) NOT NULL DEFAULT 30,
  orientation VARCHAR(20) DEFAULT 'portrait',
  -- portrait|landscape
  corner_radius_mm DECIMAL(5,2) DEFAULT 0,
  dpi INTEGER DEFAULT 203,
  columns INTEGER DEFAULT 1,
  rows INTEGER DEFAULT 1,
  gap_mm DECIMAL(5,2) DEFAULT 2,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, format_code)
);

CREATE TABLE IF NOT EXISTS lbl_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  label_family VARCHAR(40) DEFAULT 'product',
  -- product|carton|pallet|shipping|shelf|asset|security|id|compliance|custom
  description TEXT,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, category_code)
);

CREATE TABLE IF NOT EXISTS lbl_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  category_code VARCHAR(50),
  format_code VARCHAR(50),
  label_type VARCHAR(40) DEFAULT 'product',
  -- product|ream|carton|pallet|shipping|shelf|bin|asset|security|auth_qr|gs1|custom
  version INTEGER DEFAULT 1,
  layout_json JSONB DEFAULT '{}'::jsonb,
  preview_url TEXT,
  default_printer_model VARCHAR(100),
  barcode_symbology VARCHAR(40) DEFAULT 'qr',
  include_logo BOOLEAN DEFAULT true,
  include_serial BOOLEAN DEFAULT true,
  include_batch BOOLEAN DEFAULT true,
  include_mfg_date BOOLEAN DEFAULT true,
  include_expiry BOOLEAN DEFAULT false,
  language VARCHAR(10) DEFAULT 'en',
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|active|retired
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code)
);

CREATE TABLE IF NOT EXISTS lbl_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_code VARCHAR(50) NOT NULL,
  template_code VARCHAR(50),
  field_key VARCHAR(80) NOT NULL,
  label_text VARCHAR(150),
  field_type VARCHAR(40) DEFAULT 'text',
  -- text|number|date|barcode|qr|image|logo|variable
  data_source VARCHAR(80),
  -- product.name|serial|batch|static|custom
  x_mm DECIMAL(8,2) DEFAULT 0,
  y_mm DECIMAL(8,2) DEFAULT 0,
  width_mm DECIMAL(8,2) DEFAULT 20,
  height_mm DECIMAL(8,2) DEFAULT 5,
  font_size INTEGER DEFAULT 10,
  font_weight VARCHAR(20) DEFAULT 'normal',
  align VARCHAR(20) DEFAULT 'left',
  required BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, field_code)
);

CREATE TABLE IF NOT EXISTS lbl_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  variable_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  token VARCHAR(80) NOT NULL,
  -- {{product_name}} etc
  default_value TEXT,
  sample_value TEXT,
  data_type VARCHAR(30) DEFAULT 'string',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, variable_code)
);

-- ============================================================
-- MATERIALS / STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS lbl_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  material_type VARCHAR(40) DEFAULT 'thermal',
  -- thermal|direct_thermal|transfer|paper|polyester|vinyl|fabric
  format_code VARCHAR(50),
  width_mm DECIMAL(8,2),
  height_mm DECIMAL(8,2),
  color VARCHAR(40) DEFAULT 'white',
  adhesive VARCHAR(40) DEFAULT 'permanent',
  roll_qty INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 50,
  unit_cost DECIMAL(12,4) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  supplier_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, material_code)
);

CREATE TABLE IF NOT EXISTS lbl_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stock_code VARCHAR(50) NOT NULL,
  material_code VARCHAR(50) NOT NULL,
  location_name VARCHAR(150),
  branch_name VARCHAR(150),
  qty_on_hand INTEGER DEFAULT 0,
  qty_reserved INTEGER DEFAULT 0,
  lot_number VARCHAR(80),
  received_at DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'available',
  -- available|low|expired|quarantine
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, stock_code)
);

-- ============================================================
-- BARCODES / GS1 / SECURITY
-- ============================================================
CREATE TABLE IF NOT EXISTS lbl_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  barcode_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  symbology VARCHAR(40) DEFAULT 'qr',
  -- qr|code128|code39|ean13|upc|gs1_128|pdf417|datamatrix|aztec
  sample_value TEXT,
  error_correction VARCHAR(10) DEFAULT 'M',
  module_size DECIMAL(5,2) DEFAULT 3,
  human_readable BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, barcode_code)
);

CREATE TABLE IF NOT EXISTS lbl_gs1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gs1_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  company_prefix VARCHAR(20),
  gtin VARCHAR(20),
  ai_list TEXT,
  -- (01)(10)(17)(21) etc
  application_identifier VARCHAR(40),
  serial_ai VARCHAR(10) DEFAULT '21',
  lot_ai VARCHAR(10) DEFAULT '10',
  expiry_ai VARCHAR(10) DEFAULT '17',
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, gs1_code)
);

CREATE TABLE IF NOT EXISTS lbl_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  security_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  feature_type VARCHAR(40) DEFAULT 'watermark',
  -- watermark|microtext|hologram|void_panel|uv|serial_crypto|checksum|qr_signed
  intensity VARCHAR(20) DEFAULT 'medium',
  template_code VARCHAR(50),
  config_json JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, security_code)
);

-- ============================================================
-- RULES / BATCHES / INSTANCES / JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS lbl_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  trigger_event VARCHAR(60) DEFAULT 'batch_complete',
  -- batch_complete|order_confirm|grn|shipment|asset_create|manual
  template_code VARCHAR(50),
  label_type VARCHAR(40) DEFAULT 'product',
  auto_print BOOLEAN DEFAULT false,
  printer_name VARCHAR(150),
  copies INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS lbl_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  template_code VARCHAR(50),
  format_code VARCHAR(50),
  material_code VARCHAR(50),
  label_type VARCHAR(40) DEFAULT 'product',
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  production_batch VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  printed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  start_serial VARCHAR(80),
  end_serial VARCHAR(80),
  printer_name VARCHAR(150),
  requested_by_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'draft',
  -- draft|ready|printing|paused|completed|failed|cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_code)
);

CREATE TABLE IF NOT EXISTS lbl_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label_number VARCHAR(50) NOT NULL,
  batch_code VARCHAR(50),
  template_code VARCHAR(50),
  label_type VARCHAR(40) DEFAULT 'product',
  serial_number VARCHAR(120),
  barcode_value VARCHAR(200),
  qr_payload TEXT,
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  lot_number VARCHAR(80),
  mfg_date DATE,
  expiry_date DATE,
  print_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  verification_status VARCHAR(30) DEFAULT 'unverified',
  -- unverified|valid|invalid|recalled
  status VARCHAR(30) DEFAULT 'ready',
  -- ready|printed|void|recalled|archived
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, label_number)
);

CREATE TABLE IF NOT EXISTS lbl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_code VARCHAR(50) NOT NULL,
  batch_code VARCHAR(50),
  template_code VARCHAR(50),
  printer_name VARCHAR(150),
  copies INTEGER DEFAULT 1,
  label_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5,
  is_reprint BOOLEAN DEFAULT false,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  requested_by_name VARCHAR(150),
  status VARCHAR(30) DEFAULT 'queued',
  -- queued|sending|printing|completed|failed|cancelled
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_code)
);

CREATE TABLE IF NOT EXISTS lbl_reprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reprint_code VARCHAR(50) NOT NULL,
  label_number VARCHAR(50),
  batch_code VARCHAR(50),
  reason VARCHAR(100),
  requested_by_name VARCHAR(150),
  approved_by_name VARCHAR(150),
  copies INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|printed|rejected
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reprint_code)
);

CREATE TABLE IF NOT EXISTS lbl_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_code VARCHAR(50) NOT NULL,
  approval_type VARCHAR(40) DEFAULT 'template',
  -- template|reprint|batch|security|void
  related_code VARCHAR(80),
  requested_by_name VARCHAR(150),
  approver_name VARCHAR(150),
  decision VARCHAR(30) DEFAULT 'pending',
  -- pending|approved|rejected
  reason TEXT,
  status VARCHAR(30) DEFAULT 'open',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, approval_code)
);

-- ============================================================
-- SPECIALIZED LABEL TYPES
-- ============================================================
CREATE TABLE IF NOT EXISTS lbl_shipping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shipping_code VARCHAR(50) NOT NULL,
  order_number VARCHAR(80),
  consignment_number VARCHAR(80),
  customer_name VARCHAR(255),
  ship_to_address TEXT,
  carrier_name VARCHAR(100),
  tracking_number VARCHAR(100),
  weight_kg DECIMAL(10,3) DEFAULT 0,
  packages INTEGER DEFAULT 1,
  barcode_value VARCHAR(200),
  qr_payload TEXT,
  status VARCHAR(30) DEFAULT 'ready',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, shipping_code)
);

CREATE TABLE IF NOT EXISTS lbl_pallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pallet_code VARCHAR(50) NOT NULL,
  sscc VARCHAR(40),
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  carton_count INTEGER DEFAULT 0,
  unit_count INTEGER DEFAULT 0,
  weight_kg DECIMAL(10,3) DEFAULT 0,
  warehouse_code VARCHAR(50),
  location_code VARCHAR(50),
  barcode_value VARCHAR(200),
  qr_payload TEXT,
  status VARCHAR(30) DEFAULT 'ready',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pallet_code)
);

CREATE TABLE IF NOT EXISTS lbl_shelf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shelf_code VARCHAR(50) NOT NULL,
  warehouse_code VARCHAR(50),
  aisle VARCHAR(40),
  rack VARCHAR(40),
  bin VARCHAR(40),
  product_code VARCHAR(80),
  product_name VARCHAR(255),
  barcode_value VARCHAR(200),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, shelf_code)
);

CREATE TABLE IF NOT EXISTS lbl_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  compliance_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  regulation VARCHAR(100),
  -- UNBS|KEBS|SON|FDA|ISO|CE|custom
  required_fields TEXT,
  template_code VARCHAR(50),
  product_category VARCHAR(100),
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, compliance_code)
);

CREATE TABLE IF NOT EXISTS lbl_printer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  printer_name VARCHAR(150),
  brand VARCHAR(80),
  model VARCHAR(100),
  connection_type VARCHAR(40) DEFAULT 'bluetooth',
  -- bluetooth|usb|network|system
  default_format_code VARCHAR(50),
  darkness INTEGER DEFAULT 8,
  speed INTEGER DEFAULT 4,
  dpi INTEGER DEFAULT 203,
  is_default BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, profile_code)
);

CREATE TABLE IF NOT EXISTS lbl_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type VARCHAR(40) DEFAULT 'spec',
  -- spec|artwork|approval|sop|other
  related_code VARCHAR(80),
  file_url TEXT,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, doc_code)
);

CREATE TABLE IF NOT EXISTS lbl_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notif_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  related_type VARCHAR(40),
  related_code VARCHAR(80),
  status VARCHAR(30) DEFAULT 'unread',
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, notif_code)
);

CREATE TABLE IF NOT EXISTS lbl_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  status VARCHAR(30) DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

CREATE TABLE IF NOT EXISTS lbl_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_code VARCHAR(50) NOT NULL,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  score DECIMAL(5,2) DEFAULT 0,
  recommendations TEXT,
  status VARCHAR(30) DEFAULT 'open',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, insight_code)
);

CREATE TABLE IF NOT EXISTS lbl_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES user_profiles(id),
  action VARCHAR(50) NOT NULL,
  entity_table VARCHAR(80),
  entity_id UUID,
  entity_code VARCHAR(80),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_lbl_templates_type ON lbl_templates(company_id, label_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lbl_batches_status ON lbl_batches(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lbl_instances_serial ON lbl_instances(company_id, serial_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lbl_jobs_status ON lbl_jobs(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lbl_materials_status ON lbl_materials(company_id, status) WHERE deleted_at IS NULL;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lbl_formats','lbl_categories','lbl_templates','lbl_fields','lbl_variables',
    'lbl_materials','lbl_stock','lbl_barcodes','lbl_gs1','lbl_security',
    'lbl_rules','lbl_batches','lbl_instances','lbl_jobs','lbl_reprints','lbl_approvals',
    'lbl_shipping','lbl_pallet','lbl_shelf','lbl_compliance','lbl_printer_profiles',
    'lbl_documents','lbl_notifications','lbl_settings','lbl_ai_insights','lbl_audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
      t || '_all', t
    );
  END LOOP;
END $$;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('Advanced Labels View', 'lbl.view', 'labels', 'View advanced labels platform'),
  ('Advanced Labels Manage', 'lbl.manage', 'labels', 'Create and manage labels'),
  ('Advanced Labels Design', 'lbl.design', 'labels', 'Label templates and designer'),
  ('Advanced Labels Print', 'lbl.print', 'labels', 'Print and reprint labels'),
  ('Advanced Labels Approvals', 'lbl.approve', 'labels', 'Approve reprints and templates'),
  ('Advanced Labels Security', 'lbl.security', 'labels', 'Security features and voids'),
  ('Advanced Labels AI', 'lbl.ai', 'labels', 'AI label insights'),
  ('Advanced Labels Admin', 'lbl.admin', 'labels', 'Label settings and audit')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug)
  AND NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug IN (
  'super_administrator','managing_director','operations_manager',
  'production_manager','warehouse_manager','quality_manager','auditor'
)
AND p.slug LIKE 'lbl.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN RETURN; END IF;

  INSERT INTO lbl_formats (company_id, format_code, name, width_mm, height_mm, dpi, status) VALUES
    (cid, 'FMT-50x30', 'Ream 50×30 mm', 50, 30, 203, 'active'),
    (cid, 'FMT-70x50', 'Carton 70×50 mm', 70, 50, 203, 'active'),
    (cid, 'FMT-100x150', 'Shipping 100×150 mm', 100, 150, 300, 'active'),
    (cid, 'FMT-CR80', 'CR80 ID Card', 85.6, 54, 300, 'active')
  ON CONFLICT (company_id, format_code) DO NOTHING;

  INSERT INTO lbl_categories (company_id, category_code, name, label_family, status) VALUES
    (cid, 'CAT-PROD', 'Product Labels', 'product', 'active'),
    (cid, 'CAT-SHIP', 'Shipping Labels', 'shipping', 'active'),
    (cid, 'CAT-INV', 'Inventory Labels', 'shelf', 'active'),
    (cid, 'CAT-SEC', 'Security Labels', 'security', 'active')
  ON CONFLICT (company_id, category_code) DO NOTHING;

  INSERT INTO lbl_templates (company_id, template_code, name, category_code, format_code, label_type, barcode_symbology, is_default, status) VALUES
    (cid, 'TPL-REAM', 'Auth Ream Label', 'CAT-PROD', 'FMT-50x30', 'auth_qr', 'qr', true, 'active'),
    (cid, 'TPL-CARTON', 'Carton Label', 'CAT-PROD', 'FMT-70x50', 'carton', 'code128', false, 'active'),
    (cid, 'TPL-SHIP', 'Shipping Label', 'CAT-SHIP', 'FMT-100x150', 'shipping', 'code128', false, 'active'),
    (cid, 'TPL-SHELF', 'Shelf Bin Label', 'CAT-INV', 'FMT-50x30', 'shelf', 'code128', false, 'active')
  ON CONFLICT (company_id, template_code) DO NOTHING;

  INSERT INTO lbl_materials (company_id, material_code, name, material_type, format_code, width_mm, height_mm, roll_qty, reorder_level, unit_cost, status) VALUES
    (cid, 'MAT-T50', 'Thermal 50×30 roll', 'direct_thermal', 'FMT-50x30', 50, 30, 500, 100, 150, 'active'),
    (cid, 'MAT-T70', 'Thermal 70×50 roll', 'direct_thermal', 'FMT-70x50', 70, 50, 300, 50, 220, 'active')
  ON CONFLICT (company_id, material_code) DO NOTHING;

  INSERT INTO lbl_barcodes (company_id, barcode_code, name, symbology, sample_value, status) VALUES
    (cid, 'BC-QR', 'Verification QR', 'qr', '{"v":1,"s":"DEMO"}', 'active'),
    (cid, 'BC-128', 'Code 128 Serial', 'code128', 'HDG-000001', 'active'),
    (cid, 'BC-EAN', 'EAN-13 Retail', 'ean13', '6001234567890', 'active')
  ON CONFLICT (company_id, barcode_code) DO NOTHING;

  INSERT INTO lbl_variables (company_id, variable_code, name, token, sample_value, data_type, status) VALUES
    (cid, 'VAR-PN', 'Product Name', '{{product_name}}', 'A4 Bond Paper', 'string', 'active'),
    (cid, 'VAR-SN', 'Serial Number', '{{serial}}', 'HDG-2026-00001', 'string', 'active'),
    (cid, 'VAR-BN', 'Batch Number', '{{batch}}', 'B-2026-001', 'string', 'active'),
    (cid, 'VAR-MFG', 'Mfg Date', '{{mfg_date}}', '2026-07-01', 'date', 'active')
  ON CONFLICT (company_id, variable_code) DO NOTHING;

  INSERT INTO lbl_settings (company_id, setting_key, setting_value, category, description) VALUES
    (cid, 'default_format', 'FMT-50x30', 'general', 'Default label format'),
    (cid, 'default_symbology', 'qr', 'barcode', 'Default barcode type'),
    (cid, 'require_reprint_approval', 'true', 'security', 'Reprints need approval'),
    (cid, 'max_batch_size', '5000', 'print', 'Max labels per batch')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO lbl_ai_insights (company_id, insight_code, insight_type, title, summary, severity, score, recommendations, status) VALUES
    (cid, 'AI-LBL-01', 'stock', 'Label media running low', 'Thermal 50×30 stock is near reorder on primary branch.', 'medium', 70, 'Reorder MAT-T50; enable auto-reorder alerts', 'open'),
    (cid, 'AI-LBL-02', 'quality', 'Reprint rate elevated', 'Reprint ratio above 3% on auth ream labels this week.', 'high', 78, 'Check ribbon/darkness; verify serial collisions', 'open')
  ON CONFLICT (company_id, insight_code) DO NOTHING;
END $$;
