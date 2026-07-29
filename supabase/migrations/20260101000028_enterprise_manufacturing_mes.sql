-- Hope Design Group — Advanced Manufacturing / MES
-- BOM · Routing · Work centers · Production orders · Shop floor · OEE · Quality · Costing

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View MES', 'mes.view', 'manufacturing', 'View production MES'),
  ('Manage MES', 'mes.manage', 'manufacturing', 'Manage manufacturing master data'),
  ('Shop Floor', 'mes.shopfloor', 'manufacturing', 'Operator shop floor execution'),
  ('Production Planning', 'mes.planning', 'manufacturing', 'MPS MRP capacity planning'),
  ('Quality MES', 'mes.quality', 'manufacturing', 'In-process and final QC'),
  ('MES Costing', 'mes.costing', 'manufacturing', 'Production costing'),
  ('MES Maintenance', 'mes.maintenance', 'manufacturing', 'Machine maintenance link')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.slug LIKE 'mes.%'
  AND r.slug IN (
    'super_administrator','managing_director','operations_manager',
    'production_manager','production_supervisor','quality_assurance','auditor'
  )
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- ============================================================
-- EXTEND PRODUCTS (manufacturing fields)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(40) DEFAULT 'finished_good',
  -- finished_good | semi_finished | raw_material | packaging | consumable | spare | by_product | scrap
  ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER,
  ADD COLUMN IF NOT EXISTS storage_requirements TEXT,
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS dimensions TEXT,
  ADD COLUMN IF NOT EXISTS quality_requirements TEXT,
  ADD COLUMN IF NOT EXISTS regulatory_info TEXT,
  ADD COLUMN IF NOT EXISTS standard_cost DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS lot_tracked BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS serial_tracked BOOLEAN DEFAULT false;

-- Extend BOM headers
ALTER TABLE bom_headers
  ADD COLUMN IF NOT EXISTS bom_type VARCHAR(40) DEFAULT 'manufacturing',
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS yield_pct DECIMAL(6,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS scrap_pct DECIMAL(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_cost DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS routing_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_note TEXT;

ALTER TABLE bom_lines
  ADD COLUMN IF NOT EXISTS is_alternative BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS substitute_group VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level_no INTEGER DEFAULT 1;

-- Extend machines
ALTER TABLE production_machines
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150),
  ADD COLUMN IF NOT EXISTS model VARCHAR(100),
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS installed_at DATE,
  ADD COLUMN IF NOT EXISTS warranty_until DATE,
  ADD COLUMN IF NOT EXISTS operating_hours DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_kwh DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'idle',
  -- running | idle | breakdown | maintenance | offline
  ADD COLUMN IF NOT EXISTS efficiency_pct DECIMAL(5,2) DEFAULT 85,
  ADD COLUMN IF NOT EXISTS cost_rate_per_hour DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_maintenance_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_center_id UUID;

-- ============================================================
-- WORK CENTERS & ROUTING
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  center_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  location_name VARCHAR(150),
  capacity_per_hour DECIMAL(14,2) DEFAULT 0,
  availability_pct DECIMAL(5,2) DEFAULT 100,
  cost_rate_per_hour DECIMAL(14,2) DEFAULT 0,
  efficiency_pct DECIMAL(5,2) DEFAULT 90,
  shift_pattern VARCHAR(50) DEFAULT '3x8',
  status VARCHAR(30) DEFAULT 'available',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, center_code)
);

CREATE TABLE IF NOT EXISTS mes_routings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  routing_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  product_id UUID REFERENCES products(id),
  version INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, routing_code, version)
);

CREATE TABLE IF NOT EXISTS mes_routing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  routing_id UUID NOT NULL REFERENCES mes_routings(id) ON DELETE CASCADE,
  operation_no INTEGER NOT NULL DEFAULT 10,
  name VARCHAR(150) NOT NULL,
  work_center_id UUID REFERENCES mes_work_centers(id),
  machine_id UUID REFERENCES production_machines(id),
  setup_minutes DECIMAL(10,2) DEFAULT 0,
  run_minutes_per_unit DECIMAL(12,4) DEFAULT 0,
  wait_minutes DECIMAL(10,2) DEFAULT 0,
  skills_required TEXT,
  tools_required TEXT,
  instructions TEXT,
  safety_procedures TEXT,
  inspection_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link bom routing if column added
DO $$ BEGIN
  ALTER TABLE bom_headers
    ADD CONSTRAINT bom_headers_routing_fk
    FOREIGN KEY (routing_id) REFERENCES mes_routings(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE production_machines
    ADD CONSTRAINT production_machines_wc_fk
    FOREIGN KEY (work_center_id) REFERENCES mes_work_centers(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- PRODUCTION / WORK ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL,
  order_type VARCHAR(40) DEFAULT 'manufacturing',
  -- manufacturing | rework | repair | trial | planned
  product_id UUID REFERENCES products(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity_planned DECIMAL(18,4) NOT NULL DEFAULT 0,
  quantity_completed DECIMAL(18,4) DEFAULT 0,
  quantity_scrap DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'REAM',
  batch_number VARCHAR(100),
  bom_id UUID REFERENCES bom_headers(id),
  routing_id UUID REFERENCES mes_routings(id),
  work_center_id UUID REFERENCES mes_work_centers(id),
  machine_id UUID REFERENCES production_machines(id),
  priority INTEGER DEFAULT 5,
  status VARCHAR(30) DEFAULT 'planned',
  -- planned | released | in_progress | paused | qc | completed | cancelled | closed
  planned_start TIMESTAMPTZ,
  planned_finish TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_finish TIMESTAMPTZ,
  shift VARCHAR(30),
  operator_id UUID REFERENCES user_profiles(id),
  supervisor_id UUID REFERENCES user_profiles(id),
  sales_order_id UUID,
  notes TEXT,
  total_cost DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,4) DEFAULT 0,
  oee_pct DECIMAL(5,2),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_mes_po_status ON mes_production_orders(company_id, status);

CREATE TABLE IF NOT EXISTS mes_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES mes_production_orders(id) ON DELETE CASCADE,
  work_order_number VARCHAR(50) NOT NULL,
  operation_no INTEGER DEFAULT 10,
  operation_name VARCHAR(150),
  work_center_id UUID REFERENCES mes_work_centers(id),
  machine_id UUID REFERENCES production_machines(id),
  operator_id UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | ready | running | paused | completed | skipped
  planned_qty DECIMAL(18,4) DEFAULT 0,
  completed_qty DECIMAL(18,4) DEFAULT 0,
  scrap_qty DECIMAL(18,4) DEFAULT 0,
  setup_minutes DECIMAL(10,2) DEFAULT 0,
  run_minutes DECIMAL(12,2) DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  downtime_minutes DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, work_order_number)
);

CREATE TABLE IF NOT EXISTS mes_shop_floor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES mes_production_orders(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES mes_work_orders(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES production_machines(id),
  event_type VARCHAR(40) NOT NULL,
  -- start | pause | resume | complete | downtime | scrap | material_request | issue | photo
  quantity DECIMAL(18,4),
  reason_code VARCHAR(50),
  message TEXT,
  operator_id UUID REFERENCES user_profiles(id),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mes_material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES mes_production_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  component_code VARCHAR(100),
  component_name VARCHAR(255),
  planned_qty DECIMAL(18,4) DEFAULT 0,
  issued_qty DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'EA',
  issue_method VARCHAR(30) DEFAULT 'manual',
  -- backflush | manual | barcode
  warehouse_name VARCHAR(100),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  issued_by UUID REFERENCES user_profiles(id)
);

CREATE TABLE IF NOT EXISTS mes_downtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES production_machines(id),
  production_order_id UUID REFERENCES mes_production_orders(id),
  reason_code VARCHAR(50) NOT NULL,
  reason_label VARCHAR(150),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  minutes DECIMAL(10,2),
  notes TEXT,
  reported_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OEE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_oee_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES production_machines(id),
  work_center_id UUID REFERENCES mes_work_centers(id),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift VARCHAR(30),
  availability_pct DECIMAL(6,2) DEFAULT 0,
  performance_pct DECIMAL(6,2) DEFAULT 0,
  quality_pct DECIMAL(6,2) DEFAULT 0,
  oee_pct DECIMAL(6,2) DEFAULT 0,
  planned_minutes DECIMAL(10,2) DEFAULT 480,
  run_minutes DECIMAL(10,2) DEFAULT 0,
  downtime_minutes DECIMAL(10,2) DEFAULT 0,
  good_qty DECIMAL(18,4) DEFAULT 0,
  scrap_qty DECIMAL(18,4) DEFAULT 0,
  ideal_cycle_sec DECIMAL(10,2) DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUALITY
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_quality_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  product_id UUID REFERENCES products(id),
  inspection_type VARCHAR(40) DEFAULT 'final',
  -- incoming | in_process | final | random | laboratory
  parameters JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

CREATE TABLE IF NOT EXISTS mes_quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_number VARCHAR(50) NOT NULL,
  production_order_id UUID REFERENCES mes_production_orders(id),
  product_id UUID REFERENCES products(id),
  plan_id UUID REFERENCES mes_quality_plans(id),
  inspection_type VARCHAR(40) DEFAULT 'final',
  status VARCHAR(30) DEFAULT 'pending',
  -- pending | in_progress | passed | failed | conditional
  result_json JSONB DEFAULT '{}'::jsonb,
  sample_size INTEGER DEFAULT 0,
  defects INTEGER DEFAULT 0,
  inspector_id UUID REFERENCES user_profiles(id),
  inspected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, inspection_number)
);

CREATE TABLE IF NOT EXISTS mes_ncr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ncr_number VARCHAR(50) NOT NULL,
  production_order_id UUID REFERENCES mes_production_orders(id),
  inspection_id UUID REFERENCES mes_quality_inspections(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open',
  -- open | capa | closed
  corrective_action TEXT,
  preventive_action TEXT,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, ncr_number)
);

-- ============================================================
-- TRACEABILITY & PACKAGING
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_genealogy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES mes_production_orders(id),
  batch_number VARCHAR(100),
  parent_batch VARCHAR(100),
  material_batch VARCHAR(100),
  machine_code VARCHAR(50),
  operator_name VARCHAR(150),
  product_code VARCHAR(100),
  qr_public_id VARCHAR(100),
  stage VARCHAR(50),
  -- raw | wip | finished | packed | warehouse | dispatch
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS mes_packaging_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES mes_production_orders(id),
  unit_type VARCHAR(30) DEFAULT 'ream',
  -- ream | box | pallet | container
  unit_code VARCHAR(80) NOT NULL,
  parent_unit_id UUID REFERENCES mes_packaging_units(id),
  qr_code VARCHAR(100),
  quantity DECIMAL(14,4) DEFAULT 1,
  status VARCHAR(30) DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, unit_code)
);

-- ============================================================
-- COSTING
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_cost_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES mes_production_orders(id) ON DELETE CASCADE,
  cost_type VARCHAR(40) NOT NULL,
  -- material | labor | machine | energy | maintenance | overhead | packaging | waste
  amount DECIMAL(18,4) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_maintenance_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mo_number VARCHAR(50) NOT NULL,
  machine_id UUID REFERENCES production_machines(id),
  maintenance_type VARCHAR(40) DEFAULT 'preventive',
  -- preventive | corrective | predictive | calibration
  status VARCHAR(30) DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  technician_name VARCHAR(150),
  spare_parts TEXT,
  downtime_minutes DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, mo_number)
);

-- ============================================================
-- PLANNING (MPS lite)
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_mps_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_code VARCHAR(100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  demand_qty DECIMAL(18,4) DEFAULT 0,
  planned_qty DECIMAL(18,4) DEFAULT 0,
  available_qty DECIMAL(18,4) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mes_mrp_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  component_code VARCHAR(100),
  component_name VARCHAR(255),
  required_qty DECIMAL(18,4) DEFAULT 0,
  on_hand_qty DECIMAL(18,4) DEFAULT 0,
  shortage_qty DECIMAL(18,4) DEFAULT 0,
  suggestion VARCHAR(40) DEFAULT 'purchase',
  -- purchase | produce | transfer
  due_date DATE,
  source_order VARCHAR(50),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mes_work_centers','mes_routings','mes_routing_operations',
    'mes_production_orders','mes_work_orders','mes_shop_floor_events',
    'mes_material_issues','mes_downtime','mes_oee_snapshots',
    'mes_quality_plans','mes_quality_inspections','mes_ncr',
    'mes_genealogy','mes_packaging_units','mes_cost_layers',
    'mes_maintenance_orders','mes_mps_lines','mes_mrp_suggestions'
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
-- SEED Hope Design paper production
-- ============================================================
DO $$
DECLARE
  cid UUID;
  pid UUID;
  wc_prep UUID; wc_form UUID; wc_cut UUID; wc_pack UUID; wc_qc UUID;
  rt UUID;
  bom UUID;
  mid1 UUID; mid2 UUID;
BEGIN
  SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RETURN; END IF;

  SELECT id INTO pid FROM products WHERE company_id = cid ORDER BY created_at LIMIT 1;

  INSERT INTO mes_work_centers (company_id, center_code, name, location_name, capacity_per_hour, cost_rate_per_hour, status)
  VALUES
    (cid, 'WC-PREP', 'Raw Material Preparation', 'Factory Floor A', 50, 25000, 'available'),
    (cid, 'WC-FORM', 'Paper Formation / FSS Line', 'Factory Floor A', 40, 80000, 'available'),
    (cid, 'WC-CUT', 'Cutting Section', 'Factory Floor B', 60, 35000, 'available'),
    (cid, 'WC-PACK', 'Packaging Section', 'Packing Hall', 80, 20000, 'available'),
    (cid, 'WC-QC', 'Quality Control', 'QC Lab', 30, 15000, 'available')
  ON CONFLICT (company_id, center_code) DO NOTHING;

  SELECT id INTO wc_prep FROM mes_work_centers WHERE company_id = cid AND center_code = 'WC-PREP';
  SELECT id INTO wc_form FROM mes_work_centers WHERE company_id = cid AND center_code = 'WC-FORM';
  SELECT id INTO wc_cut FROM mes_work_centers WHERE company_id = cid AND center_code = 'WC-CUT';
  SELECT id INTO wc_pack FROM mes_work_centers WHERE company_id = cid AND center_code = 'WC-PACK';
  SELECT id INTO wc_qc FROM mes_work_centers WHERE company_id = cid AND center_code = 'WC-QC';

  -- Ensure company_id on machines if possible
  UPDATE production_machines SET company_id = cid WHERE company_id IS NULL;

  SELECT id INTO mid1 FROM production_machines ORDER BY created_at LIMIT 1;
  SELECT id INTO mid2 FROM production_machines ORDER BY created_at OFFSET 1 LIMIT 1;

  IF mid1 IS NOT NULL THEN
    UPDATE production_machines SET
      manufacturer = COALESCE(manufacturer, 'Hope Design OEM'),
      model = COALESCE(model, 'FSS104'),
      status = COALESCE(status, 'idle'),
      work_center_id = wc_form,
      cost_rate_per_hour = COALESCE(cost_rate_per_hour, 75000)
    WHERE id = mid1;
  END IF;
  IF mid2 IS NOT NULL THEN
    UPDATE production_machines SET
      manufacturer = COALESCE(manufacturer, 'Hope Design OEM'),
      model = COALESCE(model, 'FSS300'),
      status = COALESCE(status, 'idle'),
      work_center_id = wc_form,
      cost_rate_per_hour = COALESCE(cost_rate_per_hour, 95000)
    WHERE id = mid2;
  END IF;

  INSERT INTO mes_routings (company_id, routing_code, name, product_id, version, status, description)
  VALUES (cid, 'RT-A4-STD', 'A4 Copy Paper Standard Route', pid, 1, 'active',
    'Prep → Formation → Drying → Cutting → Packaging → QC → Warehouse')
  ON CONFLICT (company_id, routing_code, version) DO NOTHING
  RETURNING id INTO rt;

  IF rt IS NULL THEN
    SELECT id INTO rt FROM mes_routings WHERE company_id = cid AND routing_code = 'RT-A4-STD' LIMIT 1;
  END IF;

  IF rt IS NOT NULL AND NOT EXISTS (SELECT 1 FROM mes_routing_operations WHERE routing_id = rt) THEN
    INSERT INTO mes_routing_operations (
      company_id, routing_id, operation_no, name, work_center_id, machine_id,
      setup_minutes, run_minutes_per_unit, inspection_required, instructions, safety_procedures
    ) VALUES
      (cid, rt, 10, 'Raw Material Preparation', wc_prep, NULL, 30, 0.5, false, 'Prepare pulp and chemicals per formula', 'PPE required'),
      (cid, rt, 20, 'Mixing & Paper Formation', wc_form, mid1, 45, 1.2, true, 'Run FSS line at target GSM', 'Lockout/tagout on jams'),
      (cid, rt, 30, 'Drying', wc_form, mid1, 10, 0.8, false, 'Maintain dryer temperature profile', 'Hot surface hazard'),
      (cid, rt, 40, 'Cutting', wc_cut, NULL, 15, 0.4, true, 'Cut to A4; check dimensions', 'Blade safety'),
      (cid, rt, 50, 'Packaging', wc_pack, NULL, 20, 0.3, false, '5 reams per carton; apply QR labels', 'Manual handling'),
      (cid, rt, 60, 'Quality Inspection', wc_qc, NULL, 10, 0.2, true, 'Final QC sampling plan', 'Lab PPE');
  END IF;

  -- Sample BOM if product exists and no BOM
  IF pid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bom_headers WHERE company_id = cid AND product_id = pid) THEN
    INSERT INTO bom_headers (
      company_id, bom_code, product_id, version, is_active, description,
      bom_type, status, yield_pct, scrap_pct, effective_from, routing_id, total_cost
    ) VALUES (
      cid, 'BOM-A4-001', pid, 1, true, 'Premium A4 Copy Paper manufacturing BOM',
      'manufacturing', 'active', 97, 3, CURRENT_DATE, rt, 0
    ) RETURNING id INTO bom;

    INSERT INTO bom_lines (bom_id, company_id, component_description, quantity_per, uom, scrap_pct, line_number, unit_cost, level_no)
    VALUES
      (bom, cid, 'Wood Pulp', 0.85, 'KG', 2, 10, 2500, 1),
      (bom, cid, 'Process Chemicals', 0.05, 'KG', 1, 20, 8000, 1),
      (bom, cid, 'Process Water', 2.5, 'L', 0, 30, 50, 1),
      (bom, cid, 'Dyes / Whitener', 0.01, 'KG', 5, 40, 15000, 1),
      (bom, cid, 'Paper Cover / Wrap', 1, 'EA', 1, 50, 200, 1),
      (bom, cid, 'Carton Box', 0.2, 'EA', 1, 60, 1500, 1),
      (bom, cid, 'Labels', 1, 'EA', 2, 70, 50, 1),
      (bom, cid, 'QR Stickers', 1, 'EA', 3, 80, 100, 1);
  END IF;

  INSERT INTO mes_quality_plans (company_id, plan_code, name, product_id, inspection_type, parameters)
  VALUES
    (cid, 'QC-INCOMING', 'Incoming Raw Material QC', NULL, 'incoming',
     '[{"param":"moisture","min":5,"max":12,"unit":"%"},{"param":"purity","min":95,"max":100,"unit":"%"}]'::jsonb),
    (cid, 'QC-INPROC', 'In-process GSM / Formation', pid, 'in_process',
     '[{"param":"gsm","min":78,"max":82,"unit":"g/m2"},{"param":"moisture","min":4,"max":7,"unit":"%"}]'::jsonb),
    (cid, 'QC-FINAL', 'Final A4 Paper Inspection', pid, 'final',
     '[{"param":"whiteness","min":90,"max":100,"unit":"%"},{"param":"dimensions","target":"210x297","unit":"mm"},{"param":"defects","max":2,"unit":"count"}]'::jsonb)
  ON CONFLICT (company_id, plan_code) DO NOTHING;

  -- Sample MPS / OEE seed
  INSERT INTO mes_mps_lines (company_id, product_id, product_code, period_start, period_end, demand_qty, planned_qty, available_qty, status)
  SELECT cid, pid, COALESCE(p.product_code, 'A4'), CURRENT_DATE, CURRENT_DATE + 7, 5000, 5200, 800, 'released'
  FROM products p WHERE p.id = pid
  AND NOT EXISTS (SELECT 1 FROM mes_mps_lines m WHERE m.company_id = cid AND m.product_id = pid);

  IF mid1 IS NOT NULL THEN
    INSERT INTO mes_oee_snapshots (
      company_id, machine_id, work_center_id, snapshot_date, shift,
      availability_pct, performance_pct, quality_pct, oee_pct,
      planned_minutes, run_minutes, downtime_minutes, good_qty, scrap_qty
    )
    SELECT cid, mid1, wc_form, CURRENT_DATE, 'morning', 92, 88, 97,
      ROUND((92 * 88 * 97 / 10000.0)::numeric, 2),
      480, 420, 35, 950, 25
    WHERE NOT EXISTS (
      SELECT 1 FROM mes_oee_snapshots o WHERE o.company_id = cid AND o.machine_id = mid1 AND o.snapshot_date = CURRENT_DATE
    );
  END IF;

END $$;
