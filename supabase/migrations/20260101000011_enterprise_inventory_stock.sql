-- Hope Design Group Ltd — Enterprise Inventory & Stock Management
-- Master data · Multi-warehouse · GRN · QC · Movements · Transfers · Adjustments · Valuation

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE inv_item_category AS ENUM (
  'raw_material','paper_roll','chemical','ink','glue','packaging',
  'security_thread','hologram','wip','semi_finished','finished_good',
  'security_document','engineering','spare_part','consumable',
  'maintenance','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE grn_status AS ENUM (
  'draft','pending_inspection','partially_accepted','accepted','rejected','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE qc_result AS ENUM (
  'pending','accepted','rejected','quarantined','returned','reworked'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE transfer_status AS ENUM (
  'draft','in_transit','received','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE adjustment_type AS ENUM (
  'cycle_count','write_off','damage','theft','found','revaluation','correction','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE valuation_method AS ENUM (
  'fifo','weighted_average','specific_identification','standard'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND PRODUCTS (inventory master)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS item_category inv_item_category DEFAULT 'finished_good',
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150),
  ADD COLUMN IF NOT EXISTS uom VARCHAR(30) DEFAULT 'EA',
  ADD COLUMN IF NOT EXISTS uom_conversion JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS hazard_class VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
  ADD COLUMN IF NOT EXISTS standard_cost DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_cost DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS preferred_supplier_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reorder_level DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_qty DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_stock DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS valuation_method valuation_method DEFAULT 'weighted_average',
  ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_batch_tracked BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS rfid_tag VARCHAR(100);

-- ============================================================
-- EXTEND WAREHOUSES
-- ============================================================
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS warehouse_type VARCHAR(50) DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS used_capacity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valuation_method valuation_method DEFAULT 'weighted_average';

ALTER TABLE warehouse_racks
  ADD COLUMN IF NOT EXISTS zone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shelf VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bin_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS used_units INTEGER DEFAULT 0;

-- ============================================================
-- WAREHOUSE ZONES & BINS
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  zone_type VARCHAR(50) DEFAULT 'storage', -- receiving | storage | quarantine | shipping | staging
  temperature_controlled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS warehouse_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES warehouse_zones(id),
  rack_id UUID REFERENCES warehouse_racks(id),
  code VARCHAR(50) NOT NULL,
  aisle VARCHAR(20),
  shelf VARCHAR(20),
  bin_label VARCHAR(50),
  barcode VARCHAR(100),
  capacity_units INTEGER,
  used_units INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

-- ============================================================
-- STOCK BALANCES (quantity by product × location)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES warehouse_zones(id),
  bin_id UUID REFERENCES warehouse_bins(id),
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  quantity_on_hand DECIMAL(18,4) DEFAULT 0,
  quantity_reserved DECIMAL(18,4) DEFAULT 0,
  quantity_available DECIMAL(18,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  quantity_quarantine DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,4) DEFAULT 0,
  total_value DECIMAL(18,4) DEFAULT 0,
  expiry_date DATE,
  last_movement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (company_id, product_id, warehouse_id, bin_id, batch_number, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_wh ON stock_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances(product_id);

-- ============================================================
-- GOODS RECEIVED NOTES (GRN)
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  grn_number VARCHAR(50) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  supplier_name VARCHAR(255),
  supplier_id UUID, -- optional link if suppliers table exists
  purchase_order_ref VARCHAR(100),
  delivery_note_ref VARCHAR(100),
  invoice_ref VARCHAR(100),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status grn_status DEFAULT 'draft',
  notes TEXT,
  received_by UUID REFERENCES user_profiles(id),
  inspected_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, grn_number)
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INTEGER DEFAULT 1,
  product_id UUID REFERENCES products(id),
  item_description VARCHAR(255) NOT NULL,
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  manufacture_date DATE,
  expiry_date DATE,
  qty_ordered DECIMAL(18,4) DEFAULT 0,
  qty_received DECIMAL(18,4) NOT NULL DEFAULT 0,
  qty_damaged DECIMAL(18,4) DEFAULT 0,
  qty_accepted DECIMAL(18,4) DEFAULT 0,
  qty_rejected DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'EA',
  unit_cost DECIMAL(18,4) DEFAULT 0,
  bin_id UUID REFERENCES warehouse_bins(id),
  qc_status qc_result DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUALITY INSPECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_number VARCHAR(50) NOT NULL,
  grn_id UUID REFERENCES goods_receipts(id),
  grn_line_id UUID REFERENCES goods_receipt_lines(id),
  product_id UUID REFERENCES products(id),
  batch_number VARCHAR(100),
  result qc_result DEFAULT 'pending',
  inspector_id UUID REFERENCES user_profiles(id),
  inspected_at TIMESTAMPTZ,
  findings TEXT,
  corrective_action TEXT,
  photo_urls TEXT[],
  test_report_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, inspection_number)
);

-- ============================================================
-- STOCK TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(50) NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status transfer_status DEFAULT 'draft',
  reason TEXT,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES user_profiles(id),
  received_by UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  item_description VARCHAR(255),
  batch_number VARCHAR(100),
  qty_sent DECIMAL(18,4) NOT NULL DEFAULT 0,
  qty_received DECIMAL(18,4) DEFAULT 0,
  from_bin_id UUID REFERENCES warehouse_bins(id),
  to_bin_id UUID REFERENCES warehouse_bins(id),
  unit_cost DECIMAL(18,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STOCK ADJUSTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(50) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  adjustment_type adjustment_type DEFAULT 'correction',
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'draft', -- draft | posted | void
  reason TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  item_description VARCHAR(255),
  batch_number VARCHAR(100),
  bin_id UUID REFERENCES warehouse_bins(id),
  qty_before DECIMAL(18,4) DEFAULT 0,
  qty_after DECIMAL(18,4) DEFAULT 0,
  qty_delta DECIMAL(18,4) DEFAULT 0,
  unit_cost DECIMAL(18,4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CYCLE COUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  count_number VARCHAR(50) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) DEFAULT 'open', -- open | counting | completed | cancelled
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, count_number)
);

CREATE TABLE IF NOT EXISTS cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  bin_id UUID REFERENCES warehouse_bins(id),
  batch_number VARCHAR(100),
  system_qty DECIMAL(18,4) DEFAULT 0,
  counted_qty DECIMAL(18,4),
  variance DECIMAL(18,4),
  counted_by UUID REFERENCES user_profiles(id),
  counted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTEND MOVEMENTS (enterprise fields)
-- ============================================================
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS from_bin_id UUID REFERENCES warehouse_bins(id),
  ADD COLUMN IF NOT EXISTS to_bin_id UUID REFERENCES warehouse_bins(id),
  ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_value DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS document_id UUID,
  ADD COLUMN IF NOT EXISTS qty_decimal DECIMAL(18,4);

-- ============================================================
-- INVENTORY INSIGHTS (AI / ops)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT,
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  metric_value DECIMAL(18,4),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: warehouse zones & bins
-- ============================================================
DO $$
DECLARE
  v_wh UUID;
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_zone_recv UUID;
  v_zone_store UUID;
  v_zone_qc UUID;
BEGIN
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company ORDER BY created_at LIMIT 1;
  IF v_wh IS NULL THEN
    INSERT INTO warehouses (company_id, name, code, city, capacity_units, warehouse_type)
    VALUES (v_company, 'Main Factory Warehouse', 'WH-MAIN', 'Kampala', 50000, 'factory')
    RETURNING id INTO v_wh;
  END IF;

  INSERT INTO warehouse_zones (id, company_id, warehouse_id, code, name, zone_type)
  VALUES (gen_random_uuid(), v_company, v_wh, 'Z-RCV', 'Receiving Dock', 'receiving')
  ON CONFLICT (warehouse_id, code) DO NOTHING
  RETURNING id INTO v_zone_recv;

  SELECT id INTO v_zone_recv FROM warehouse_zones WHERE warehouse_id = v_wh AND code = 'Z-RCV';

  INSERT INTO warehouse_zones (company_id, warehouse_id, code, name, zone_type)
  VALUES (v_company, v_wh, 'Z-STG', 'Bulk Storage', 'storage')
  ON CONFLICT (warehouse_id, code) DO NOTHING;

  SELECT id INTO v_zone_store FROM warehouse_zones WHERE warehouse_id = v_wh AND code = 'Z-STG';

  INSERT INTO warehouse_zones (company_id, warehouse_id, code, name, zone_type)
  VALUES (v_company, v_wh, 'Z-QC', 'Quality Quarantine', 'quarantine')
  ON CONFLICT (warehouse_id, code) DO NOTHING;

  SELECT id INTO v_zone_qc FROM warehouse_zones WHERE warehouse_id = v_wh AND code = 'Z-QC';

  INSERT INTO warehouse_bins (company_id, warehouse_id, zone_id, code, aisle, shelf, bin_label, barcode, capacity_units)
  VALUES
    (v_company, v_wh, v_zone_recv, 'BIN-RCV-01', 'R1', '1', 'Receiving-01', 'BIN-RCV-01', 1000),
    (v_company, v_wh, v_zone_store, 'BIN-A01-01', 'A', '1', 'A01-01', 'BIN-A01-01', 500),
    (v_company, v_wh, v_zone_store, 'BIN-A01-02', 'A', '1', 'A01-02', 'BIN-A01-02', 500),
    (v_company, v_wh, v_zone_store, 'BIN-B02-01', 'B', '2', 'B02-01', 'BIN-B02-01', 500),
    (v_company, v_wh, v_zone_qc, 'BIN-QC-01', 'Q', '1', 'QC-01', 'BIN-QC-01', 200)
  ON CONFLICT (warehouse_id, code) DO NOTHING;

  -- Secondary warehouse
  INSERT INTO warehouses (company_id, name, code, city, capacity_units, warehouse_type)
  VALUES (v_company, 'Distribution Centre Kampala', 'WH-DC-KLA', 'Kampala', 30000, 'distribution')
  ON CONFLICT (company_id, code) DO NOTHING;
END $$;

-- ============================================================
-- SEED: extend product categories + sample stock
-- ============================================================
INSERT INTO product_categories (company_id, name, code, description) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Raw Materials', 'RAW', 'Paper rolls, pulp, chemicals'),
  ('a0000000-0000-4000-8000-000000000001', 'Packaging', 'PKG', 'Cartons, shrink wrap, labels'),
  ('a0000000-0000-4000-8000-000000000001', 'Finished Goods', 'FG', 'Copy paper, security print'),
  ('a0000000-0000-4000-8000-000000000001', 'Spare Parts', 'SP', 'Machine spares & lubricants'),
  ('a0000000-0000-4000-8000-000000000001', 'Consumables', 'CON', 'Toners, ribbons, cleaning')
ON CONFLICT (company_id, code) DO NOTHING;

-- Sample inventory products if missing
INSERT INTO products (
  company_id, name, product_code, sku, item_category, uom,
  standard_cost, average_cost, selling_price, reorder_level, reorder_qty, is_batch_tracked
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  name, code, code, cat::inv_item_category, uom,
  scost, scost, sprice, reorder, reorder * 2, true
FROM (VALUES
  ('Pulp Roll 80gsm', 'RAW-PULP-80', 'raw_material', 'ROLL', 450000, 0, 20),
  ('Security Ink Blue', 'RAW-INK-BLU', 'ink', 'LTR', 85000, 0, 10),
  ('Corrugated Carton', 'PKG-CTN-STD', 'packaging', 'EA', 2500, 0, 200),
  ('Premium A4 Copy Paper', 'FG-A4-PREM', 'finished_good', 'REAM', 12000, 18000, 500),
  ('Exercise Book 96pg', 'FG-EXB-96', 'finished_good', 'EA', 1500, 2500, 1000),
  ('Guillotine Blade', 'SP-BLADE-01', 'spare_part', 'EA', 350000, 0, 2),
  ('Printer Ribbon', 'CON-RIB-01', 'consumable', 'EA', 45000, 0, 20)
) AS v(name, code, cat, uom, scost, sprice, reorder)
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.company_id = 'a0000000-0000-4000-8000-000000000001' AND p.product_code = v.code
);

-- Seed stock balances for main warehouse
DO $$
DECLARE
  v_wh UUID;
  v_bin UUID;
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  r RECORD;
BEGIN
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company AND code IN ('WH-MAIN') LIMIT 1;
  IF v_wh IS NULL THEN
    SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;
  END IF;
  SELECT id INTO v_bin FROM warehouse_bins WHERE warehouse_id = v_wh ORDER BY code LIMIT 1;

  FOR r IN
    SELECT id, standard_cost, product_code FROM products
    WHERE company_id = v_company AND product_code IN ('RAW-PULP-80','FG-A4-PREM','PKG-CTN-STD','FG-EXB-96')
  LOOP
    INSERT INTO stock_balances (
      company_id, product_id, warehouse_id, bin_id, batch_number,
      quantity_on_hand, unit_cost, total_value, last_movement_at
    ) VALUES (
      v_company, r.id, v_wh, v_bin, 'BATCH-SEED-001',
      CASE r.product_code
        WHEN 'RAW-PULP-80' THEN 45
        WHEN 'FG-A4-PREM' THEN 1200
        WHEN 'PKG-CTN-STD' THEN 800
        WHEN 'FG-EXB-96' THEN 3500
        ELSE 100
      END,
      COALESCE(r.standard_cost, 0),
      COALESCE(r.standard_cost, 0) * CASE r.product_code
        WHEN 'RAW-PULP-80' THEN 45
        WHEN 'FG-A4-PREM' THEN 1200
        WHEN 'PKG-CTN-STD' THEN 800
        WHEN 'FG-EXB-96' THEN 3500
        ELSE 100
      END,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Insights
INSERT INTO inventory_insights (company_id, insight_type, severity, title, recommendation, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'reorder',
    'high',
    'Low stock risk — Security Ink Blue',
    'On-hand inventory is near reorder level. Place PO with preferred ink supplier within 5 days to avoid production stoppage.',
    10
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'overstock',
    'medium',
    'Exercise Book 96pg above max stock',
    'Demand forecast soft next quarter. Pause production batch or transfer surplus to DC Kampala.',
    NULL
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'traceability',
    'low',
    'Enable batch tracking on packaging cartons',
    'Link GRN batches to carton SKUs for full chain-of-custody with finished goods QR serials.',
    NULL
  )
ON CONFLICT DO NOTHING;

-- Sample GRN
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_wh UUID;
  v_grn UUID;
  v_prod UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM goods_receipts WHERE grn_number = 'GRN-2026-0001') THEN
    RETURN;
  END IF;
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;
  SELECT id INTO v_prod FROM products WHERE company_id = v_company AND product_code = 'RAW-PULP-80' LIMIT 1;

  INSERT INTO goods_receipts (
    company_id, grn_number, warehouse_id, supplier_name, purchase_order_ref,
    delivery_note_ref, receipt_date, status, notes
  ) VALUES (
    v_company, 'GRN-2026-0001', v_wh, 'East Africa Pulp Supplies Ltd', 'PO-2026-0042',
    'DN-77821', CURRENT_DATE, 'pending_inspection', 'Inbound pulp rolls for Premium A4 line'
  ) RETURNING id INTO v_grn;

  INSERT INTO goods_receipt_lines (
    grn_id, company_id, line_number, product_id, item_description,
    batch_number, qty_ordered, qty_received, qty_damaged, qty_accepted, uom, unit_cost, qc_status
  ) VALUES (
    v_grn, v_company, 1, v_prod, 'Pulp Roll 80gsm',
    'PULP-LOT-4421', 50, 50, 1, 0, 'ROLL', 450000, 'pending'
  );
END $$;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('Inventory GRN', 'inventory.grn', 'inventory', 'Create and receive goods receipts'),
  ('Inventory QC', 'inventory.qc', 'inventory', 'Quality inspection on inbound stock'),
  ('Inventory Transfer', 'inventory.transfer', 'inventory', 'Inter-warehouse transfers'),
  ('Inventory Adjust', 'inventory.adjust', 'inventory', 'Adjustments, write-offs, cycle counts'),
  ('Inventory Valuation', 'inventory.valuation', 'inventory', 'Costing and stock valuation reports')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'inventory.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE warehouse_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_zones_all ON warehouse_zones FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY warehouse_bins_all ON warehouse_bins FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY stock_balances_all ON stock_balances FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY goods_receipts_all ON goods_receipts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY goods_receipt_lines_all ON goods_receipt_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY inventory_inspections_all ON inventory_inspections FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY stock_transfers_all ON stock_transfers FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY stock_transfer_lines_all ON stock_transfer_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY stock_adjustments_all ON stock_adjustments FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY stock_adjustment_lines_all ON stock_adjustment_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY cycle_counts_all ON cycle_counts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY cycle_count_lines_all ON cycle_count_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY inventory_insights_all ON inventory_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- ============================================================
-- HELPER: accept GRN line → update stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_grn_line(
  p_line_id UUID,
  p_qty_accepted DECIMAL,
  p_bin_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_line goods_receipt_lines%ROWTYPE;
  v_grn goods_receipts%ROWTYPE;
  v_cost DECIMAL(18,4);
BEGIN
  SELECT * INTO v_line FROM goods_receipt_lines WHERE id = p_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'GRN line not found'; END IF;
  SELECT * INTO v_grn FROM goods_receipts WHERE id = v_line.grn_id;

  UPDATE goods_receipt_lines SET
    qty_accepted = p_qty_accepted,
    qty_rejected = GREATEST(COALESCE(qty_received,0) - COALESCE(qty_damaged,0) - p_qty_accepted, 0),
    qc_status = 'accepted',
    bin_id = COALESCE(p_bin_id, bin_id)
  WHERE id = p_line_id;

  IF v_line.product_id IS NOT NULL AND p_qty_accepted > 0 THEN
    v_cost := COALESCE(v_line.unit_cost, 0);
    INSERT INTO stock_balances (
      company_id, product_id, warehouse_id, bin_id, batch_number,
      quantity_on_hand, unit_cost, total_value, expiry_date, last_movement_at
    ) VALUES (
      v_line.company_id, v_line.product_id, v_grn.warehouse_id,
      COALESCE(p_bin_id, v_line.bin_id), v_line.batch_number,
      p_qty_accepted, v_cost, p_qty_accepted * v_cost, v_line.expiry_date, NOW()
    )
    ON CONFLICT (company_id, product_id, warehouse_id, bin_id, batch_number, serial_number)
    DO UPDATE SET
      quantity_on_hand = stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand,
      total_value = (stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand) *
        CASE WHEN stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand = 0 THEN 0
        ELSE (
          (stock_balances.total_value + EXCLUDED.total_value) /
          (stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand)
        ) END,
      unit_cost = CASE WHEN stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand = 0 THEN 0
        ELSE (
          (stock_balances.total_value + EXCLUDED.total_value) /
          (stock_balances.quantity_on_hand + EXCLUDED.quantity_on_hand)
        ) END,
      last_movement_at = NOW(),
      updated_at = NOW();

    INSERT INTO inventory_movements (
      company_id, movement_type, item_type, product_id, batch_number,
      to_warehouse_id, to_bin_id, quantity, qty_decimal, unit_cost, total_value,
      document_type, document_id, reference_number, performed_by, notes
    ) VALUES (
      v_line.company_id, 'goods_receipt', 'product', v_line.product_id, v_line.batch_number,
      v_grn.warehouse_id, COALESCE(p_bin_id, v_line.bin_id),
      p_qty_accepted::INTEGER, p_qty_accepted, v_cost, p_qty_accepted * v_cost,
      'grn', v_grn.id, v_grn.grn_number, auth.uid(), 'GRN acceptance'
    );
  END IF;

  -- Update GRN header if all lines decided
  IF NOT EXISTS (
    SELECT 1 FROM goods_receipt_lines
    WHERE grn_id = v_grn.id AND qc_status = 'pending'
  ) THEN
    UPDATE goods_receipts SET
      status = 'accepted',
      approved_at = NOW(),
      approved_by = auth.uid(),
      updated_at = NOW()
    WHERE id = v_grn.id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accept_grn_line(UUID, DECIMAL, UUID) TO authenticated, service_role;
