-- Hope Design Group Ltd — Enterprise Procurement & Logistics Management
-- Requisition → RFQ → PO → Inbound → GRN → Fleet/Dispatch → Supplier Performance

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE po_status AS ENUM (
  'draft','pending_approval','approved','sent','acknowledged',
  'partially_received','received','closed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE rfq_status AS ENUM (
  'draft','published','closed','awarded','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shipment_status AS ENUM (
  'planned','booked','in_transit','customs','arrived','delivered','delayed','cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE vehicle_status AS ENUM (
  'available','in_use','maintenance','out_of_service'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contract_type AS ENUM (
  'framework','blanket','service','maintenance','leasing','strategic'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- EXTEND SUPPLIERS
-- ============================================================
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'raw_materials',
  ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
  ADD COLUMN IF NOT EXISTS business_class VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Uganda',
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vat_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_approved_vendor BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_status VARCHAR(50) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS on_time_delivery_pct DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS quality_score DECIMAL(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS price_score DECIMAL(5,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS overall_score DECIMAL(5,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS insurance_details TEXT,
  ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- ============================================================
-- EXTEND PURCHASE REQUISITIONS
-- ============================================================
ALTER TABLE purchase_requisitions
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cost_centre VARCHAR(50),
  ADD COLUMN IF NOT EXISTS project_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(50) DEFAULT 'material', -- material | service | capex | opex | emergency
  ADD COLUMN IF NOT EXISTS budget_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS budget_available DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS budget_ok BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS item_description TEXT;

-- ============================================================
-- PROCUREMENT CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contract_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  contract_type contract_type DEFAULT 'framework',
  supplier_id UUID REFERENCES suppliers(id),
  start_date DATE,
  end_date DATE,
  value_limit DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'UGX',
  status VARCHAR(30) DEFAULT 'active',
  terms TEXT,
  auto_renew BOOLEAN DEFAULT false,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, contract_number)
);

-- ============================================================
-- RFQ / TENDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfq_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  rfq_type VARCHAR(30) DEFAULT 'rfq', -- rfq | rfp | rfi | open_tender | restricted
  description TEXT,
  category VARCHAR(100),
  status rfq_status DEFAULT 'draft',
  publish_date DATE,
  close_date DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  requisition_id UUID REFERENCES purchase_requisitions(id),
  awarded_supplier_id UUID REFERENCES suppliers(id),
  awarded_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, rfq_number)
);

CREATE TABLE IF NOT EXISTS rfq_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INTEGER DEFAULT 1,
  product_id UUID REFERENCES products(id),
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 1,
  uom VARCHAR(30) DEFAULT 'EA',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  quotation_ref VARCHAR(100),
  quote_date DATE DEFAULT CURRENT_DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  total_amount DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  delivery_days INTEGER,
  warranty_months INTEGER,
  payment_terms VARCHAR(100),
  technical_score DECIMAL(5,2) DEFAULT 0,
  financial_score DECIMAL(5,2) DEFAULT 0,
  total_score DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'submitted', -- submitted | shortlisted | awarded | rejected
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rfq_line_id UUID REFERENCES rfq_lines(id),
  description VARCHAR(255),
  quantity DECIMAL(18,4) DEFAULT 1,
  unit_price DECIMAL(18,4) DEFAULT 0,
  line_total DECIMAL(18,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  requisition_id UUID REFERENCES purchase_requisitions(id),
  rfq_id UUID REFERENCES rfqs(id),
  contract_id UUID REFERENCES procurement_contracts(id),
  warehouse_id UUID REFERENCES warehouses(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  currency VARCHAR(10) DEFAULT 'UGX',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  status po_status DEFAULT 'draft',
  po_type VARCHAR(50) DEFAULT 'standard', -- standard | blanket | framework | standing | contract
  payment_terms VARCHAR(100),
  delivery_address TEXT,
  notes TEXT,
  public_uuid UUID DEFAULT gen_random_uuid(),
  version INTEGER DEFAULT 1,
  acknowledged_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  line_number INTEGER DEFAULT 1,
  product_id UUID REFERENCES products(id),
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 1,
  qty_received DECIMAL(18,4) DEFAULT 0,
  uom VARCHAR(30) DEFAULT 'EA',
  unit_price DECIMAL(18,4) DEFAULT 0,
  tax_rate DECIMAL(8,4) DEFAULT 18,
  line_total DECIMAL(18,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

-- Link GRN to PO
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id);

-- ============================================================
-- INBOUND SHIPMENTS / LOGISTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS inbound_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shipment_number VARCHAR(50) NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID REFERENCES suppliers(id),
  carrier_name VARCHAR(150),
  tracking_number VARCHAR(100),
  container_number VARCHAR(100),
  mode VARCHAR(50) DEFAULT 'road', -- road | air | sea | rail | courier
  origin VARCHAR(150),
  destination_warehouse_id UUID REFERENCES warehouses(id),
  etd DATE,
  eta DATE,
  actual_arrival DATE,
  status shipment_status DEFAULT 'planned',
  freight_cost DECIMAL(18,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'UGX',
  insurance_ref VARCHAR(100),
  customs_ref VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, shipment_number)
);

-- ============================================================
-- FLEET
-- ============================================================
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registration VARCHAR(50) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  vehicle_type VARCHAR(50) DEFAULT 'truck', -- truck | van | motorcycle | trailer
  capacity_kg DECIMAL(12,2),
  fuel_type VARCHAR(30) DEFAULT 'diesel',
  status vehicle_status DEFAULT 'available',
  current_odometer INTEGER DEFAULT 0,
  insurance_expiry DATE,
  road_license_expiry DATE,
  last_service_date DATE,
  next_service_odometer INTEGER,
  assigned_driver_name VARCHAR(150),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, registration)
);

CREATE TABLE IF NOT EXISTS fleet_fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  litres DECIMAL(12,3) NOT NULL,
  cost DECIMAL(18,2) DEFAULT 0,
  odometer INTEGER,
  station VARCHAR(150),
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_type VARCHAR(100),
  cost DECIMAL(18,2) DEFAULT 0,
  odometer INTEGER,
  description TEXT,
  next_due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUPPLIER PERFORMANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_label VARCHAR(50) NOT NULL,
  on_time_pct DECIMAL(5,2) DEFAULT 0,
  quality_pct DECIMAL(5,2) DEFAULT 0,
  price_competitiveness DECIMAL(5,2) DEFAULT 0,
  responsiveness DECIMAL(5,2) DEFAULT 0,
  order_accuracy DECIMAL(5,2) DEFAULT 0,
  risk_rating VARCHAR(20) DEFAULT 'medium',
  overall_score DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROCUREMENT AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  recommendation TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  metric_value DECIMAL(18,4),
  status VARCHAR(30) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED SUPPLIERS
-- ============================================================
INSERT INTO suppliers (
  company_id, code, name, category, tin_vat, country, city, contact_person,
  payment_terms_days, currency, is_approved_vendor, risk_score,
  on_time_delivery_pct, quality_score, overall_score, email, phone
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001', 'SUP-PULP01', 'East Africa Pulp Supplies Ltd',
    'raw_materials', '1000123456', 'Uganda', 'Jinja', 'James Okello',
    30, 'UGX', true, 35, 94, 96, 93, 'sales@eapulp.ug', '+256700111001'
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'SUP-INK02', 'Security Inks International',
    'chemicals', '1000987654', 'Kenya', 'Nairobi', 'Amina Wanjiru',
    45, 'USD', true, 40, 88, 98, 90, 'orders@secinks.ke', '+254700222002'
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'SUP-PKG03', 'Kampala Packaging Co',
    'packaging', '1000555444', 'Uganda', 'Kampala', 'Peter Ssemakula',
    14, 'UGX', true, 55, 82, 85, 80, 'info@klapack.ug', '+256700333003'
  ),
  (
    'a0000000-0000-4000-8000-000000000001', 'SUP-3PL04', 'Nile Logistics 3PL',
    'transport_services', '1000666777', 'Uganda', 'Kampala', 'Grace Namutebi',
    7, 'UGX', true, 45, 91, 90, 88, 'ops@nilelog.ug', '+256700444004'
  )
ON CONFLICT (company_id, code) DO UPDATE SET
  on_time_delivery_pct = EXCLUDED.on_time_delivery_pct,
  quality_score = EXCLUDED.quality_score,
  overall_score = EXCLUDED.overall_score,
  is_approved_vendor = EXCLUDED.is_approved_vendor,
  risk_score = EXCLUDED.risk_score;

-- Contract
INSERT INTO procurement_contracts (
  company_id, contract_number, title, contract_type, supplier_id,
  start_date, end_date, value_limit, status, terms
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'CTR-2026-PULP',
  'Framework — Pulp & paper raw materials 2026',
  'framework',
  s.id,
  '2026-01-01',
  '2026-12-31',
  2500000000,
  'active',
  'Annual framework for pulp rolls; call-off via PO'
FROM suppliers s
WHERE s.code = 'SUP-PULP01' AND s.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (SELECT 1 FROM procurement_contracts WHERE contract_number = 'CTR-2026-PULP');

-- RFQ + quotations
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_rfq UUID;
  v_prod UUID;
  v_sup1 UUID;
  v_sup2 UUID;
  v_q1 UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM rfqs WHERE rfq_number = 'RFQ-2026-0001') THEN RETURN; END IF;
  SELECT id INTO v_prod FROM products WHERE product_code = 'RAW-PULP-80' LIMIT 1;
  SELECT id INTO v_sup1 FROM suppliers WHERE code = 'SUP-PULP01' LIMIT 1;
  SELECT id INTO v_sup2 FROM suppliers WHERE code = 'SUP-PKG03' LIMIT 1;

  INSERT INTO rfqs (company_id, rfq_number, title, rfq_type, category, status, publish_date, close_date, description)
  VALUES (
    v_company, 'RFQ-2026-0001', 'Supply of 80gsm pulp rolls — Q3',
    'rfq', 'raw_materials', 'published', CURRENT_DATE - 5, CURRENT_DATE + 10,
    'Seeking competitive quotes for jumbo pulp rolls for Premium A4 line'
  ) RETURNING id INTO v_rfq;

  INSERT INTO rfq_lines (rfq_id, company_id, line_number, product_id, description, quantity, uom)
  VALUES (v_rfq, v_company, 1, v_prod, 'Pulp Roll 80gsm', 50, 'ROLL');

  INSERT INTO supplier_quotations (
    company_id, rfq_id, supplier_id, quotation_ref, total_amount, tax_amount,
    delivery_days, technical_score, financial_score, total_score, status, payment_terms
  ) VALUES (
    v_company, v_rfq, v_sup1, 'Q-EAP-4421', 22500000, 4050000, 7, 92, 88, 90, 'shortlisted', 'Net 30'
  ) RETURNING id INTO v_q1;

  INSERT INTO supplier_quotation_lines (quotation_id, company_id, description, quantity, unit_price, line_total)
  VALUES (v_q1, v_company, 'Pulp Roll 80gsm', 50, 450000, 22500000);

  IF v_sup2 IS NOT NULL THEN
    INSERT INTO supplier_quotations (
      company_id, rfq_id, supplier_id, quotation_ref, total_amount, tax_amount,
      delivery_days, technical_score, financial_score, total_score, status, payment_terms
    ) VALUES (
      v_company, v_rfq, v_sup2, 'Q-KPK-119', 24000000, 4320000, 14, 75, 70, 72, 'submitted', 'Net 14'
    );
  END IF;
END $$;

-- Purchase order
DO $$
DECLARE
  v_company UUID := 'a0000000-0000-4000-8000-000000000001';
  v_po UUID;
  v_sup UUID;
  v_prod UUID;
  v_wh UUID;
  v_ctr UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE po_number = 'PO-2026-0042') THEN RETURN; END IF;
  SELECT id INTO v_sup FROM suppliers WHERE code = 'SUP-PULP01' LIMIT 1;
  SELECT id INTO v_prod FROM products WHERE product_code = 'RAW-PULP-80' LIMIT 1;
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_company LIMIT 1;
  SELECT id INTO v_ctr FROM procurement_contracts WHERE contract_number = 'CTR-2026-PULP' LIMIT 1;

  INSERT INTO purchase_orders (
    company_id, po_number, supplier_id, warehouse_id, contract_id, order_date, expected_date,
    currency, subtotal, tax_amount, total_amount, status, po_type, payment_terms, notes
  ) VALUES (
    v_company, 'PO-2026-0042', v_sup, v_wh, v_ctr, CURRENT_DATE - 3, CURRENT_DATE + 7,
    'UGX', 22500000, 4050000, 26550000, 'sent', 'framework', 'Net 30',
    'Call-off under pulp framework agreement'
  ) RETURNING id INTO v_po;

  INSERT INTO purchase_order_lines (
    po_id, company_id, line_number, product_id, description, quantity, uom, unit_price, tax_rate, line_total
  ) VALUES (
    v_po, v_company, 1, v_prod, 'Pulp Roll 80gsm', 50, 'ROLL', 450000, 18, 22500000
  );

  -- Link existing GRN if present
  UPDATE goods_receipts SET
    purchase_order_id = v_po,
    purchase_order_ref = COALESCE(purchase_order_ref, 'PO-2026-0042')
  WHERE grn_number = 'GRN-2026-0001' AND purchase_order_id IS NULL;
END $$;

-- Inbound shipment
INSERT INTO inbound_shipments (
  company_id, shipment_number, purchase_order_id, supplier_id, carrier_name,
  tracking_number, mode, origin, destination_warehouse_id, etd, eta, status, freight_cost
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'INB-2026-0011',
  po.id,
  po.supplier_id,
  'Nile Logistics 3PL',
  'NL-TRACK-88921',
  'road',
  'Jinja Warehouse',
  po.warehouse_id,
  CURRENT_DATE - 1,
  CURRENT_DATE + 2,
  'in_transit',
  850000
FROM purchase_orders po
WHERE po.po_number = 'PO-2026-0042'
  AND NOT EXISTS (SELECT 1 FROM inbound_shipments WHERE shipment_number = 'INB-2026-0011');

-- Fleet
INSERT INTO fleet_vehicles (
  company_id, registration, make, model, year, vehicle_type, capacity_kg, status,
  current_odometer, insurance_expiry, road_license_expiry, assigned_driver_name
) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'UBA 123A', 'Isuzu', 'NPR', 2022, 'truck', 5000, 'available', 45200, '2026-11-30', '2026-09-15', 'Musa Kato'),
  ('a0000000-0000-4000-8000-000000000001', 'UBB 456B', 'Toyota', 'Hiace', 2021, 'van', 1500, 'in_use', 67800, '2026-08-20', '2026-10-01', 'Sarah Nambi'),
  ('a0000000-0000-4000-8000-000000000001', 'UBC 789C', 'Mitsubishi', 'Fuso', 2020, 'truck', 8000, 'maintenance', 92100, '2026-12-01', '2026-07-30', NULL)
ON CONFLICT (company_id, registration) DO NOTHING;

INSERT INTO fleet_fuel_logs (company_id, vehicle_id, log_date, litres, cost, odometer, station)
SELECT 'a0000000-0000-4000-8000-000000000001', id, CURRENT_DATE - 2, 80, 400000, 45100, 'Total Uganda'
FROM fleet_vehicles WHERE registration = 'UBA 123A'
  AND NOT EXISTS (SELECT 1 FROM fleet_fuel_logs WHERE odometer = 45100);

-- Scorecards
INSERT INTO supplier_scorecards (
  company_id, supplier_id, period_label, on_time_pct, quality_pct,
  price_competitiveness, responsiveness, order_accuracy, risk_rating, overall_score, notes
)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  s.id,
  'Q2 2026',
  s.on_time_delivery_pct,
  s.quality_score,
  85, 88, 92,
  CASE WHEN s.risk_score >= 60 THEN 'high' WHEN s.risk_score >= 40 THEN 'medium' ELSE 'low' END,
  s.overall_score,
  'Quarterly automated scorecard'
FROM suppliers s
WHERE s.company_id = 'a0000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM supplier_scorecards sc
    WHERE sc.supplier_id = s.id AND sc.period_label = 'Q2 2026'
  );

-- AI insights
INSERT INTO procurement_insights (company_id, insight_type, severity, title, recommendation, supplier_id, metric_value)
SELECT
  'a0000000-0000-4000-8000-000000000001',
  'supplier_performance',
  'high',
  'Supplier packaging OTD dropped to 82%',
  'Supplier ABC Ltd''s on-time delivery performance has dropped to 82% over the past three months. Recommend reallocating 30% of future paper packaging procurement to an alternate approved vendor while initiating a supplier performance review.',
  s.id,
  82
FROM suppliers s
WHERE s.code = 'SUP-PKG03'
  AND NOT EXISTS (
    SELECT 1 FROM procurement_insights WHERE title LIKE 'Supplier packaging OTD%'
  );

INSERT INTO procurement_insights (company_id, insight_type, severity, title, recommendation, metric_value)
VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'contract_renewal',
    'medium',
    'Pulp framework contract ends Dec 2026',
    'Start RFQ process 90 days before expiry to lock competitive pricing for FY2027 raw materials.',
    NULL
  ),
  (
    'a0000000-0000-4000-8000-000000000001',
    'freight_optimization',
    'low',
    'Consolidate inbound loads from Jinja',
    'Two partial loads scheduled this week. Combine into single FTL with Nile Logistics to reduce freight cost ~18%.',
    18
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Procurement', 'procurement.view', 'procurement', 'View procurement dashboards and POs'),
  ('Manage Procurement', 'procurement.manage', 'procurement', 'Create POs, RFQs, contracts'),
  ('Approve Procurement', 'procurement.approve', 'procurement', 'Approve requisitions and purchase orders'),
  ('View Logistics', 'logistics.view', 'logistics', 'View fleet, inbound, dispatch logistics'),
  ('Manage Logistics', 'logistics.manage', 'logistics', 'Manage fleet, routes, inbound shipments'),
  ('Supplier Portal Ops', 'procurement.suppliers', 'procurement', 'Manage suppliers and scorecards')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'e0000000-0000-4000-8000-000000000001', id FROM permissions
WHERE slug LIKE 'procurement.%' OR slug LIKE 'logistics.%'
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE procurement_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quotation_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY proc_contracts_all ON procurement_contracts FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY rfqs_all ON rfqs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY rfq_lines_all ON rfq_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY supplier_quotations_all ON supplier_quotations FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY supplier_quotation_lines_all ON supplier_quotation_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY purchase_orders_all ON purchase_orders FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY purchase_order_lines_all ON purchase_order_lines FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY inbound_shipments_all ON inbound_shipments FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fleet_vehicles_all ON fleet_vehicles FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fleet_fuel_logs_all ON fleet_fuel_logs FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY fleet_maintenance_all ON fleet_maintenance FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY supplier_scorecards_all ON supplier_scorecards FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
CREATE POLICY procurement_insights_all ON procurement_insights FOR ALL
  USING (company_id = public.user_company_id() OR public.is_super_admin())
  WITH CHECK (company_id = public.user_company_id() OR public.is_super_admin());
