-- Hope Design Group Ltd — Inventory Control, Reservations, Replenishment, ABC/EOQ, Traceability

-- ============================================================
-- EXTEND PRODUCTS (stock control analytics)
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS safety_stock DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eoq DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS abc_class VARCHAR(1) DEFAULT 'C', -- A | B | C
  ADD COLUMN IF NOT EXISTS xyz_class VARCHAR(1) DEFAULT 'Z', -- X | Y | Z demand variability
  ADD COLUMN IF NOT EXISTS annual_usage_qty DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_usage_value DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_daily_demand DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_movement_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_slow_moving BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dead_stock BOOLEAN DEFAULT false;

-- ============================================================
-- EXTEND STOCK BALANCES (control buckets)
-- ============================================================
ALTER TABLE stock_balances
  ADD COLUMN IF NOT EXISTS quantity_damaged DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_in_transit DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_on_order DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_committed DECIMAL(18,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manufacture_date DATE,
  ADD COLUMN IF NOT EXISTS quality_certificate VARCHAR(150),
  ADD COLUMN IF NOT EXISTS supplier_batch VARCHAR(100),
  ADD COLUMN IF NOT EXISTS production_line VARCHAR(100);

-- ============================================================
-- STOCK RESERVATIONS
-- ============================================================
DO $$ BEGIN CREATE TYPE reservation_status AS ENUM (
  'active','fulfilled','released','cancelled','expired'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reservation_number VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  bin_id UUID REFERENCES warehouse_bins(id),
  batch_number VARCHAR(100),
  quantity DECIMAL(18,4) NOT NULL,
  quantity_fulfilled DECIMAL(18,4) DEFAULT 0,
  status reservation_status DEFAULT 'active',
  purpose VARCHAR(50) NOT NULL DEFAULT 'sales_order', -- sales_order | production | project | department | other
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(100),
  reserved_for UUID REFERENCES user_profiles(id),
  department VARCHAR(100),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, reservation_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_active
  ON stock_reservations(company_id, status) WHERE status = 'active';

-- ============================================================
-- REPLENISHMENT / PURCHASE REQUISITIONS
-- ============================================================
DO $$ BEGIN CREATE TYPE requisition_status AS ENUM (
  'draft','submitted','approved','ordered','cancelled','closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requisition_number VARCHAR(50) NOT NULL,
  product_id UUID REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  quantity DECIMAL(18,4) NOT NULL,
  uom VARCHAR(30) DEFAULT 'EA',
  suggested_supplier VARCHAR(255),
  estimated_unit_cost DECIMAL(18,4) DEFAULT 0,
  estimated_total DECIMAL(18,4) DEFAULT 0,
  lead_time_days INTEGER,
  reason TEXT,
  source VARCHAR(50) DEFAULT 'manual', -- manual | reorder | ai | production | safety_stock
  status requisition_status DEFAULT 'draft',
  priority VARCHAR(20) DEFAULT 'medium',
  required_by DATE,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, requisition_number)
);

-- ============================================================
-- BATCH / SERIAL TRACEABILITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_trace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  event_type VARCHAR(50) NOT NULL, -- receive | inspect | store | transfer | issue | ship | return | adjust
  event_at TIMESTAMPTZ DEFAULT NOW(),
  warehouse_id UUID REFERENCES warehouses(id),
  from_location VARCHAR(150),
  to_location VARCHAR(150),
  quantity DECIMAL(18,4) DEFAULT 1,
  reference_type VARCHAR(50),
  reference_number VARCHAR(100),
  actor_id UUID REFERENCES user_profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_trace_batch ON batch_trace_events(company_id, batch_number);
CREATE INDEX IF NOT EXISTS idx_batch_trace_serial ON batch_trace_events(company_id, serial_number);

-- ============================================================
-- MOVEMENT APPROVAL HISTORY (spec: approval trail on movements)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL, -- adjustment | transfer | grn | reservation | write_off
  document_id UUID NOT NULL,
  document_number VARCHAR(100),
  action VARCHAR(50) NOT NULL, -- submitted | approved | rejected | released
  actor_id UUID REFERENCES user_profiles(id),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VALUATION SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method valuation_method DEFAULT 'weighted_average',
  warehouse_id UUID REFERENCES warehouses(id),
  total_qty DECIMAL(18,4) DEFAULT 0,
  total_value DECIMAL(18,4) DEFAULT 0,
  cogs_mtd DECIMAL(18,4) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: ABC classification + safety stock on products
-- ============================================================
UPDATE products SET
  abc_class = CASE product_code
    WHEN 'FG-A4-PREM' THEN 'A'
    WHEN 'RAW-PULP-80' THEN 'A'
    WHEN 'FG-EXB-96' THEN 'B'
    WHEN 'RAW-INK-BLU' THEN 'B'
    ELSE 'C'
  END,
  xyz_class = CASE product_code
    WHEN 'FG-A4-PREM' THEN 'X'
    WHEN 'RAW-PULP-80' THEN 'X'
    WHEN 'FG-EXB-96' THEN 'Y'
    ELSE 'Z'
  END,
  safety_stock = COALESCE(NULLIF(reorder_level, 0), 10) * 0.5,
  min_stock = COALESCE(NULLIF(reorder_level, 0), 5),
  eoq = COALESCE(NULLIF(reorder_qty, 0), 50),
  avg_daily_demand = CASE product_code
    WHEN 'FG-A4-PREM' THEN 40
    WHEN 'FG-EXB-96' THEN 80
    WHEN 'RAW-PULP-80' THEN 2
    ELSE 1
  END,
  annual_usage_qty = CASE product_code
    WHEN 'FG-A4-PREM' THEN 14600
    WHEN 'FG-EXB-96' THEN 29200
    WHEN 'RAW-PULP-80' THEN 730
    ELSE 100
  END
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

UPDATE products SET
  annual_usage_value = COALESCE(annual_usage_qty, 0) * COALESCE(average_cost, standard_cost, 0),
  is_slow_moving = (product_code IN ('SP-BLADE-01', 'CON-RIB-01')),
  is_dead_stock = false
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

-- Seed purchase requisitions (AI-style)
INSERT INTO purchase_requisitions (
  company_id, requisition_number, product_id, warehouse_id, quantity, uom,
  suggested_supplier, estimated_unit_cost, estimated_total, lead_time_days,
  reason, source, status, priority, required_by
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'PR-2026-AI-001',
  p.id,
  w.id,
  50,
  'ROLL',
  'East Africa Pulp Supplies Ltd',
  p.standard_cost,
  50 * COALESCE(p.standard_cost, 0),
  p.lead_time_days,
  'Premium A4 Copy Paper stock is projected to fall below the safety stock level within 10 days. Based on supplier lead times and production demand, generate a purchase requisition for 50 jumbo paper rolls.',
  'ai',
  'submitted',
  'high',
  CURRENT_DATE + 7
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM warehouses
  WHERE company_id = 'a0000000-0000-4000-8000-000000000001'
  ORDER BY created_at LIMIT 1
) w
WHERE p.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND p.product_code = 'RAW-PULP-80'
  AND NOT EXISTS (
    SELECT 1 FROM purchase_requisitions WHERE requisition_number = 'PR-2026-AI-001'
  );

-- Seed cycle count
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_wh UUID;
  v_cc UUID;
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM cycle_counts WHERE count_number = 'CC-2026-0001') THEN
    RETURN;
  END IF;
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;
  INSERT INTO cycle_counts (company_id, count_number, warehouse_id, count_date, status, notes)
  VALUES (v_company, 'CC-2026-0001', v_wh, CURRENT_DATE, 'open', 'Scheduled A-class cycle count')
  RETURNING id INTO v_cc;

  FOR r IN
    SELECT sb.product_id, sb.bin_id, sb.batch_number, sb.quantity_on_hand
    FROM stock_balances sb
    WHERE sb.company_id = v_company AND sb.warehouse_id = v_wh
    LIMIT 10
  LOOP
    INSERT INTO cycle_count_lines (
      cycle_count_id, company_id, product_id, bin_id, batch_number, system_qty
    ) VALUES (
      v_cc, v_company, r.product_id, r.bin_id, r.batch_number, r.quantity_on_hand
    );
  END LOOP;
END $$;

-- Seed batch trace from GRN
INSERT INTO batch_trace_events (
  company_id, product_id, batch_number, event_type, warehouse_id,
  to_location, quantity, reference_type, reference_number, notes
)
SELECT
  g.company_id, l.product_id, l.batch_number, 'receive', g.warehouse_id,
  'Receiving Dock', l.qty_received, 'grn', g.grn_number, 'Inbound goods receipt'
FROM goods_receipts g
JOIN goods_receipt_lines l ON l.grn_id = g.id
WHERE g.grn_number = 'GRN-2026-0001'
  AND NOT EXISTS (
    SELECT 1 FROM batch_trace_events e
    WHERE e.reference_number = 'GRN-2026-0001' AND e.event_type = 'receive'
  );

-- Valuation snapshot
INSERT INTO inventory_valuations (company_id, valuation_date, method, total_qty, total_value, notes)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  CURRENT_DATE,
  'weighted_average',
  COALESCE(SUM(quantity_on_hand), 0),
  COALESCE(SUM(total_value), 0),
  'Opening enterprise valuation snapshot'
FROM stock_balances
WHERE company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM inventory_valuations
    WHERE company_id = 'a0000000-0000-4000-8000-000000000001'
      AND valuation_date = CURRENT_DATE
  );

-- Extra AI insights
INSERT INTO inventory_insights (company_id, insight_type, severity, title, recommendation, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'stockout_prediction',
    'high',
    'Premium A4 stockout risk within 10 days',
    'Premium A4 Copy Paper stock is projected to fall below the safety stock level within 10 days. Based on supplier lead times and production demand, generate a purchase requisition for 50 jumbo paper rolls.',
    10
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'dead_stock',
    'medium',
    'Review slow-moving spare parts',
    'Guillotine blades and ribbons show low turnover. Consider transferring surplus to maintenance stores or renegotiating min order quantities.',
    NULL
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'abc_focus',
    'low',
    'Focus cycle counts on A-class items',
    'A-class items (Premium A4, pulp) represent the majority of inventory value. Prioritise weekly cycle counts on these SKUs for accuracy.',
    NULL
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_reservations_all ON stock_reservations FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY purchase_requisitions_all ON purchase_requisitions FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY batch_trace_events_all ON batch_trace_events FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY inventory_approvals_all ON inventory_approvals FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY inventory_valuations_all ON inventory_valuations FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());

-- ============================================================
-- HELPER: reserve stock
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_product_id UUID,
  p_warehouse_id UUID,
  p_quantity DECIMAL,
  p_purpose TEXT DEFAULT 'sales_order',
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_company UUID;
  v_avail DECIMAL(18,4);
  v_id UUID;
  v_num TEXT;
  v_bal_id UUID;
BEGIN
  SELECT company_id INTO v_company FROM products WHERE id = p_product_id;
  IF v_company IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;

  SELECT COALESCE(SUM(quantity_on_hand - quantity_reserved), 0)
  INTO v_avail
  FROM stock_balances
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

  IF v_avail < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock: need %, available %', p_quantity, v_avail;
  END IF;

  -- Reserve from first balance line with availability
  SELECT id INTO v_bal_id
  FROM stock_balances
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND (quantity_on_hand - quantity_reserved) > 0
  ORDER BY updated_at
  LIMIT 1;

  IF v_bal_id IS NOT NULL THEN
    UPDATE stock_balances SET
      quantity_reserved = quantity_reserved + p_quantity,
      quantity_committed = COALESCE(quantity_committed, 0) + p_quantity,
      updated_at = NOW()
    WHERE id = v_bal_id;
  END IF;

  v_num := 'RSV-' || to_char(NOW(), 'YYYY') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  INSERT INTO stock_reservations (
    company_id, reservation_number, product_id, warehouse_id, quantity,
    purpose, reference_number, notes, created_by, status
  ) VALUES (
    v_company, v_num, p_product_id, p_warehouse_id, p_quantity,
    p_purpose, p_reference_number, p_notes, auth.uid(), 'active'
  ) RETURNING id INTO v_id;

  INSERT INTO inventory_approvals (
    company_id, document_type, document_id, document_number, action, actor_id, comments
  ) VALUES (
    v_company, 'reservation', v_id, v_num, 'submitted', auth.uid(), 'Stock reserved'
  );

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_reservation(p_reservation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_res stock_reservations%ROWTYPE;
  v_remaining DECIMAL(18,4);
BEGIN
  SELECT * INTO v_res FROM stock_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF v_res.status <> 'active' THEN RAISE EXCEPTION 'Reservation not active'; END IF;

  v_remaining := v_res.quantity - COALESCE(v_res.quantity_fulfilled, 0);

  UPDATE stock_balances SET
    quantity_reserved = GREATEST(quantity_reserved - v_remaining, 0),
    quantity_committed = GREATEST(COALESCE(quantity_committed, 0) - v_remaining, 0),
    updated_at = NOW()
  WHERE product_id = v_res.product_id
    AND warehouse_id = v_res.warehouse_id
    AND quantity_reserved > 0;

  UPDATE stock_reservations SET
    status = 'released',
    released_at = NOW(),
    released_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_reservation_id;

  INSERT INTO inventory_approvals (
    company_id, document_type, document_id, document_number, action, actor_id, comments
  ) VALUES (
    v_res.company_id, 'reservation', v_res.id, v_res.reservation_number, 'released', auth.uid(), 'Reservation released'
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reserve_stock(UUID, UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_reservation(UUID) TO authenticated, service_role;
