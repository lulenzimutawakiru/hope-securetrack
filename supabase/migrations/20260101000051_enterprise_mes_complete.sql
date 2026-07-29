-- Hope SecureTrack ERP — Complete Manufacturing Execution System (MES)
-- Fills gaps for full CRUD production platform: plans, lines, jobs, waste,
-- packaging, serials, energy, attachments, audit, soft-delete extensions

-- ============================================================
-- EXTEND CORE MES TABLES
-- ============================================================
ALTER TABLE mes_production_orders
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS factory_id UUID,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sales_order_ref VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS qr_payload TEXT,
  ADD COLUMN IF NOT EXISTS barcode_value VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE mes_work_centers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS factory_id UUID,
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;

ALTER TABLE mes_routings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';

ALTER TABLE mes_work_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE mes_ncr
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(id);

ALTER TABLE mes_quality_inspections
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE mes_maintenance_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE mes_downtime
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE production_machines
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150),
  ADD COLUMN IF NOT EXISTS model VARCHAR(150),
  ADD COLUMN IF NOT EXISTS install_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_end DATE,
  ADD COLUMN IF NOT EXISTS energy_kwh DECIMAL(14,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_tag VARCHAR(120),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1;

-- ============================================================
-- PRODUCTION PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_number VARCHAR(50) NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  planning_period VARCHAR(40) DEFAULT 'weekly',
  -- daily | weekly | monthly | quarterly | annual
  factory_name VARCHAR(150),
  production_line VARCHAR(150),
  priority INTEGER DEFAULT 5,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | approved | scheduled | in_progress | completed | cancelled
  period_start DATE,
  period_end DATE,
  product_summary TEXT,
  forecast_qty DECIMAL(18,4) DEFAULT 0,
  capacity_hours DECIMAL(12,2) DEFAULT 0,
  expected_completion DATE,
  notes TEXT,
  ai_suggestions JSONB DEFAULT '[]'::jsonb,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  version_no INTEGER DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_number)
);

CREATE TABLE IF NOT EXISTS mes_production_plan_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES mes_production_plans(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'REAM',
  due_date DATE,
  priority INTEGER DEFAULT 5,
  production_order_id UUID REFERENCES mes_production_orders(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTION LINES & MACHINE GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  factory_name VARCHAR(150),
  supervisor_name VARCHAR(150),
  capacity_units_hour DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'idle',
  -- idle | running | maintenance | offline
  efficiency_pct DECIMAL(5,2) DEFAULT 100,
  work_center_id UUID REFERENCES mes_work_centers(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, line_code)
);

CREATE TABLE IF NOT EXISTS mes_machine_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, group_code)
);

-- ============================================================
-- SHIFTS & OPERATORS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shift_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, shift_code)
);

CREATE TABLE IF NOT EXISTS mes_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operator_code VARCHAR(50) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  employee_id UUID REFERENCES employees(id),
  user_id UUID REFERENCES user_profiles(id),
  skill_level VARCHAR(40) DEFAULT 'standard',
  shift_code VARCHAR(50),
  work_center_id UUID REFERENCES mes_work_centers(id),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, operator_code)
);

CREATE TABLE IF NOT EXISTS mes_job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  production_order_id UUID REFERENCES mes_production_orders(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES mes_work_orders(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES mes_operators(id),
  machine_id UUID REFERENCES production_machines(id),
  status VARCHAR(30) DEFAULT 'open',
  -- open | running | paused | completed | cancelled
  qty_target DECIMAL(18,4) DEFAULT 0,
  qty_done DECIMAL(18,4) DEFAULT 0,
  qty_scrap DECIMAL(18,4) DEFAULT 0,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  instructions TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, job_number)
);

-- ============================================================
-- WASTE, REWORK, CONSUMABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  waste_number VARCHAR(50) NOT NULL,
  production_order_id UUID REFERENCES mes_production_orders(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'KG',
  reason_code VARCHAR(50),
  reason_text TEXT,
  cost_amount DECIMAL(18,4) DEFAULT 0,
  recorded_by UUID REFERENCES user_profiles(id),
  status VARCHAR(30) DEFAULT 'recorded',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, waste_number)
);

CREATE TABLE IF NOT EXISTS mes_rework_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rework_number VARCHAR(50) NOT NULL,
  source_order_id UUID REFERENCES mes_production_orders(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity DECIMAL(18,4) DEFAULT 0,
  reason TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  -- draft | approved | in_progress | completed | cancelled
  assigned_machine_id UUID REFERENCES production_machines(id),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rework_number)
);

CREATE TABLE IF NOT EXISTS mes_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(80) DEFAULT 'general',
  uom VARCHAR(30) DEFAULT 'EA',
  stock_qty DECIMAL(18,4) DEFAULT 0,
  reorder_point DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, item_code)
);

-- ============================================================
-- PACKAGING ORDERS & LABELS / SERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_packaging_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  packaging_number VARCHAR(50) NOT NULL,
  production_order_id UUID REFERENCES mes_production_orders(id),
  product_code VARCHAR(100),
  product_name VARCHAR(255),
  quantity_units DECIMAL(18,4) DEFAULT 0,
  quantity_cartons DECIMAL(18,4) DEFAULT 0,
  quantity_pallets DECIMAL(18,4) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'draft',
  packaging_line VARCHAR(100),
  scheduled_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, packaging_number)
);

CREATE TABLE IF NOT EXISTS mes_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label_number VARCHAR(50) NOT NULL,
  label_type VARCHAR(40) DEFAULT 'product',
  -- product | carton | pallet | shipment | security
  production_order_id UUID REFERENCES mes_production_orders(id),
  batch_number VARCHAR(100),
  qr_payload TEXT,
  barcode_value VARCHAR(100),
  serial_number VARCHAR(100),
  print_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'ready',
  printed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, label_number)
);

CREATE TABLE IF NOT EXISTS mes_serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  serial_value VARCHAR(120) NOT NULL,
  serial_type VARCHAR(40) DEFAULT 'unit',
  -- unit | carton | pallet | shipment
  production_order_id UUID REFERENCES mes_production_orders(id),
  batch_number VARCHAR(100),
  product_code VARCHAR(100),
  parent_serial_id UUID REFERENCES mes_serial_numbers(id),
  qr_payload TEXT,
  status VARCHAR(30) DEFAULT 'active',
  -- active | shipped | recalled | void
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, serial_value)
);

-- ============================================================
-- ENERGY / UTILITIES / IoT
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES production_machines(id),
  reading_type VARCHAR(40) DEFAULT 'electricity',
  -- electricity | water | gas | compressed_air
  value_amount DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'kWh',
  reading_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mes_iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  device_code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  device_type VARCHAR(50) DEFAULT 'sensor',
  machine_id UUID REFERENCES production_machines(id),
  protocol VARCHAR(40) DEFAULT 'mqtt',
  status VARCHAR(30) DEFAULT 'online',
  last_seen_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, device_code)
);

-- ============================================================
-- WORK INSTRUCTIONS / DOCUMENTS / ATTACHMENTS / NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_work_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instruction_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  operation_name VARCHAR(150),
  product_code VARCHAR(100),
  body TEXT,
  version_no INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'active',
  file_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, instruction_code)
);

CREATE TABLE IF NOT EXISTS mes_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255),
  file_url TEXT,
  file_type VARCHAR(80),
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mes_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_table VARCHAR(80) NOT NULL,
  entity_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mes_audit_log (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mes_audit ON mes_audit_log(company_id, created_at DESC);

-- ============================================================
-- PRODUCTION SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, setting_key)
);

-- ============================================================
-- AI INSIGHTS (production)
-- ============================================================
CREATE TABLE IF NOT EXISTS mes_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
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
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description)
SELECT v.name, v.slug, v.module, v.description
FROM (VALUES
  ('View MES Platform', 'mes.view', 'mes', 'View production MES'),
  ('Manage MES Platform', 'mes.manage', 'mes', 'Create and edit production entities'),
  ('MES Shop Floor Ops', 'mes.operate', 'mes', 'Shop floor execution'),
  ('MES Quality Control', 'mes.quality', 'mes', 'Quality and NCR'),
  ('MES Planning Engine', 'mes.plan', 'mes', 'MPS MRP planning'),
  ('MES Production Costing', 'mes.cost', 'mes', 'Production costing'),
  ('MES Full Admin', 'mes.admin', 'mes', 'Full MES administration'),
  ('MES AI Assistant', 'mes.ai', 'mes', 'AI manufacturing assistant')
) AS v(name, slug, module, description)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.slug = v.slug OR p.name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'mes.%' OR slug LIKE 'production.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mes_production_plans','mes_production_plan_lines','mes_production_lines',
    'mes_machine_groups','mes_shifts','mes_operators','mes_job_cards',
    'mes_waste_records','mes_rework_orders','mes_consumables',
    'mes_packaging_orders','mes_labels','mes_serial_numbers',
    'mes_energy_readings','mes_iot_devices','mes_work_instructions',
    'mes_attachments','mes_notes','mes_audit_log','mes_settings','mes_ai_insights'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (company_id = public.user_company_id() OR company_id IS NULL) WITH CHECK (company_id = public.user_company_id() OR company_id IS NULL)',
        t || '_all', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- SEED
-- ============================================================
DO $$
DECLARE
  cid UUID := 'a0000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = cid) THEN
    SELECT id INTO cid FROM companies LIMIT 1;
  END IF;
  IF cid IS NULL THEN RETURN; END IF;

  INSERT INTO mes_shifts (company_id, shift_code, name, start_time, end_time)
  VALUES
    (cid, 'MORNING', 'Morning Shift', '06:00', '14:00'),
    (cid, 'AFTERNOON', 'Afternoon Shift', '14:00', '22:00'),
    (cid, 'NIGHT', 'Night Shift', '22:00', '06:00')
  ON CONFLICT (company_id, shift_code) DO NOTHING;

  INSERT INTO mes_production_lines (company_id, line_code, name, factory_name, capacity_units_hour, status, efficiency_pct)
  VALUES
    (cid, 'LINE-01', 'Security Print Line 1', 'Secure Print Plant', 300, 'idle', 98),
    (cid, 'LINE-02', 'Security Print Line 2', 'Secure Print Plant', 250, 'idle', 95),
    (cid, 'LINE-PKG', 'Packaging Line A', 'Secure Print Plant', 400, 'idle', 97)
  ON CONFLICT (company_id, line_code) DO NOTHING;

  INSERT INTO mes_machine_groups (company_id, group_code, name, description)
  VALUES
    (cid, 'GRP-PRINT', 'Printing Presses', 'Offset and security presses'),
    (cid, 'GRP-FINISH', 'Finishing', 'Cutters, collators, binders'),
    (cid, 'GRP-PKG', 'Packaging', 'Wrappers and cartoners')
  ON CONFLICT (company_id, group_code) DO NOTHING;

  INSERT INTO mes_settings (company_id, setting_key, setting_value, description) VALUES
    (cid, 'default_uom', '"REAM"', 'Default production UOM'),
    (cid, 'oee_target', '85', 'Plant OEE target %'),
    (cid, 'auto_release_orders', 'false', 'Auto-release approved orders'),
    (cid, 'qr_prefix', '"HDG"', 'QR serial prefix'),
    (cid, 'require_qc_before_close', 'true', 'Block close without QC pass')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  INSERT INTO mes_work_instructions (company_id, instruction_code, title, operation_name, body, status)
  VALUES
    (cid, 'WI-PRINT-01', 'Security Press Startup', 'Printing',
     '1. Safety check 2. Load plates 3. Ink density verification 4. First-piece QC', 'active'),
    (cid, 'WI-PKG-01', 'Carton Packing SOP', 'Packaging',
     '1. Verify batch 2. Apply ream QR 3. 5 reams per carton 4. Master QR on carton', 'active')
  ON CONFLICT (company_id, instruction_code) DO NOTHING;

  INSERT INTO mes_iot_devices (company_id, device_code, name, device_type, protocol, status)
  VALUES
    (cid, 'IOT-PRESS-01', 'Press #1 Vibration Sensor', 'sensor', 'mqtt', 'online'),
    (cid, 'IOT-METER-01', 'Plant Energy Meter', 'meter', 'modbus', 'online')
  ON CONFLICT (company_id, device_code) DO NOTHING;

  INSERT INTO mes_ai_insights (company_id, insight_type, title, summary, severity, score, recommendations)
  SELECT cid, v.t, v.title, v.sum, v.sev, v.sc, v.rec::jsonb
  FROM (VALUES
    ('schedule', 'Optimize changeover sequence',
     'Grouping similar SKUs can cut setup time ~18% this week.',
     'info', 74.0,
     '["Sort MPS by plate family","Batch security jobs","Freeze schedule 24h ahead"]'),
    ('maintenance', 'Press #2 vibration trend rising',
     'Predictive model flags bearing wear risk within 14 days.',
     'warning', 81.0,
     '["Schedule PM","Inspect rollers","Order spare bearings"]'),
    ('quality', 'Scrap rate elevated on hologram line',
     'Rejects concentrated on first hour of morning shift.',
     'warning', 69.0,
     '["Warm-up checklist","Ink viscosity check","Operator coaching"]')
  ) AS v(t, title, sum, sev, sc, rec)
  WHERE NOT EXISTS (SELECT 1 FROM mes_ai_insights WHERE company_id = cid LIMIT 1);

  -- Sample plan
  IF NOT EXISTS (SELECT 1 FROM mes_production_plans WHERE company_id = cid LIMIT 1) THEN
    INSERT INTO mes_production_plans (
      company_id, plan_number, plan_name, planning_period, factory_name,
      production_line, status, period_start, period_end, forecast_qty, capacity_hours
    ) VALUES (
      cid, 'MPS-2026-W30', 'Week 30 Master Schedule', 'weekly', 'Secure Print Plant',
      'LINE-01', 'approved', date_trunc('week', CURRENT_DATE)::date,
      (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date, 5000, 120
    );
  END IF;

END $$;
