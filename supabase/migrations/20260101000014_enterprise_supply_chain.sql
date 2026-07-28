-- Hope Design Group Ltd — Enterprise Supply Chain Management (SCM)
-- Demand planning · S&OP · MRP · DRP · Control tower · Risk · Sustainability · KPIs

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE forecast_horizon AS ENUM (
  'daily','weekly','monthly','quarterly','annual'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE sop_status AS ENUM (
  'draft','review','approved','locked','archived'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE mrp_action AS ENUM (
  'purchase','produce','transfer','none'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE scm_risk_level AS ENUM (
  'low','medium','high','critical'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PRODUCT SCM FIELDS
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_family VARCHAR(100),
  ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(50) DEFAULT 'growth', -- intro | growth | mature | decline | obsolete
  ADD COLUMN IF NOT EXISTS service_level_pct DECIMAL(5,2) DEFAULT 95,
  ADD COLUMN IF NOT EXISTS bom_code VARCHAR(50);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS sustainability_rating DECIMAL(5,2) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS capacity_units_per_month DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS standard_lead_time_days INTEGER DEFAULT 14;

-- ============================================================
-- BILL OF MATERIALS (for MRP)
-- ============================================================
CREATE TABLE IF NOT EXISTS bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bom_code VARCHAR(50) NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, bom_code, version)
);

CREATE TABLE IF NOT EXISTS bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  component_product_id UUID REFERENCES products(id),
  component_description VARCHAR(255) NOT NULL,
  quantity_per DECIMAL(18,6) NOT NULL DEFAULT 1,
  uom VARCHAR(30) DEFAULT 'EA',
  scrap_pct DECIMAL(5,2) DEFAULT 0,
  line_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEMAND FORECASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  forecast_code VARCHAR(50) NOT NULL,
  product_id UUID REFERENCES products(id),
  product_family VARCHAR(100),
  warehouse_id UUID REFERENCES warehouses(id),
  horizon forecast_horizon DEFAULT 'weekly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  forecast_qty DECIMAL(18,4) NOT NULL DEFAULT 0,
  baseline_qty DECIMAL(18,4) DEFAULT 0,
  actual_qty DECIMAL(18,4),
  model_name VARCHAR(100) DEFAULT 'ai_ensemble',
  confidence_pct DECIMAL(5,2) DEFAULT 80,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, forecast_code)
);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_period ON demand_forecasts(company_id, period_start);

-- ============================================================
-- S&OP CYCLES
-- ============================================================
CREATE TABLE IF NOT EXISTS sop_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cycle_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status sop_status DEFAULT 'draft',
  demand_total DECIMAL(18,4) DEFAULT 0,
  supply_total DECIMAL(18,4) DEFAULT 0,
  capacity_utilization_pct DECIMAL(5,2) DEFAULT 0,
  inventory_plan_value DECIMAL(18,2) DEFAULT 0,
  budget_amount DECIMAL(18,2) DEFAULT 0,
  executive_notes TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, cycle_code)
);

CREATE TABLE IF NOT EXISTS sop_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES sop_cycles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_family VARCHAR(100),
  demand_qty DECIMAL(18,4) DEFAULT 0,
  supply_qty DECIMAL(18,4) DEFAULT 0,
  production_qty DECIMAL(18,4) DEFAULT 0,
  purchase_qty DECIMAL(18,4) DEFAULT 0,
  ending_inventory DECIMAL(18,4) DEFAULT 0,
  gap_qty DECIMAL(18,4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MRP RUNS & RECOMMENDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS mrp_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_code VARCHAR(50) NOT NULL,
  run_date TIMESTAMPTZ DEFAULT NOW(),
  horizon_days INTEGER DEFAULT 90,
  status VARCHAR(30) DEFAULT 'completed', -- running | completed | failed
  recommendations_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, run_code)
);

CREATE TABLE IF NOT EXISTS mrp_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrp_run_id UUID NOT NULL REFERENCES mrp_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  item_description VARCHAR(255),
  action mrp_action DEFAULT 'purchase',
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  due_date DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  on_hand DECIMAL(18,4) DEFAULT 0,
  on_order DECIMAL(18,4) DEFAULT 0,
  demand DECIMAL(18,4) DEFAULT 0,
  safety_stock DECIMAL(18,4) DEFAULT 0,
  net_requirement DECIMAL(18,4) DEFAULT 0,
  suggested_supplier VARCHAR(255),
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(30) DEFAULT 'open', -- open | released | cancelled
  released_document_type VARCHAR(50),
  released_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRP (Distribution Requirements Planning)
-- ============================================================
CREATE TABLE IF NOT EXISTS drp_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  product_id UUID REFERENCES products(id),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  period_start DATE,
  period_end DATE,
  recommended_qty DECIMAL(18,4) DEFAULT 0,
  current_stock_from DECIMAL(18,4) DEFAULT 0,
  current_stock_to DECIMAL(18,4) DEFAULT 0,
  forecast_demand_to DECIMAL(18,4) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'proposed', -- proposed | approved | transferred | cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, plan_code)
);

-- ============================================================
-- SUPPLY CHAIN RISKS
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_chain_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  risk_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- supplier | transport | inventory | production | geopolitical | cyber | climate
  risk_level scm_risk_level DEFAULT 'medium',
  probability_pct DECIMAL(5,2) DEFAULT 50,
  impact_score INTEGER DEFAULT 5 CHECK (impact_score BETWEEN 1 AND 10),
  status VARCHAR(30) DEFAULT 'open', -- open | mitigating | closed
  supplier_id UUID REFERENCES suppliers(id),
  product_id UUID REFERENCES products(id),
  mitigation_plan TEXT,
  owner_name VARCHAR(150),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, risk_code)
);

-- ============================================================
-- SUSTAINABILITY / ESG
-- ============================================================
CREATE TABLE IF NOT EXISTS scm_sustainability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_label VARCHAR(50) NOT NULL,
  carbon_tons DECIMAL(12,3) DEFAULT 0,
  fuel_litres DECIMAL(14,2) DEFAULT 0,
  packaging_waste_kg DECIMAL(14,2) DEFAULT 0,
  recycled_pct DECIMAL(5,2) DEFAULT 0,
  energy_kwh DECIMAL(14,2) DEFAULT 0,
  sustainable_supplier_pct DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_label)
);

-- ============================================================
-- SCM KPIs (snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS scm_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inventory_turnover DECIMAL(10,3),
  days_of_inventory DECIMAL(10,2),
  stockout_rate_pct DECIMAL(5,2),
  fill_rate_pct DECIMAL(5,2),
  on_time_delivery_pct DECIMAL(5,2),
  perfect_order_pct DECIMAL(5,2),
  procurement_cycle_days DECIMAL(8,2),
  forecast_accuracy_pct DECIMAL(5,2),
  transport_cost DECIMAL(18,2),
  inventory_value DECIMAL(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCM AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS scm_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT,
  product_id UUID REFERENCES products(id),
  supplier_id UUID REFERENCES suppliers(id),
  metric_value DECIMAL(18,4),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: product family / lifecycle
-- ============================================================
UPDATE products SET
  product_family = CASE
    WHEN product_code LIKE 'FG-%' THEN 'Finished Paper'
    WHEN product_code LIKE 'RAW-%' THEN 'Raw Materials'
    WHEN product_code LIKE 'PKG-%' THEN 'Packaging'
    WHEN product_code LIKE 'SP-%' THEN 'Spares'
    ELSE 'General'
  END,
  lifecycle_stage = CASE
    WHEN product_code = 'FG-A4-PREM' THEN 'growth'
    WHEN product_code = 'FG-EXB-96' THEN 'mature'
    ELSE 'growth'
  END,
  service_level_pct = 95
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

UPDATE suppliers SET
  sustainability_rating = CASE code
    WHEN 'SUP-PULP01' THEN 78
    WHEN 'SUP-INK02' THEN 85
    WHEN 'SUP-PKG03' THEN 62
    WHEN 'SUP-3PL04' THEN 70
    ELSE 70
  END,
  capacity_units_per_month = CASE code
    WHEN 'SUP-PULP01' THEN 500
    WHEN 'SUP-INK02' THEN 2000
    ELSE 1000
  END,
  standard_lead_time_days = COALESCE(standard_lead_time_days, 14)
WHERE company_id = 'a0000000-0000-4000-8000-000000000001';

-- BOM for Premium A4
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_fg UUID;
  v_pulp UUID;
  v_ink UUID;
  v_pkg UUID;
  v_bom UUID;
BEGIN
  SELECT id INTO v_fg FROM products WHERE product_code = 'FG-A4-PREM' AND company_id = v_company LIMIT 1;
  SELECT id INTO v_pulp FROM products WHERE product_code = 'RAW-PULP-80' AND company_id = v_company LIMIT 1;
  SELECT id INTO v_ink FROM products WHERE product_code = 'RAW-INK-BLU' AND company_id = v_company LIMIT 1;
  SELECT id INTO v_pkg FROM products WHERE product_code = 'PKG-CTN-STD' AND company_id = v_company LIMIT 1;
  IF v_fg IS NULL OR EXISTS (SELECT 1 FROM bom_headers WHERE bom_code = 'BOM-A4-PREM') THEN RETURN; END IF;

  INSERT INTO bom_headers (company_id, bom_code, product_id, version, description)
  VALUES (v_company, 'BOM-A4-PREM', v_fg, 1, 'BOM for Premium A4 Copy Paper ream')
  RETURNING id INTO v_bom;

  UPDATE products SET bom_code = 'BOM-A4-PREM' WHERE id = v_fg;

  INSERT INTO bom_lines (bom_id, company_id, component_product_id, component_description, quantity_per, uom, scrap_pct, line_number) VALUES
    (v_bom, v_company, v_pulp, 'Pulp Roll 80gsm', 0.02, 'ROLL', 2, 1),
    (v_bom, v_company, v_ink, 'Security Ink Blue', 0.001, 'LTR', 1, 2),
    (v_bom, v_company, v_pkg, 'Corrugated Carton', 0.2, 'EA', 0, 3);
END $$;

-- Demand forecasts (6 weeks Premium A4 + others)
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_fg UUID;
  v_wh UUID;
  i INTEGER;
  base DECIMAL := 280;
BEGIN
  SELECT id INTO v_fg FROM products WHERE product_code = 'FG-A4-PREM' LIMIT 1;
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;
  IF v_fg IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM demand_forecasts WHERE forecast_code = 'FC-A4-W1') THEN RETURN; END IF;

  FOR i IN 1..6 LOOP
    INSERT INTO demand_forecasts (
      company_id, forecast_code, product_id, product_family, warehouse_id,
      horizon, period_start, period_end, forecast_qty, baseline_qty,
      model_name, confidence_pct, notes
    ) VALUES (
      v_company,
      'FC-A4-W' || i,
      v_fg,
      'Finished Paper',
      v_wh,
      'weekly',
      CURRENT_DATE + ((i - 1) * 7),
      CURRENT_DATE + (i * 7) - 1,
      ROUND(base * (1 + 0.035 * i)), -- rising ~22% over 6 weeks
      base,
      'ai_ensemble',
      85 - i,
      CASE WHEN i = 6 THEN 'Peak demand window — tenders + institutional orders' ELSE NULL END
    );
  END LOOP;
END $$;

-- S&OP cycle
INSERT INTO sop_cycles (
  company_id, cycle_code, name, period_start, period_end, status,
  demand_total, supply_total, capacity_utilization_pct, inventory_plan_value, budget_amount, executive_notes
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'SOP-2026-Q3',
  'Q3 2026 Sales & Operations Plan',
  DATE '2026-07-01',
  DATE '2026-09-30',
  'review',
  18500,
  17200,
  87.5,
  420000000,
  950000000,
  'Align pulp procurement with 22% A4 demand uplift; review packaging supplier risk.'
WHERE NOT EXISTS (SELECT 1 FROM sop_cycles WHERE cycle_code = 'SOP-2026-Q3');

INSERT INTO sop_line_items (
  sop_id, company_id, product_id, product_family, demand_qty, supply_qty,
  production_qty, purchase_qty, ending_inventory, gap_qty, notes
)
SELECT
  s.id,
  s.company_id,
  p.id,
  'Finished Paper',
  12000,
  11000,
  10500,
  50,
  800,
  1000,
  'Gap driven by pulp lead time and packaging OTD risk'
FROM sop_cycles s
CROSS JOIN products p
WHERE s.cycle_code = 'SOP-2026-Q3'
  AND p.product_code = 'FG-A4-PREM'
  AND NOT EXISTS (SELECT 1 FROM sop_line_items WHERE sop_id = s.id);

-- MRP run
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_run UUID;
  v_wh UUID;
  v_prod UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM mrp_runs WHERE run_code = 'MRP-2026-0727') THEN RETURN; END IF;
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;

  INSERT INTO mrp_runs (company_id, run_code, horizon_days, status, recommendations_count, notes)
  VALUES (v_company, 'MRP-2026-0727', 90, 'completed', 0, 'Net requirements from S&OP + BOM explosion')
  RETURNING id INTO v_run;

  SELECT id INTO v_prod FROM products WHERE product_code = 'RAW-PULP-80' LIMIT 1;
  IF v_prod IS NOT NULL THEN
    INSERT INTO mrp_recommendations (
      mrp_run_id, company_id, product_id, item_description, action, quantity, due_date,
      warehouse_id, on_hand, on_order, demand, safety_stock, net_requirement,
      suggested_supplier, priority, status
    ) VALUES (
      v_run, v_company, v_prod, 'Pulp Roll 80gsm', 'purchase', 50, CURRENT_DATE + 10,
      v_wh,
      COALESCE((SELECT SUM(quantity_on_hand) FROM stock_balances WHERE product_id = v_prod), 0),
      0, 55, 20, 50,
      'East Africa Pulp Supplies Ltd', 'high', 'open'
    );
  END IF;

  SELECT id INTO v_prod FROM products WHERE product_code = 'PKG-CTN-STD' LIMIT 1;
  IF v_prod IS NOT NULL THEN
    INSERT INTO mrp_recommendations (
      mrp_run_id, company_id, product_id, item_description, action, quantity, due_date,
      warehouse_id, on_hand, demand, safety_stock, net_requirement,
      suggested_supplier, priority, status
    ) VALUES (
      v_run, v_company, v_prod, 'Corrugated Carton', 'purchase', 400, CURRENT_DATE + 7,
      v_wh,
      COALESCE((SELECT SUM(quantity_on_hand) FROM stock_balances WHERE product_id = v_prod), 0),
      900, 200, 400,
      'Alternate packaging vendor (OTD risk on SUP-PKG03)', 'high', 'open'
    );
  END IF;

  SELECT id INTO v_prod FROM products WHERE product_code = 'FG-A4-PREM' LIMIT 1;
  IF v_prod IS NOT NULL THEN
    INSERT INTO mrp_recommendations (
      mrp_run_id, company_id, product_id, item_description, action, quantity, due_date,
      warehouse_id, on_hand, demand, safety_stock, net_requirement, priority, status
    ) VALUES (
      v_run, v_company, v_prod, 'Premium A4 Copy Paper', 'produce', 2500, CURRENT_DATE + 14,
      v_wh,
      COALESCE((SELECT SUM(quantity_on_hand) FROM stock_balances WHERE product_id = v_prod), 0),
      3500, 500, 2500, 'medium', 'open'
    );

    INSERT INTO mrp_recommendations (
      mrp_run_id, company_id, product_id, item_description, action, quantity, due_date,
      warehouse_id, demand, net_requirement, priority, status
    ) VALUES (
      v_run, v_company, v_prod, 'Premium A4 — DC replenishment', 'transfer', 500, CURRENT_DATE + 5,
      v_wh, 500, 500, 'medium', 'open'
    );
  END IF;

  UPDATE mrp_runs SET recommendations_count = (
    SELECT COUNT(*) FROM mrp_recommendations WHERE mrp_run_id = v_run
  ) WHERE id = v_run;
END $$;

-- DRP plans
INSERT INTO drp_plans (
  company_id, plan_code, product_id, from_warehouse_id, to_warehouse_id,
  period_start, period_end, recommended_qty, current_stock_from, current_stock_to,
  forecast_demand_to, status, notes
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'DRP-A4-DC-001',
  p.id,
  w1.id,
  w2.id,
  CURRENT_DATE,
  CURRENT_DATE + 14,
  500,
  COALESCE((SELECT SUM(quantity_on_hand) FROM stock_balances sb WHERE sb.product_id = p.id AND sb.warehouse_id = w1.id), 1200),
  COALESCE((SELECT SUM(quantity_on_hand) FROM stock_balances sb WHERE sb.product_id = p.id AND sb.warehouse_id = w2.id), 80),
  450,
  'proposed',
  'Balance stock to Distribution Centre Kampala for institutional demand'
FROM products p
CROSS JOIN LATERAL (
  SELECT id FROM warehouses WHERE company_id = 'a0000000-0000-4000-8000-000000000001' ORDER BY created_at LIMIT 1
) w1
CROSS JOIN LATERAL (
  SELECT id FROM warehouses
  WHERE company_id = 'a0000000-0000-4000-8000-000000000001' AND code = 'WH-DC-KLA'
  LIMIT 1
) w2
WHERE p.product_code = 'FG-A4-PREM'
  AND NOT EXISTS (SELECT 1 FROM drp_plans WHERE plan_code = 'DRP-A4-DC-001');

-- Risks
INSERT INTO supply_chain_risks (
  company_id, risk_code, title, category, risk_level, probability_pct, impact_score,
  status, supplier_id, mitigation_plan, owner_name, due_date
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'RSK-PKG-OTD',
  'Packaging supplier OTD degradation',
  'supplier',
  'high',
  70,
  7,
  'mitigating',
  s.id,
  'Dual-source cartons; reallocate 30% volume; weekly performance review.',
  'Procurement Manager',
  CURRENT_DATE + 21
FROM suppliers s
WHERE s.code = 'SUP-PKG03'
  AND NOT EXISTS (SELECT 1 FROM supply_chain_risks WHERE risk_code = 'RSK-PKG-OTD');

INSERT INTO supply_chain_risks (
  company_id, risk_code, title, category, risk_level, probability_pct, impact_score,
  status, mitigation_plan, owner_name
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'RSK-PULP-CAP',
    'Pulp supplier capacity constraint',
    'supplier',
    'medium',
    55,
    8,
    'open',
    'Place parallel order with secondary pulp mill; raise safety stock 15%.',
    'Supply Chain Lead'
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'RSK-TRANS-JINJA',
    'Jinja corridor transport delays',
    'transport',
    'medium',
    40,
    5,
    'open',
    'Consolidate loads; buffer 2-day ETA on inbound pulp.',
    'Logistics Manager'
  )
ON CONFLICT DO NOTHING;

-- Sustainability
INSERT INTO scm_sustainability (
  company_id, period_label, carbon_tons, fuel_litres, packaging_waste_kg,
  recycled_pct, energy_kwh, sustainable_supplier_pct, notes
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  '2026-H1',
  142.5,
  28500,
  3200,
  38,
  420000,
  65,
  'H1 ESG snapshot for board sustainability committee'
) ON CONFLICT (company_id, period_label) DO NOTHING;

-- KPI snapshot
INSERT INTO scm_kpi_snapshots (
  company_id, snapshot_date, inventory_turnover, days_of_inventory, stockout_rate_pct,
  fill_rate_pct, on_time_delivery_pct, perfect_order_pct, procurement_cycle_days,
  forecast_accuracy_pct, transport_cost, inventory_value, notes
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  CURRENT_DATE,
  6.2,
  58,
  2.1,
  96.4,
  91.5,
  88.2,
  12.5,
  84,
  18500000,
  520000000,
  'Control tower baseline KPIs'
);

-- AI insights
INSERT INTO scm_insights (company_id, insight_type, severity, title, recommendation, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'demand_surge',
    'high',
    'Premium A4 demand +22% over next six weeks',
    'Demand for Premium A4 Copy Paper is forecast to increase by 22% over the next six weeks. Supplier Alpha (packaging) has an elevated delay risk due to capacity constraints. Recommend placing an order with Supplier Beta while increasing safety stock by 15%.',
    22
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'mrp_action',
    'high',
    'MRP recommends pulp purchase of 50 rolls',
    'Net requirement driven by S&OP demand and BOM explosion. Release purchase requisition against framework CTR-2026-PULP.',
    50
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'network_balance',
    'medium',
    'DC Kampala understocked vs forecast',
    'DRP proposes transfer of 500 reams from Main Factory Warehouse to WH-DC-KLA within 5 days.',
    500
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Supply Chain', 'scm.view', 'scm', 'View SCM control tower and plans'),
  ('Manage Supply Chain', 'scm.manage', 'scm', 'Run MRP/DRP and edit forecasts'),
  ('Approve S&OP', 'scm.sop', 'scm', 'Approve sales & operations plans'),
  ('SCM Risk', 'scm.risk', 'scm', 'Manage supply chain risks')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'scm.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrp_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_chain_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm_sustainability ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY bom_headers_all ON bom_headers FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY bom_lines_all ON bom_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY demand_forecasts_all ON demand_forecasts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY sop_cycles_all ON sop_cycles FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY sop_line_items_all ON sop_line_items FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY mrp_runs_all ON mrp_runs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY mrp_recommendations_all ON mrp_recommendations FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY drp_plans_all ON drp_plans FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY supply_chain_risks_all ON supply_chain_risks FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY scm_sustainability_all ON scm_sustainability FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY scm_kpi_snapshots_all ON scm_kpi_snapshots FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY scm_insights_all ON scm_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
