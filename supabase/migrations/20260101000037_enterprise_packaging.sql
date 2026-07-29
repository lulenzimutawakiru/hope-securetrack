-- Hope Design Group — Enterprise Packaging & Packing Management
-- Materials · cartonization · work orders · lines · pallets · QR hierarchy · QC · lists

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View Packaging', 'pkg.view', 'packaging', 'View packaging and packing operations'),
  ('Manage Packaging', 'pkg.manage', 'packaging', 'Configure materials and rules'),
  ('Packing Operate', 'pkg.operate', 'packaging', 'Execute packing floor operations'),
  ('Packing Approve', 'pkg.approve', 'packaging', 'Approve packing QC and shipments'),
  ('Packaging AI', 'pkg.ai', 'packaging', 'AI packaging assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'pkg.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'production_manager','production_supervisor','warehouse_manager',
    'quality_assurance','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug IN ('pkg.view','pkg.operate','packing.create')
  AND r.slug IN ('production_operator','warehouse_clerk')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND cartons / reams FOR PACKAGING
-- ============================================================
ALTER TABLE cartons
  ADD COLUMN IF NOT EXISTS gross_weight_kg DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS net_weight_kg DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS length_mm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS width_mm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS height_mm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS sealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seal_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS packing_line_id UUID,
  ADD COLUMN IF NOT EXISTS work_order_id UUID,
  ADD COLUMN IF NOT EXISTS pallet_id UUID,
  ADD COLUMN IF NOT EXISTS packaging_status VARCHAR(30) DEFAULT 'packed';

ALTER TABLE reams
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_printed BOOLEAN DEFAULT false;

-- ============================================================
-- MATERIALS · PRODUCT RULES · CARTON SIZES
-- ============================================================
CREATE TABLE IF NOT EXISTS pkg_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'carton',
  -- carton | box | wrap | label | tape | seal | shrink | pallet | protective | other
  uom VARCHAR(20) DEFAULT 'ea',
  weight_kg DECIMAL(12,4) DEFAULT 0,
  length_mm DECIMAL(10,2),
  width_mm DECIMAL(10,2),
  height_mm DECIMAL(10,2),
  unit_cost DECIMAL(14,4) DEFAULT 0,
  supplier_name VARCHAR(150),
  stock_qty DECIMAL(14,2) DEFAULT 0,
  reorder_level DECIMAL(14,2) DEFAULT 50,
  storage_location VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, material_code)
);

CREATE TABLE IF NOT EXISTS pkg_carton_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  size_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  length_mm DECIMAL(10,2) NOT NULL,
  width_mm DECIMAL(10,2) NOT NULL,
  height_mm DECIMAL(10,2) NOT NULL,
  max_weight_kg DECIMAL(12,3) DEFAULT 25,
  max_volume_cm3 DECIMAL(14,2),
  material_id UUID REFERENCES pkg_materials(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, size_code)
);

CREATE TABLE IF NOT EXISTS pkg_product_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  units_per_pack INTEGER DEFAULT 1,
  packs_per_carton INTEGER DEFAULT 5,
  cartons_per_pallet INTEGER DEFAULT 40,
  unit_weight_kg DECIMAL(12,4) DEFAULT 2.5,
  max_carton_weight_kg DECIMAL(12,3) DEFAULT 15,
  max_pallet_height_mm DECIMAL(10,2) DEFAULT 1800,
  default_carton_size_id UUID REFERENCES pkg_carton_sizes(id) ON DELETE SET NULL,
  wrap_material_id UUID REFERENCES pkg_materials(id) ON DELETE SET NULL,
  label_required BOOLEAN DEFAULT true,
  qr_required BOOLEAN DEFAULT true,
  seal_required BOOLEAN DEFAULT true,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pkg_rule_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES pkg_product_rules(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES pkg_materials(id) ON DELETE CASCADE,
  qty_per_unit DECIMAL(12,4) DEFAULT 1,
  stage VARCHAR(40) DEFAULT 'carton'
  -- ream | pack | carton | pallet
);

-- ============================================================
-- LINES · WORK ORDERS · SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pkg_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  warehouse_name VARCHAR(150),
  supervisor_name VARCHAR(150),
  capacity_units_hour INTEGER DEFAULT 200,
  status VARCHAR(30) DEFAULT 'idle',
  -- idle | running | downtime | offline
  current_job_count INTEGER DEFAULT 0,
  efficiency_pct DECIMAL(6,2) DEFAULT 100,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, line_code)
);

CREATE TABLE IF NOT EXISTS pkg_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wo_number VARCHAR(50) NOT NULL,
  source_type VARCHAR(40) DEFAULT 'production',
  -- production | sales | transfer | export | manual
  source_ref VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES production_batches(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES pkg_product_rules(id) ON DELETE SET NULL,
  line_id UUID REFERENCES pkg_lines(id) ON DELETE SET NULL,
  quantity_units INTEGER NOT NULL DEFAULT 0,
  quantity_cartons_planned INTEGER DEFAULT 0,
  quantity_cartons_done INTEGER DEFAULT 0,
  quantity_pallets_planned INTEGER DEFAULT 0,
  quantity_pallets_done INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | released | in_progress | qc | completed | cancelled
  assigned_operators TEXT,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, wo_number)
);

CREATE INDEX IF NOT EXISTS idx_pkg_wo_status ON pkg_work_orders(company_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pkg_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  session_number VARCHAR(50) NOT NULL,
  work_order_id UUID REFERENCES pkg_work_orders(id) ON DELETE SET NULL,
  line_id UUID REFERENCES pkg_lines(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES user_profiles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  units_packed INTEGER DEFAULT 0,
  cartons_built INTEGER DEFAULT 0,
  defects INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  UNIQUE(company_id, session_number)
);

-- ============================================================
-- PALLETS · QC · WEIGHTS · CONSUMPTION
-- ============================================================
CREATE TABLE IF NOT EXISTS pkg_pallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pallet_number VARCHAR(50) NOT NULL,
  qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
  qr_payload TEXT,
  work_order_id UUID REFERENCES pkg_work_orders(id) ON DELETE SET NULL,
  line_id UUID REFERENCES pkg_lines(id) ON DELETE SET NULL,
  pallet_type VARCHAR(40) DEFAULT 'wooden',
  -- wooden | plastic | export
  carton_count INTEGER DEFAULT 0,
  max_cartons INTEGER DEFAULT 40,
  gross_weight_kg DECIMAL(12,3) DEFAULT 0,
  net_weight_kg DECIMAL(12,3) DEFAULT 0,
  height_mm DECIMAL(10,2),
  warehouse_location VARCHAR(100),
  status VARCHAR(30) DEFAULT 'building',
  -- building | complete | stored | dispatched
  built_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, pallet_number)
);

CREATE TABLE IF NOT EXISTS pkg_pallet_cartons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pallet_id UUID NOT NULL REFERENCES pkg_pallets(id) ON DELETE CASCADE,
  carton_id UUID REFERENCES cartons(id) ON DELETE SET NULL,
  carton_serial VARCHAR(50) NOT NULL,
  position_no INTEGER DEFAULT 1,
  stacked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pallet_id, carton_serial)
);

-- Link cartons.pallet_id conceptually (UUID without FK to avoid circular migration issues)
-- Already added pallet_id column above

CREATE TABLE IF NOT EXISTS pkg_qc_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_number VARCHAR(50) NOT NULL,
  work_order_id UUID REFERENCES pkg_work_orders(id) ON DELETE SET NULL,
  entity_type VARCHAR(40) NOT NULL DEFAULT 'carton',
  -- ream | carton | pallet
  entity_serial VARCHAR(80),
  carton_id UUID REFERENCES cartons(id) ON DELETE SET NULL,
  pallet_id UUID REFERENCES pkg_pallets(id) ON DELETE SET NULL,
  product_ok BOOLEAN DEFAULT true,
  quantity_ok BOOLEAN DEFAULT true,
  packaging_ok BOOLEAN DEFAULT true,
  label_ok BOOLEAN DEFAULT true,
  qr_ok BOOLEAN DEFAULT true,
  weight_ok BOOLEAN DEFAULT true,
  seal_ok BOOLEAN DEFAULT true,
  overall_status VARCHAR(30) DEFAULT 'pass',
  -- pass | fail | hold
  defect_reason TEXT,
  checked_by UUID REFERENCES user_profiles(id),
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, check_number)
);

CREATE TABLE IF NOT EXISTS pkg_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(40) NOT NULL DEFAULT 'carton',
  entity_serial VARCHAR(80) NOT NULL,
  carton_id UUID REFERENCES cartons(id) ON DELETE SET NULL,
  pallet_id UUID REFERENCES pkg_pallets(id) ON DELETE SET NULL,
  net_weight_kg DECIMAL(12,3),
  tare_weight_kg DECIMAL(12,3),
  gross_weight_kg DECIMAL(12,3),
  length_mm DECIMAL(10,2),
  width_mm DECIMAL(10,2),
  height_mm DECIMAL(10,2),
  volume_cm3 DECIMAL(14,2),
  scale_device VARCHAR(100),
  status VARCHAR(30) DEFAULT 'ok',
  -- ok | underweight | overweight | dimension_error
  recorded_by UUID REFERENCES user_profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pkg_material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  issue_number VARCHAR(50) NOT NULL,
  work_order_id UUID REFERENCES pkg_work_orders(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES pkg_materials(id) ON DELETE CASCADE,
  qty DECIMAL(14,4) NOT NULL,
  unit_cost DECIMAL(14,4) DEFAULT 0,
  total_cost DECIMAL(14,4) DEFAULT 0,
  issued_by UUID REFERENCES user_profiles(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, issue_number)
);

CREATE TABLE IF NOT EXISTS pkg_packing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  list_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  order_ref VARCHAR(100),
  work_order_id UUID REFERENCES pkg_work_orders(id) ON DELETE SET NULL,
  carton_count INTEGER DEFAULT 0,
  pallet_count INTEGER DEFAULT 0,
  gross_weight_kg DECIMAL(12,3) DEFAULT 0,
  net_weight_kg DECIMAL(12,3) DEFAULT 0,
  html_body TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | issued | shipped
  issued_by UUID REFERENCES user_profiles(id),
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, list_number)
);

CREATE TABLE IF NOT EXISTS pkg_ai_insights (
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

CREATE TABLE IF NOT EXISTS pkg_audit (
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
    'pkg_materials','pkg_carton_sizes','pkg_product_rules','pkg_rule_materials',
    'pkg_lines','pkg_work_orders','pkg_sessions','pkg_pallets','pkg_pallet_cartons',
    'pkg_qc_checks','pkg_weights','pkg_material_issues','pkg_packing_lists',
    'pkg_ai_insights','pkg_audit'
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
-- SEED — Hope Paper packaging
-- ============================================================
DO $$
DECLARE
  cid UUID;
  mid_box UUID;
  mid_wrap UUID;
  mid_label UUID;
  mid_tape UUID;
  mid_seal UUID;
  mid_pallet UUID;
  size_id UUID;
  v_rule_id UUID;
  line1 UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO pkg_materials (company_id, material_code, name, category, uom, weight_kg, length_mm, width_mm, height_mm, unit_cost, stock_qty, reorder_level, storage_location)
  VALUES
    (cid, 'PKG-BOX-A4', 'A4 Carton Box (5 reams)', 'carton', 'ea', 0.45, 320, 240, 280, 1200, 5000, 500, 'PKG-A1'),
    (cid, 'PKG-WRAP-CLR', 'Clear Plastic Ream Wrap', 'wrap', 'roll', 0.02, NULL, NULL, NULL, 50, 200, 30, 'PKG-A2'),
    (cid, 'PKG-LBL-REAM', 'Ream QR Label 50×30', 'label', 'ea', 0.001, 50, 30, NULL, 15, 50000, 5000, 'PKG-L1'),
    (cid, 'PKG-LBL-CTN', 'Carton Master Label', 'label', 'ea', 0.002, 100, 50, NULL, 25, 20000, 2000, 'PKG-L1'),
    (cid, 'PKG-TAPE-48', 'Packing Tape 48mm', 'tape', 'roll', 0.15, NULL, NULL, NULL, 800, 300, 40, 'PKG-A3'),
    (cid, 'PKG-SEAL-SEC', 'Security Tamper Seal', 'seal', 'ea', 0.005, NULL, NULL, NULL, 100, 10000, 1000, 'PKG-S1'),
    (cid, 'PKG-SHRINK', 'Shrink Wrap Film', 'shrink', 'roll', 2.5, NULL, NULL, NULL, 15000, 40, 10, 'PKG-A4'),
    (cid, 'PKG-PAL-WD', 'Wooden Export Pallet', 'pallet', 'ea', 18, 1200, 1000, 144, 25000, 200, 30, 'WH-PAL')
  ON CONFLICT (company_id, material_code) DO NOTHING;

  SELECT id INTO mid_box FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-BOX-A4';
  SELECT id INTO mid_wrap FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-WRAP-CLR';
  SELECT id INTO mid_label FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-LBL-REAM';
  SELECT id INTO mid_tape FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-TAPE-48';
  SELECT id INTO mid_seal FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-SEAL-SEC';
  SELECT id INTO mid_pallet FROM pkg_materials WHERE company_id = cid AND material_code = 'PKG-PAL-WD';

  INSERT INTO pkg_carton_sizes (company_id, size_code, name, length_mm, width_mm, height_mm, max_weight_kg, max_volume_cm3, material_id)
  VALUES
    (cid, 'CTN-A4-5', 'A4 5-Ream Carton', 320, 240, 280, 15, 21504, mid_box),
    (cid, 'CTN-MED', 'Medium Mixed Carton', 400, 300, 300, 20, 36000, mid_box),
    (cid, 'CTN-LG', 'Large Export Carton', 500, 400, 400, 30, 80000, mid_box)
  ON CONFLICT (company_id, size_code) DO NOTHING;

  SELECT id INTO size_id FROM pkg_carton_sizes WHERE company_id = cid AND size_code = 'CTN-A4-5';

  INSERT INTO pkg_product_rules (
    company_id, product_code, product_name, units_per_pack, packs_per_carton, cartons_per_pallet,
    unit_weight_kg, max_carton_weight_kg, max_pallet_height_mm, default_carton_size_id,
    wrap_material_id, label_required, qr_required, seal_required, instructions
  ) VALUES (
    cid, 'HDG-PPR-A4', 'Premium A4 Copy Paper',
    1, 5, 40,
    2.5, 14, 1800, size_id,
    mid_wrap, true, true, true,
    E'1. Wrap each ream in clear plastic\n2. Apply ream QR label\n3. Place 5 reams in carton\n4. Seal carton with tape + security seal\n5. Apply carton master QR\n6. Stack 40 cartons per pallet\n7. Apply pallet master QR'
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_rule_id FROM pkg_product_rules WHERE company_id = cid AND product_code = 'HDG-PPR-A4' LIMIT 1;

  IF v_rule_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pkg_rule_materials prm WHERE prm.rule_id = v_rule_id) THEN
    INSERT INTO pkg_rule_materials (company_id, rule_id, material_id, qty_per_unit, stage)
    VALUES
      (cid, v_rule_id, mid_wrap, 1, 'ream'),
      (cid, v_rule_id, mid_label, 1, 'ream'),
      (cid, v_rule_id, mid_box, 1, 'carton'),
      (cid, v_rule_id, mid_tape, 0.2, 'carton'),
      (cid, v_rule_id, mid_seal, 1, 'carton'),
      (cid, v_rule_id, mid_pallet, 0.025, 'pallet');
  END IF;

  INSERT INTO pkg_lines (company_id, line_code, name, warehouse_name, supervisor_name, capacity_units_hour, status, efficiency_pct)
  VALUES
    (cid, 'PL-01', 'Packing Line 1 — A4 Paper', 'Main Warehouse', 'Ops Supervisor', 300, 'idle', 98),
    (cid, 'PL-02', 'Packing Line 2 — Export', 'Main Warehouse', 'Export Lead', 200, 'idle', 95),
    (cid, 'PL-03', 'Packing Line 3 — Mixed', 'Dispatch Dock', 'Dock Supervisor', 150, 'idle', 92)
  ON CONFLICT (company_id, line_code) DO NOTHING;

  SELECT id INTO line1 FROM pkg_lines WHERE company_id = cid AND line_code = 'PL-01';

  INSERT INTO pkg_work_orders (
    company_id, wo_number, source_type, source_ref, product_name, product_code,
    rule_id, line_id, quantity_units, quantity_cartons_planned, quantity_pallets_planned,
    priority, due_date, status, assigned_operators, notes
  )
  SELECT cid, 'PWO-SEED-001', 'production', 'BATCH-DEMO', 'Premium A4 Copy Paper', 'HDG-PPR-A4',
    v_rule_id, line1, 500, 100, 3, 3, CURRENT_DATE + 2, 'released',
    'Packing Team A', 'Seed work order — 500 reams → 100 cartons → 3 pallets (40+40+20)'
  WHERE NOT EXISTS (SELECT 1 FROM pkg_work_orders WHERE company_id = cid AND wo_number = 'PWO-SEED-001');

END $$;
