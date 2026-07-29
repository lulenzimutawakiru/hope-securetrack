-- Hope Design Group — Enterprise Printer Management & Printing Platform
-- Registry · queue · labels · Niimbot · security print · document print · designer

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Print Platform', 'print.view', 'print', 'View printers, queues, and templates'),
  ('Manage Print Platform', 'print.manage', 'print', 'Register and configure printers'),
  ('Submit Print Jobs', 'print.submit', 'print', 'Queue print jobs'),
  ('Print Operator', 'print.operate', 'print', 'Run queue and reprint'),
  ('Design Labels', 'print.design', 'print', 'Label designer and templates'),
  ('Security Print', 'print.security', 'print', 'Security printing features'),
  ('Print Admin', 'print.admin', 'print', 'Full print infrastructure admin'),
  ('Print AI', 'print.ai', 'print', 'AI print assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'print.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'production_manager','production_supervisor','warehouse_manager',
    'auditor','quality_assurance'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Align legacy printing permissions for same roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('printing.create','printing.manage','printing.reprint','printers.manage')
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'production_manager','production_supervisor','warehouse_manager'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND printers REGISTRY
-- ============================================================
ALTER TABLE printers
  ADD COLUMN IF NOT EXISTS printer_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(80),
  ADD COLUMN IF NOT EXISTS printer_type VARCHAR(40) DEFAULT 'label',
  -- laser | inkjet | thermal | label | card | industrial | pos | dot_matrix | plotter | mfp
  ADD COLUMN IF NOT EXISTS asset_tag VARCHAR(80),
  ADD COLUMN IF NOT EXISTS mac_address VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(60),
  ADD COLUMN IF NOT EXISTS usb_identifier VARCHAR(120),
  ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transport VARCHAR(40) DEFAULT 'bluetooth',
  -- bluetooth | usb | network | system | agent
  ADD COLUMN IF NOT EXISTS bluetooth_address VARCHAR(80),
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS physical_location TEXT,
  ADD COLUMN IF NOT EXISTS assigned_admin UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS warranty_until DATE,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(40),
  ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_width_mm DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS label_height_mm DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS supports_cut BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_color BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_dpi INTEGER DEFAULT 203,
  ADD COLUMN IF NOT EXISTS paper_width_mm DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_code
  ON printers(company_id, printer_code) WHERE printer_code IS NOT NULL AND deleted_at IS NULL;

-- Extend print_jobs for document types
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'label',
  -- label | invoice | po | receipt | id_card | certificate | report | work_order | security
  ADD COLUMN IF NOT EXISTS document_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS queue_position INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copies INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS paper_size VARCHAR(40) DEFAULT 'label',
  ADD COLUMN IF NOT EXISTS orientation VARCHAR(20) DEFAULT 'portrait',
  ADD COLUMN IF NOT EXISTS security_level VARCHAR(20) DEFAULT 'standard',
  -- standard | confidential | security
  ADD COLUMN IF NOT EXISTS payload_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- MEDIA · TEMPLATES · DESIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  media_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  media_type VARCHAR(40) DEFAULT 'label',
  -- label | card | a4 | letter | continuous | receipt | ribbon
  width_mm DECIMAL(8,2) NOT NULL,
  height_mm DECIMAL(8,2),
  gap_mm DECIMAL(6,2) DEFAULT 2,
  brand_compat TEXT[] DEFAULT ARRAY[]::TEXT[],
  stock_qty INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, media_code)
);

CREATE TABLE IF NOT EXISTS prt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'label',
  -- label | document | id_card | security | packaging | warehouse | shipping
  document_type VARCHAR(50) DEFAULT 'product_label',
  -- product_label | qr_auth | barcode | shipping | shelf | pallet | invoice | po | id_card | ...
  media_id UUID REFERENCES prt_media(id) ON DELETE SET NULL,
  width_mm DECIMAL(8,2) DEFAULT 50,
  height_mm DECIMAL(8,2) DEFAULT 30,
  layout_json JSONB DEFAULT '{}'::jsonb,
  html_preview TEXT,
  zpl_template TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  security_enabled BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'published',
  -- draft | review | published | archived
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_code, version)
);

CREATE TABLE IF NOT EXISTS prt_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  design_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  canvas_json JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES user_profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, design_code, version)
);

-- ============================================================
-- SECURITY PRINT PROFILES · BARCODE PRESETS
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_security_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  watermark_text TEXT,
  microtext TEXT,
  invisible_marker TEXT,
  uv_placeholder BOOLEAN DEFAULT false,
  hologram_zone BOOLEAN DEFAULT false,
  tamper_qr BOOLEAN DEFAULT true,
  digital_signature BOOLEAN DEFAULT true,
  serial_prefix VARCHAR(20) DEFAULT 'SEC',
  background_pattern VARCHAR(40) DEFAULT 'guilloche',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, profile_code)
);

CREATE TABLE IF NOT EXISTS prt_barcode_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  preset_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  symbology VARCHAR(40) NOT NULL DEFAULT 'code128',
  -- qr | code128 | code39 | ean13 | upc | gs1_128 | pdf417 | datamatrix | aztec
  sample_payload TEXT,
  module_width DECIMAL(6,3) DEFAULT 2,
  height_mm DECIMAL(6,2) DEFAULT 15,
  human_readable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, preset_code)
);

-- ============================================================
-- ENTERPRISE QUEUE · BATCHES · SERVICE
-- ============================================================
CREATE TABLE IF NOT EXISTS prt_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  queue_number VARCHAR(50) NOT NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  print_job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  job_title VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) DEFAULT 'label',
  status VARCHAR(30) DEFAULT 'queued',
  -- queued | sending | printing | completed | failed | cancelled | held
  priority INTEGER DEFAULT 5,
  copies INTEGER DEFAULT 1,
  pages INTEGER DEFAULT 1,
  payload_json JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  submitted_by UUID REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, queue_number)
);

CREATE INDEX IF NOT EXISTS idx_prt_queue_status ON prt_queue(company_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS prt_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | running | completed | failed | cancelled
  source_type VARCHAR(40) DEFAULT 'manual',
  -- manual | production | inventory | shipping | hr
  source_ref VARCHAR(100),
  created_by UUID REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, batch_number)
);

CREATE TABLE IF NOT EXISTS prt_service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  service_date DATE DEFAULT CURRENT_DATE,
  service_type VARCHAR(40) DEFAULT 'maintenance',
  -- maintenance | repair | install | calibration | firmware | other
  description TEXT,
  cost DECIMAL(14,2) DEFAULT 0,
  performed_by VARCHAR(150),
  next_service_date DATE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prt_document_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  -- invoice | po | quotation | grn | delivery_note | receipt | report | contract | work_order | certificate
  default_printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  paper_size VARCHAR(40) DEFAULT 'A4',
  copies INTEGER DEFAULT 1,
  tray VARCHAR(40),
  duplex BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, profile_code)
);

CREATE TABLE IF NOT EXISTS prt_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  match_document_type VARCHAR(50),
  match_branch VARCHAR(100),
  target_printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
  target_template_id UUID REFERENCES prt_templates(id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rule_code)
);

CREATE TABLE IF NOT EXISTS prt_ai_insights (
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

CREATE TABLE IF NOT EXISTS prt_audit (
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
    'prt_media','prt_templates','prt_designs','prt_security_profiles','prt_barcode_presets',
    'prt_queue','prt_batches','prt_service_logs','prt_document_profiles','prt_rules',
    'prt_ai_insights','prt_audit'
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
  pid_zebra UUID;
  pid_niim UUID;
  mid UUID;
  tid UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  -- Upgrade existing printers if present
  UPDATE printers SET
    brand = COALESCE(brand, CASE
      WHEN lower(model) LIKE '%niimbot%' OR model IN ('B21','B1','D11','D110') THEN 'Niimbot'
      WHEN lower(model) LIKE '%zebra%' THEN 'Zebra'
      ELSE manufacturer
    END),
    printer_type = COALESCE(printer_type, 'label'),
    manufacturer = COALESCE(manufacturer, brand)
  WHERE company_id = cid;

  -- Seed printers if few
  IF (SELECT COUNT(*) FROM printers WHERE company_id = cid AND deleted_at IS NULL) < 2 THEN
    INSERT INTO printers (
      company_id, printer_code, name, model, manufacturer, brand, printer_type,
      connection_type, transport, status, is_active, is_default,
      label_width_mm, label_height_mm, max_dpi, physical_location, branch_name
    ) VALUES
      (cid, 'PRT-ZEB-01', 'Warehouse Zebra ZT230', 'ZT230', 'Zebra', 'Zebra', 'industrial',
       'network', 'network', 'online', true, false, 100, 50, 300, 'Packing line 1', 'Kampala HQ'),
      (cid, 'PRT-NIM-01', 'Mobile Niimbot B21', 'B21', 'Niimbot', 'Niimbot', 'label',
       'bluetooth', 'bluetooth', 'online', true, true, 50, 30, 203, 'Production floor', 'Kampala HQ'),
      (cid, 'PRT-HP-01', 'Office HP LaserJet', 'LaserJet Pro M404', 'HP', 'HP', 'laser',
       'network', 'network', 'online', true, false, NULL, NULL, 1200, 'Admin office', 'Kampala HQ'),
      (cid, 'PRT-EPS-TM', 'POS Epson TM-T20', 'TM-T20III', 'Epson', 'Epson', 'pos',
       'usb', 'usb', 'offline', true, false, 80, NULL, 203, 'Front desk', 'Kampala HQ')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO pid_zebra FROM printers WHERE company_id = cid AND (printer_code = 'PRT-ZEB-01' OR name ILIKE '%Zebra%') LIMIT 1;
  SELECT id INTO pid_niim FROM printers WHERE company_id = cid AND (printer_code = 'PRT-NIM-01' OR model = 'B21') LIMIT 1;

  INSERT INTO prt_media (company_id, media_code, name, media_type, width_mm, height_mm, brand_compat, stock_qty)
  VALUES
    (cid, 'MED-20x10', 'Tiny 20×10 mm', 'label', 20, 10, ARRAY['Niimbot','TSC'], 500),
    (cid, 'MED-30x20', 'Small 30×20 mm', 'label', 30, 20, ARRAY['Niimbot','Zebra'], 800),
    (cid, 'MED-40x30', 'Medium 40×30 mm', 'label', 40, 30, ARRAY['Niimbot','Zebra','TSC'], 1000),
    (cid, 'MED-50x30', 'Ream 50×30 mm', 'label', 50, 30, ARRAY['Niimbot','Zebra'], 2000),
    (cid, 'MED-50x50', 'Square 50×50 mm', 'label', 50, 50, ARRAY['Zebra','SATO'], 500),
    (cid, 'MED-CR80', 'CR80 Card', 'card', 85.6, 54, ARRAY['Evolis','HID Fargo','Zebra Card'], 200),
    (cid, 'MED-A4', 'A4 Office', 'a4', 210, 297, ARRAY['HP','Canon','Epson','Brother'], 5000)
  ON CONFLICT (company_id, media_code) DO NOTHING;

  SELECT id INTO mid FROM prt_media WHERE company_id = cid AND media_code = 'MED-50x30';

  INSERT INTO prt_templates (
    company_id, template_code, name, category, document_type, media_id,
    width_mm, height_mm, layout_json, variables, security_enabled, status, is_default, version
  ) VALUES
    (cid, 'TPL-QR-REAM', 'QR Authentication Ream Label', 'label', 'qr_auth', mid,
     50, 30,
     '{"elements":[{"type":"logo","x":2,"y":2},{"type":"text","field":"product_name","x":14,"y":2},{"type":"qr","field":"qr_payload","x":2,"y":10,"size":18},{"type":"text","field":"serial","x":22,"y":12},{"type":"text","field":"batch","x":22,"y":18},{"type":"barcode","field":"serial","symbology":"code128","x":22,"y":22,"w":26,"h":6}]}'::jsonb,
     '["product_name","serial","batch","qr_payload","mfg_date","gsm"]'::jsonb,
     true, 'published', true, 1),
    (cid, 'TPL-SHIP', 'Shipping Label 100×150', 'shipping', 'shipping', NULL,
     100, 150,
     '{"elements":[{"type":"text","field":"to_name","x":5,"y":5},{"type":"text","field":"to_address","x":5,"y":15},{"type":"barcode","field":"tracking","symbology":"code128","x":5,"y":40},{"type":"qr","field":"tracking","x":70,"y":40}]}'::jsonb,
     '["to_name","to_address","tracking","weight"]'::jsonb,
     false, 'published', false, 1),
    (cid, 'TPL-SHELF', 'Warehouse Shelf Label', 'warehouse', 'shelf', NULL,
     70, 40,
     '{"elements":[{"type":"text","field":"sku","x":4,"y":4},{"type":"text","field":"location","x":4,"y":14},{"type":"barcode","field":"sku","symbology":"code128","x":4,"y":24}]}'::jsonb,
     '["sku","location","product_name"]'::jsonb,
     false, 'published', false, 1),
    (cid, 'TPL-ID', 'Employee ID Card Front', 'id_card', 'id_card', NULL,
     85.6, 54,
     '{"elements":[{"type":"logo","x":4,"y":4},{"type":"photo","x":60,"y":8},{"type":"text","field":"full_name","x":4,"y":22},{"type":"text","field":"title","x":4,"y":30},{"type":"qr","field":"id_token","x":4,"y":36,"size":14}]}'::jsonb,
     '["full_name","title","employee_number","id_token"]'::jsonb,
     true, 'published', false, 1),
    (cid, 'TPL-INV', 'A4 Invoice Print Profile', 'document', 'invoice', NULL,
     210, 297,
     '{"elements":[{"type":"header"},{"type":"table"},{"type":"footer"},{"type":"watermark","text":"HOPE DESIGN GROUP"}]}'::jsonb,
     '["invoice_number","customer_name","total"]'::jsonb,
     false, 'published', true, 1)
  ON CONFLICT DO NOTHING;

  SELECT id INTO tid FROM prt_templates WHERE company_id = cid AND template_code = 'TPL-QR-REAM' LIMIT 1;

  INSERT INTO prt_security_profiles (company_id, profile_code, name, watermark_text, microtext, tamper_qr, hologram_zone, digital_signature)
  VALUES
    (cid, 'SEC-STD', 'Standard Secure Label', 'AUTHENTIC · HOPE DESIGN GROUP', 'HOPE-SECURE-TRACK-MICRO', true, false, true),
    (cid, 'SEC-HI', 'High Security Document', 'CONFIDENTIAL', 'HDG-UV-LAYER', true, true, true)
  ON CONFLICT (company_id, profile_code) DO NOTHING;

  INSERT INTO prt_barcode_presets (company_id, preset_code, name, symbology, sample_payload)
  VALUES
    (cid, 'BC-QR', 'QR Authentication', 'qr', 'https://hope-securetrack.vercel.app/verify'),
    (cid, 'BC-C128', 'Code 128 Serial', 'code128', 'HDG-REAM-000001'),
    (cid, 'BC-EAN', 'EAN-13 Product', 'ean13', '6001234567890'),
    (cid, 'BC-DM', 'Data Matrix Asset', 'datamatrix', 'AST-0001'),
    (cid, 'BC-GS1', 'GS1-128 Logistics', 'gs1_128', '(01)09501101530003')
  ON CONFLICT (company_id, preset_code) DO NOTHING;

  INSERT INTO prt_document_profiles (company_id, profile_code, name, document_type, default_printer_id, paper_size, copies)
  VALUES
    (cid, 'DOC-INV', 'Tax Invoice', 'invoice', pid_zebra, 'A4', 1),
    (cid, 'DOC-PO', 'Purchase Order', 'po', NULL, 'A4', 1),
    (cid, 'DOC-DN', 'Delivery Note', 'delivery_note', NULL, 'A4', 2),
    (cid, 'DOC-GRN', 'Goods Received Note', 'grn', NULL, 'A4', 1),
    (cid, 'DOC-RCP', 'POS Receipt', 'receipt', NULL, '80mm', 1)
  ON CONFLICT (company_id, profile_code) DO NOTHING;

  INSERT INTO prt_rules (company_id, rule_code, name, match_document_type, target_printer_id, target_template_id, priority)
  VALUES
    (cid, 'RULE-QR', 'QR labels → Niimbot default', 'qr_auth', pid_niim, tid, 1),
    (cid, 'RULE-SHIP', 'Shipping → Zebra industrial', 'shipping', pid_zebra, NULL, 2)
  ON CONFLICT (company_id, rule_code) DO NOTHING;

  INSERT INTO prt_designs (company_id, design_code, name, template_id, canvas_json, status, version)
  SELECT cid, 'DSN-REAM-V1', 'Ream Auth Label Design', tid,
    '{"canvas":{"w":50,"h":30},"layers":[{"id":"l1","type":"qr"},{"id":"l2","type":"text"},{"id":"l3","type":"barcode"}]}'::jsonb,
    'published', 1
  WHERE tid IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM prt_designs d WHERE d.company_id = cid AND d.design_code = 'DSN-REAM-V1');

END $$;
